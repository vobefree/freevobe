import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/admin/guard";
import { canGrantRole, listRoles } from "@/lib/admin/roles";
import type { StaffRole } from "@/lib/admin/permissions";
import { appUrl } from "@/lib/shopify";
import { deleteStaff, inviteStaff, issueStaffToken, listStaff, ownerEmails, staffById, updateStaff } from "@/lib/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePermission("staff.view");
  if ("response" in guard) return guard.response;
  const roles = listRoles();
  return Response.json({
    staff: listStaff(),
    owners: ownerEmails(),
    roles,
    grantable: roles.filter((role) => canGrantRole(guard.actor.identity.permissions, role.slug)).map((role) => role.slug),
    canManage: guard.actor.identity.permissions.includes("staff.manage"),
    canManageRoles: guard.actor.identity.owner,
    isOwner: guard.actor.identity.owner,
  });
}

export async function POST(request: Request) {
  const guard = await requirePermission("staff.manage");
  if ("response" in guard) return guard.response;
  const { user: actor, identity } = guard.actor;

  const body = (await request.json().catch(() => ({}))) as { email?: string; name?: string; role?: StaffRole };
  const email = (body.email ?? "").trim();
  const role = body.role ?? "";
  if (!email || !role) return Response.json({ error: "missing_input" }, { status: 400 });
  if (!canGrantRole(identity.permissions, role)) return Response.json({ error: "invalid_role" }, { status: 403 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return Response.json({ error: "invalid_email" }, { status: 400 });

  try {
    const { staff, token } = inviteStaff({ email, name: body.name ?? "", role, invitedBy: actor.email });
    logAudit({ id: actor.id, email: actor.email }, "staff.invite", staff.email, `role=${role}`);
    return Response.json({ staff, inviteUrl: `${appUrl()}/sv/staff/join/${token}` });
  } catch (error) {
    const code = error instanceof Error ? error.message : "failed";
    return Response.json({ error: code }, { status: code === "already_staff" ? 409 : 400 });
  }
}

export async function PATCH(request: Request) {
  const guard = await requirePermission("staff.manage");
  if ("response" in guard) return guard.response;
  const { user: actor, identity } = guard.actor;

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    role?: StaffRole;
    status?: "invited" | "active" | "suspended";
    name?: string;
    reissue?: boolean;
  };
  if (!body.id) return Response.json({ error: "missing_id" }, { status: 400 });

  const current = staffById(body.id);
  if (!current) return Response.json({ error: "not_found" }, { status: 404 });
  // Ingen får dela ut en roll med behörigheter den inte själv har.
  if (!canGrantRole(identity.permissions, current.role)) return Response.json({ error: "forbidden_role" }, { status: 403 });
  if (body.role && !canGrantRole(identity.permissions, body.role)) return Response.json({ error: "forbidden_role" }, { status: 403 });

  try {
    if (body.reissue) {
      const token = issueStaffToken(body.id);
      logAudit({ id: actor.id, email: actor.email }, "staff.reissue", body.id);
      return Response.json({ inviteUrl: `${appUrl()}/sv/staff/join/${token}` });
    }
    const staff = updateStaff(body.id, { role: body.role, status: body.status, name: body.name });
    if (!staff) return Response.json({ error: "not_found" }, { status: 404 });
    logAudit({ id: actor.id, email: actor.email }, "staff.update", staff.email, JSON.stringify({ role: staff.role, status: staff.status }));
    return Response.json({ staff });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const guard = await requirePermission("staff.manage");
  if ("response" in guard) return guard.response;
  const { user: actor, identity } = guard.actor;

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return Response.json({ error: "missing_id" }, { status: 400 });
  const current = staffById(body.id);
  if (!current) return Response.json({ error: "not_found" }, { status: 404 });
  if (!canGrantRole(identity.permissions, current.role)) return Response.json({ error: "forbidden_role" }, { status: 403 });
  deleteStaff(body.id);
  logAudit({ id: actor.id, email: actor.email }, "staff.remove", current.email);
  return Response.json({ ok: true });
}
