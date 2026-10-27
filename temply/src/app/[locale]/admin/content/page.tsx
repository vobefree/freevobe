import { notFound } from "next/navigation";
import { guardAdminPage } from "@/lib/admin/page-guard";
import { contentEntries, CONTENT_LOCALES, overrideCount } from "@/lib/content";
import { LOCALE_META } from "@/lib/i18n";
import { isLocale } from "@/lib/theme/types";
import { ContentEditor } from "@/components/admin/ContentEditor";

export const dynamic = "force-dynamic";

export default async function ContentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const guard = await guardAdminPage(locale, "content.view");
  if (!guard) return null;

  // Editorn öppnas på redaktörens eget språk – det är oftast där texten skrivs.
  const editing = isLocale(guard.user.locale) ? guard.user.locale : "sv";
  return (
    <ContentEditor
      canManage={guard.identity.permissions.includes("content.manage")}
      initialLocale={editing}
      initialEntries={contentEntries(editing)}
      initialCount={overrideCount(editing)}
      locales={CONTENT_LOCALES.map((code) => ({
        code,
        label: LOCALE_META[code].name,
        short: LOCALE_META[code].short,
      }))}
    />
  );
}
