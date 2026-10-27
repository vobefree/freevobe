import { notFound } from "next/navigation";
import { guardAdminPage } from "@/lib/admin/page-guard";
import { accountingConfig } from "@/lib/accounting/config";
import { vatReport } from "@/lib/accounting/bookings";
import { isLocale } from "@/lib/theme/types";
import { AccountingPanel } from "@/components/admin/AccountingPanel";

export const dynamic = "force-dynamic";

export default async function AccountingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const guard = await guardAdminPage(locale, "economy.view");
  if (!guard) return null;

  const today = new Date().toISOString().slice(0, 10);
  const period = { from: `${today.slice(0, 7)}-01`, to: today };
  const config = accountingConfig();

  return (
    <AccountingPanel
      initialPeriod={period}
      initialReport={vatReport(period, config)}
      canExport
      config={{
        companyName: config.companyName,
        orgNumber: config.orgNumber,
        vatNumber: config.vatNumber,
        pricesInclVat: config.pricesInclVat,
        vatRate: config.vatRate,
        stripeVat: config.stripeVat,
        stripeFeePercent: config.stripeFeePercent,
      }}
    />
  );
}
