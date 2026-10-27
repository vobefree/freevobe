import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/admin/guard";
import { listSettings, saveSettings, settingGroups } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePermission("keys.view");
  if ("response" in guard) return guard.response;
  return Response.json({
    settings: listSettings(),
    groups: settingGroups(),
    canManage: guard.actor.identity.permissions.includes("keys.manage"),
  });
}

export async function POST(request: Request) {
  const guard = await requirePermission("keys.manage");
  if ("response" in guard) return guard.response;
  const { user } = guard.actor;

  const body = (await request.json().catch(() => ({}))) as { values?: Record<string, string> };
  const values = body.values ?? {};
  const entries = Object.entries(values).filter(([, value]) => typeof value === "string");
  if (entries.length === 0) return Response.json({ error: "nothing_to_save" }, { status: 400 });

  const result = saveSettings(Object.fromEntries(entries), user.email);
  // Logga vilka nycklar som rördes, aldrig värdena.
  logAudit({ id: user.id, email: user.email }, "keys.update", Object.keys(values).join(","), `saved=${result.saved}`);
  return Response.json({ ok: true, ...result, settings: listSettings() });
}
