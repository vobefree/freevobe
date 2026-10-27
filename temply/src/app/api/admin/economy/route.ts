import { db } from "@/lib/db";
import { economyReport } from "@/lib/admin/economy";
import { paymentsCsv } from "@/lib/admin/users";
import { requirePermission } from "@/lib/admin/guard";
import { listReferrals, referralStats } from "@/lib/referrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requirePermission("economy.view");
  if ("response" in guard) return guard.response;

  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") ?? 30);

  if (url.searchParams.get("format") === "csv") {
    const rows = db()
      .prepare(
        `SELECT p.id, u.email AS email, p.provider, p.amount_cents, p.currency, p.status, p.created_at
         FROM payments p JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC LIMIT 5000`,
      )
      .all() as unknown as { id: string; email: string; provider: string; amount_cents: number; currency: string; status: string; created_at: string }[];
    return new Response(paymentsCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="themefold-payments-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return Response.json({
    report: economyReport(Number.isFinite(days) ? days : 30),
    referrals: referralStats(),
    latestReferrals: listReferrals(20),
  });
}
