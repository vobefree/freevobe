import { requirePermission } from "@/lib/admin/guard";
import { logAudit } from "@/lib/audit";
import { accountingConfig } from "@/lib/accounting/config";
import { vatReport } from "@/lib/accounting/bookings";
import { fileName, paymentsCsv, sie4, vatCsv, vouchersCsv } from "@/lib/accounting/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function period(search: URLSearchParams): { from: string; to: string } {
  const today = new Date().toISOString().slice(0, 10);
  const from = DATE.test(search.get("from") ?? "") ? (search.get("from") as string) : `${today.slice(0, 7)}-01`;
  const to = DATE.test(search.get("to") ?? "") ? (search.get("to") as string) : today;
  // Ett räkenskapsår i taget räcker – skyddar mot misstag i datumfälten.
  const span = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
  if (span < 0 || span > 400) return { from, to: from };
  return { from, to };
}

export async function GET(request: Request) {
  const guard = await requirePermission("economy.view");
  if ("response" in guard) return guard.response;

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";
  const range = period(url.searchParams);
  const config = accountingConfig();

  if (format === "json") {
    return Response.json({ period: range, report: vatReport(range), config });
  }

  const actor = { id: guard.actor.user.id, email: guard.actor.user.email };
  const send = (body: string, filename: string, type: string) => {
    logAudit(actor, "accounting.export", filename, `${range.from} – ${range.to}`);
    return new Response(body, {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  };

  if (format === "sie4") {
    return send(sie4({ period: range, config }), fileName("bokforing", range, "se"), "text/plain; charset=utf-8");
  }
  if (format === "verifikat") {
    return send(vouchersCsv(range, config), fileName("verifikationer", range, "csv"), "text/csv; charset=utf-8");
  }
  if (format === "underlag") {
    return send(paymentsCsv(range, config), fileName("betalningsunderlag", range, "csv"), "text/csv; charset=utf-8");
  }
  if (format === "moms") {
    return send(vatCsv(range, config), fileName("momsrapport", range, "csv"), "text/csv; charset=utf-8");
  }
  return Response.json({ error: "unknown_format" }, { status: 400 });
}
