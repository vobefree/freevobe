import { notFound } from "next/navigation";
import { guardAdminPage } from "@/lib/admin/page-guard";
import { isLocale } from "@/lib/theme/types";
import { AuditPanel } from "@/components/admin/AuditPanel";

export const dynamic = "force-dynamic";

export default async function AuditPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (!(await guardAdminPage(locale, "audit.view"))) return null;
  return <AuditPanel />;
}
