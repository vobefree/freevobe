import { redirect } from "next/navigation";
import { getCurrentUser, sessionVerified } from "@/lib/auth";
import { identityFor, type AdminIdentity } from "@/lib/staff";
import type { UserRow } from "@/lib/db";
import { mfaRequired } from "./mfa";
import type { Permission } from "./permissions";

/**
 * Skyddar en adminsida: inloggning, personalroll, tvåfaktorskod och behörighet.
 *
 * Returnerar null när layouten redan visar inloggningen, kodsteget eller
 * "ingen åtkomst" – då ska sidan bara rendera tomt. redirect() används bara när
 * användaren är inne men saknar behörigheten.
 */
export async function guardAdminPage(
  locale: string,
  permission: Permission,
): Promise<{ user: UserRow; identity: AdminIdentity } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const identity = identityFor(user);
  if (!identity) return null;
  if (mfaRequired() && !(await sessionVerified())) return null;
  if (!identity.permissions.includes(permission)) redirect(`/${locale}/admin`);
  return { user, identity };
}
