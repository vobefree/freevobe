import { notFound, redirect } from "next/navigation";
import { adminOverview } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { getInsightsStrings } from "@/lib/i18n/insights";
import { isLocale } from "@/lib/theme/types";
import { identityFor } from "@/lib/staff";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const identity = identityFor(user);
  if (!identity || !identity.permissions.includes("overview.view")) redirect(`/${locale}/dashboard`);

  return (
    <AdminDashboard
      locale={locale}
      strings={getInsightsStrings(locale)}
      email={user.email}
      role={identity.roleLabel}
      canEconomy={identity.permissions.includes("economy.view")}
      canInbox={identity.permissions.includes("inbox.view")}
      initial={adminOverview()}
    />
  );
}
