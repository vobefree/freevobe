import { adminOverview } from "@/lib/admin";
import { requirePermission } from "@/lib/admin/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePermission("overview.view");
  if ("response" in guard) return guard.response;
  return Response.json({ overview: adminOverview(), identity: { role: guard.actor.identity.role, permissions: guard.actor.identity.permissions } });
}
