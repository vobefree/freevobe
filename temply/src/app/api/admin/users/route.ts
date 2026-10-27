import { logAudit } from "@/lib/audit";
import { adminUserDetail, deleteUserAccount, extendTrial, listAdminUsers, setUserPassword } from "@/lib/admin/users";
import { requirePermission } from "@/lib/admin/guard";
import { canGrantRole } from "@/lib/admin/roles";
import { hashPassword } from "@/lib/auth";
import { findUserById, updateUser } from "@/lib/db";
import { assignStaffRole, ownerEmails } from "@/lib/staff";
import { isLocale } from "@/lib/theme/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function randomPassword(): string {
  return `tf-${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;
}

export async function GET(request: Request) {
  const guard = await requirePermission("users.view");
  if ("response" in guard) return guard.response;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (id) {
    const detail = adminUserDetail(id);
    if (!detail) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ detail });
  }
  const result = listAdminUsers({
    q: url.searchParams.get("q") ?? "",
    limit: Number(url.searchParams.get("limit") ?? 50),
    offset: Number(url.searchParams.get("offset") ?? 0),
  });
  return Response.json(result);
}

export async function PATCH(request: Request) {
  const guard = await requirePermission("users.manage");
  if ("response" in guard) return guard.response;
  const { user: actor, identity } = guard.actor;

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    plan?: "trialing" | "active" | "canceled";
    locale?: string;
    disabled?: boolean;
    extendTrialDays?: number;
    resetPassword?: boolean;
    disconnectShopify?: boolean;
    staffRole?: string | null;
  };
  if (!body.id) return Response.json({ error: "missing_id" }, { status: 400 });
  const target = findUserById(body.id);
  if (!target) return Response.json({ error: "not_found" }, { status: 404 });

  const targetIsOwner = ownerEmails().includes(target.email.toLowerCase());
  if (targetIsOwner && !identity.owner) return Response.json({ error: "owner_protected" }, { status: 403 });

  const applied: string[] = [];
  let temporaryPassword: string | null = null;

  if (body.plan) {
    if (!["trialing", "active", "canceled"].includes(body.plan)) {
      return Response.json({ error: "invalid_plan" }, { status: 400 });
    }
    updateUser(target.id, { plan_status: body.plan });
    applied.push(`plan=${body.plan}`);
  }
  if (body.locale && isLocale(body.locale)) {
    updateUser(target.id, { locale: body.locale });
    applied.push(`locale=${body.locale}`);
  }
  if (typeof body.disabled === "boolean") {
    if (body.disabled && target.id === actor.id) return Response.json({ error: "self_disable" }, { status: 400 });
    updateUser(target.id, { disabled: body.disabled ? 1 : 0 });
    applied.push(body.disabled ? "disabled" : "enabled");
  }
  if (body.extendTrialDays) {
    extendTrial(body.id, body.extendTrialDays);
    applied.push(`trial+${body.extendTrialDays}d`);
  }
  if (body.resetPassword) {
    temporaryPassword = randomPassword();
    setUserPassword(target.id, hashPassword(temporaryPassword));
    applied.push("password_reset");
  }
  if (body.disconnectShopify) {
    updateUser(target.id, { shopify_token: null, shopify_scope: null, shopify_connected_at: null });
    applied.push("shopify_disconnected");
  }
  if (body.staffRole !== undefined) {
    if (!identity.permissions.includes("staff.manage")) return Response.json({ error: "forbidden" }, { status: 403 });
    if (target.id === actor.id) return Response.json({ error: "self_role" }, { status: 400 });
    const slug = body.staffRole === null || body.staffRole === "" ? null : String(body.staffRole);
    if (slug !== null && !canGrantRole(identity.permissions, slug)) return Response.json({ error: "forbidden_role" }, { status: 403 });
    try {
      assignStaffRole({ email: target.email, userId: target.id, name: target.name, role: slug, invitedBy: actor.email });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
    }
    applied.push(slug === null ? "staff_role_removed" : `staff_role=${slug}`);
  }

  if (applied.length === 0) return Response.json({ error: "nothing_applied" }, { status: 400 });
  logAudit({ id: actor.id, email: actor.email }, "users.update", target.email, applied.join(","));
  return Response.json({ ok: true, applied, temporaryPassword });
}

export async function DELETE(request: Request) {
  const guard = await requirePermission("users.manage");
  if ("response" in guard) return guard.response;
  const { user: actor, identity } = guard.actor;

  const body = (await request.json().catch(() => ({}))) as { id?: string; confirm?: string };
  if (!body.id) return Response.json({ error: "missing_id" }, { status: 400 });
  const target = findUserById(body.id);
  if (!target) return Response.json({ error: "not_found" }, { status: 404 });
  if (target.id === actor.id) return Response.json({ error: "self_delete" }, { status: 400 });
  if (ownerEmails().includes(target.email.toLowerCase()) && !identity.owner) {
    return Response.json({ error: "owner_protected" }, { status: 403 });
  }
  if ((body.confirm ?? "").trim().toLowerCase() !== target.email.toLowerCase()) {
    return Response.json({ error: "confirm_email" }, { status: 400 });
  }

  deleteUserAccount(target.id);
  logAudit({ id: actor.id, email: actor.email }, "users.delete", target.email);
  return Response.json({ ok: true });
}
