import { notFound } from "next/navigation";
import { guardAdminPage } from "@/lib/admin/page-guard";
import { isLocale } from "@/lib/theme/types";
import { InboxPanel } from "@/components/admin/InboxPanel";

export const dynamic = "force-dynamic";

export default async function InboxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const guard = await guardAdminPage(locale, "inbox.view");
  if (!guard) return null;
  const { identity } = guard;
  return <InboxPanel canManage={identity.permissions.includes("inbox.manage")} />;
}
