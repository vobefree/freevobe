import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/admin/guard";
import { deleteInboxMessage, inboxCounts, listInbox, setInboxHandled } from "@/lib/admin/inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requirePermission("inbox.view");
  if ("response" in guard) return guard.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  return Response.json({
    messages: listInbox({
      q: url.searchParams.get("q") ?? "",
      status: status === "new" || status === "handled" ? status : "all",
      limit: Number(url.searchParams.get("limit") ?? 100),
    }),
    counts: inboxCounts(),
    canManage: guard.actor.identity.permissions.includes("inbox.manage"),
  });
}

export async function PATCH(request: Request) {
  const guard = await requirePermission("inbox.manage");
  if ("response" in guard) return guard.response;
  const { user: actor } = guard.actor;

  const body = (await request.json().catch(() => ({}))) as { id?: string; handled?: boolean };
  if (!body.id || typeof body.handled !== "boolean") return Response.json({ error: "missing_input" }, { status: 400 });
  if (!setInboxHandled(body.id, body.handled)) return Response.json({ error: "not_found" }, { status: 404 });

  logAudit({ id: actor.id, email: actor.email }, body.handled ? "inbox.handle" : "inbox.reopen", body.id);
  return Response.json({ ok: true, counts: inboxCounts() });
}

export async function DELETE(request: Request) {
  const guard = await requirePermission("inbox.manage");
  if ("response" in guard) return guard.response;
  const { user: actor } = guard.actor;

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return Response.json({ error: "missing_id" }, { status: 400 });
  deleteInboxMessage(body.id);
  logAudit({ id: actor.id, email: actor.email }, "inbox.delete", body.id);
  return Response.json({ ok: true, counts: inboxCounts() });
}
