import { requirePermission } from "@/lib/admin/guard";
import { listAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requirePermission("audit.view");
  if ("response" in guard) return guard.response;
  const url = new URL(request.url);
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 150)));
  const rows = listAudit(limit, url.searchParams.get("q") ?? "");
  return Response.json({ entries: rows.map((row) => ({ ...row })) });
}
