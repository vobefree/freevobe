import { getCurrentUser, sessionVerified } from "@/lib/auth";
import type { UserRow } from "@/lib/db";
import { identityFor, staffCan, type AdminIdentity } from "@/lib/staff";
import { mfaRequired } from "./mfa";
import type { Permission } from "./permissions";

export type AdminActor = { user: UserRow; identity: AdminIdentity };

export async function getAdminActor(): Promise<AdminActor | null> {
  const user = await getCurrentUser();
  const identity = identityFor(user);
  if (!user || !identity) return null;
  return { user, identity };
}

/** Räcker sessionen för adminpanelens API:er? Kräver tvåfaktorskod. */
export async function adminSessionReady(): Promise<{ ready: boolean; reason?: "signed_out" | "not_staff" | "mfa_required" }> {
  const actor = await getAdminActor();
  if (!actor) return { ready: false, reason: "signed_out" };
  if (mfaRequired() && !(await sessionVerified())) return { ready: false, reason: "mfa_required" };
  return { ready: true };
}

export async function requirePermission(permission: Permission): Promise<{ actor: AdminActor } | { response: Response }> {
  const actor = await getAdminActor();
  if (!actor) return { response: Response.json({ error: "forbidden" }, { status: 403 }) };
  if (!staffCan(actor.identity, permission)) return { response: Response.json({ error: "forbidden", permission }, { status: 403 }) };
  if (mfaRequired() && !(await sessionVerified())) {
    return { response: Response.json({ error: "mfa_required" }, { status: 403 }) };
  }
  return { actor };
}
