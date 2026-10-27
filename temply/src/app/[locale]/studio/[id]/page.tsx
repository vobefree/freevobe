import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { accessFor, getProject } from "@/lib/db";
import { dictFor, isLocale } from "@/lib/content";
import { parseConfig, projectSummary } from "@/lib/projects";
import { shopifyConfigured } from "@/lib/shopify";
import { Studio } from "@/components/studio/Studio";

export const dynamic = "force-dynamic";

export default async function StudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ shopify?: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const project = getProject(user.id, id);
  if (!project) notFound();

  const access = accessFor(user);
  if (access.status === "expired") redirect(`/${locale}/pricing?locked=1`);

  const dict = dictFor(locale);
  const summary = projectSummary(project);
  summary.config = parseConfig(project.config);
  const query = await searchParams;
  const notice = query.shopify === "connected" ? dict.studio.connected.replace("{shop}", user.shopify_shop ?? "") : undefined;

  return (
    <Studio
      locale={locale}
      dict={dict}
      project={summary}
      access={access}
      shopifyConfigured={shopifyConfigured()}
      shopifyShop={user.shopify_shop}
      shopifyConnected={Boolean(user.shopify_shop && user.shopify_token)}
      notice={notice}
    />
  );
}
