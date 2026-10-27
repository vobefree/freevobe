import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isLocale } from "@/lib/i18n";
import { workspaceFor } from "@/lib/agency";
import { AGENCY_PLAN_ORDER } from "@/lib/agency-plans";
import { ensureAgency } from "@/lib/agency";
import { updateAgency } from "@/lib/db";
import { AgencyWorkspace } from "@/components/agency/AgencyWorkspace";

export const dynamic = "force-dynamic";

export default async function AgencyWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ plan?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/agency/workspace`);

  let agency = ensureAgency(user);
  const query = await searchParams;
  if (query.plan && AGENCY_PLAN_ORDER.includes(query.plan as never) && query.plan !== agency.plan) {
    agency = updateAgency(agency.id, { plan: query.plan as (typeof AGENCY_PLAN_ORDER)[number] });
  }

  return <AgencyWorkspace locale={locale} initial={workspaceFor(agency)} />;
}
