import { notFound } from "next/navigation";
import { guardAdminPage } from "@/lib/admin/page-guard";
import { isLocale } from "@/lib/theme/types";
import { EconomyPanel } from "@/components/admin/EconomyPanel";

export const dynamic = "force-dynamic";

export default async function EconomyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const guard = await guardAdminPage(locale, "economy.view");
  if (!guard) return null;
  const { identity } = guard;
  return <EconomyPanel canManage={identity.permissions.includes("economy.manage")} />;
}
