import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { siteConfig } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";
import { accessFor, listProjects } from "@/lib/db";
import { dictFor, isLocale } from "@/lib/content";
import { projectSummary } from "@/lib/projects";
import { referralSummary } from "@/lib/referrals";
import { shopifyConfigured } from "@/lib/shopify";
import { Dashboard } from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ shopify?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const dict = dictFor(locale);
  const query = await searchParams;
  const notice =
    query.shopify === "connected"
      ? dict.studio.connected.replace("{shop}", user.shopify_shop ?? "")
      : query.shopify && query.shopify !== "connected"
        ? dict.common.error
        : undefined;

  return (
    <Dashboard
      locale={locale}
      dict={dict}
      user={{ name: user.name, email: user.email, shopifyShop: user.shopify_shop, shopifyConnected: Boolean(user.shopify_shop && user.shopify_token) }}
      access={accessFor(user)}
      admin={isAdmin(user)}
      announcement={siteConfig().announcement}
      referral={referralSummary(user)}
      projects={listProjects(user.id).map(projectSummary)}
      shopifyConfigured={shopifyConfigured()}
      notice={notice}
    />
  );
}
