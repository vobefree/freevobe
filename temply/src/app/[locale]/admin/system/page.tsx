import { notFound } from "next/navigation";
import { guardAdminPage } from "@/lib/admin/page-guard";
import { systemChecks } from "@/lib/admin/system-check";
import { referralConfig, siteConfig } from "@/lib/settings";
import { isLocale } from "@/lib/theme/types";
import { SystemPanel } from "@/components/admin/SystemPanel";

export const dynamic = "force-dynamic";

export default async function SystemPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const guard = await guardAdminPage(locale, "system.view");
  if (!guard) return null;
  const { identity } = guard;
  return (
    <SystemPanel
      canManage={identity.permissions.includes("system.manage")}
      initial={{ checks: systemChecks(), site: siteConfig(), referral: referralConfig() }}
    />
  );
}
