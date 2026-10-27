import { notFound } from "next/navigation";
import { guardAdminPage } from "@/lib/admin/page-guard";
import { canGrantRole, listRoles } from "@/lib/admin/roles";
import { isLocale } from "@/lib/theme/types";
import { StaffPanel } from "@/components/admin/StaffPanel";

export const dynamic = "force-dynamic";

export default async function StaffPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const guard = await guardAdminPage(locale, "staff.view");
  if (!guard) return null;
  const { identity } = guard;
  const roles = listRoles();
  return (
    <StaffPanel
      canManage={identity.permissions.includes("staff.manage")}
      canManageRoles={identity.owner}
      roles={roles}
      grantable={roles.filter((role) => canGrantRole(identity.permissions, role.slug)).map((role) => role.slug)}
    />
  );
}
