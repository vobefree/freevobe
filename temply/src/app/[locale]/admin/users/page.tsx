import { notFound } from "next/navigation";
import { guardAdminPage } from "@/lib/admin/page-guard";
import { canGrantRole, listRoles } from "@/lib/admin/roles";
import { isLocale } from "@/lib/theme/types";
import { UsersPanel } from "@/components/admin/UsersPanel";

export const dynamic = "force-dynamic";

export default async function UsersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const guard = await guardAdminPage(locale, "users.view");
  if (!guard) return null;
  const { user, identity } = guard;
  const roles = listRoles().map((role) => ({ slug: role.slug, label: role.label }));
  return (
    <UsersPanel
      canManage={identity.permissions.includes("users.manage")}
      canManageStaff={identity.permissions.includes("staff.manage")}
      isOwner={identity.owner}
      selfId={user.id}
      roles={roles}
      grantable={roles.filter((role) => canGrantRole(identity.permissions, role.slug)).map((role) => role.slug)}
    />
  );
}
