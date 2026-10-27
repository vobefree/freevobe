import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/admin/guard";
import { createRole, deleteRole, listRoles, updateRole } from "@/lib/admin/roles";
import { PERMISSIONS, PERMISSION_GROUPS, PERMISSION_META } from "@/lib/admin/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rollmatrisen. Alla med staff.view får läsa rollerna, men bara ägaren får
 * skapa och ändra dem – annars kan en administratör ge sig själv nya rättigheter.
 */
export async function GET() {
  const guard = await requirePermission("staff.view");
  if ("response" in guard) return guard.response;
  return Response.json({
    roles: listRoles(),
    permissions: PERMISSIONS,
    groups: PERMISSION_GROUPS,
    meta: PERMISSION_META,
    canManage: guard.actor.identity.owner,
  });
}

export async function POST(request: Request) {
  const guard = await requirePermission("staff.manage");
  if ("response" in guard) return guard.response;
  const { user: actor, identity } = guard.actor;
  if (!identity.owner) return Response.json({ error: "owner_only" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { label?: string; description?: string; permissions?: string[] };
  try {
    const role = createRole({ label: body.label ?? "", description: body.description, permissions: body.permissions });
    logAudit({ id: actor.id, email: actor.email }, "roles.create", role.slug, JSON.stringify({ permissions: role.permissions }));
    return Response.json({ role, roles: listRoles() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const guard = await requirePermission("staff.manage");
  if ("response" in guard) return guard.response;
  const { user: actor, identity } = guard.actor;
  if (!identity.owner) return Response.json({ error: "owner_only" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    slug?: string;
    label?: string;
    description?: string;
    permissions?: string[];
  };
  if (!body.slug) return Response.json({ error: "missing_slug" }, { status: 400 });
  try {
    const role = updateRole(body.slug, { label: body.label, description: body.description, permissions: body.permissions });
    logAudit({ id: actor.id, email: actor.email }, "roles.update", role.slug, JSON.stringify({ permissions: role.permissions }));
    return Response.json({ role, roles: listRoles() });
  } catch (error) {
    const code = error instanceof Error ? error.message : "failed";
    return Response.json({ error: code }, { status: code === "not_found" ? 404 : 400 });
  }
}

export async function DELETE(request: Request) {
  const guard = await requirePermission("staff.manage");
  if ("response" in guard) return guard.response;
  const { user: actor, identity } = guard.actor;
  if (!identity.owner) return Response.json({ error: "owner_only" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { slug?: string };
  if (!body.slug) return Response.json({ error: "missing_slug" }, { status: 400 });
  try {
    deleteRole(body.slug);
    logAudit({ id: actor.id, email: actor.email }, "roles.delete", body.slug);
    return Response.json({ ok: true, roles: listRoles() });
  } catch (error) {
    const code = error instanceof Error ? error.message : "failed";
    return Response.json({ error: code }, { status: code === "not_found" ? 404 : 400 });
  }
}
