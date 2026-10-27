import { notFound } from "next/navigation";
import { guardAdminPage } from "@/lib/admin/page-guard";
import { listSettings, settingGroups } from "@/lib/settings";
import { isLocale } from "@/lib/theme/types";
import { KeysPanel } from "@/components/admin/KeysPanel";

export const dynamic = "force-dynamic";

export default async function KeysPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const guard = await guardAdminPage(locale, "keys.view");
  if (!guard) return null;
  const { identity } = guard;
  return <KeysPanel canManage={identity.permissions.includes("keys.manage")} initial={{ settings: listSettings(), groups: settingGroups() }} />;
}
