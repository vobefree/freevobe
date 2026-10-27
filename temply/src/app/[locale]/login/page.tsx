import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { dictFor, isLocale } from "@/lib/content";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { getAuthSocialStrings } from "@/lib/i18n/auth-social";
import { configuredSocialProviders } from "@/lib/social";
import { shopifyConfigured } from "@/lib/shopify";

function noticeFor(shopify: string | undefined, social: string | undefined, locale: Parameters<typeof getAuthSocialStrings>[0]) {
  const strings = getAuthSocialStrings(locale);
  if (shopify) {
    const map: Record<string, string> = {
      config: strings.noticeConfig,
      invalid: strings.noticeInvalid,
      noaccount: strings.noticeNoAccount,
      state: strings.noticeState,
      exchange: strings.noticeExchange,
    };
    return map[shopify] ?? strings.noticeConfig;
  }
  if (social) {
    const map: Record<string, string> = {
      config: strings.noticeSocialConfig,
      email: strings.noticeEmail,
      state: strings.noticeState,
      exchange: strings.noticeExchange,
      denied: strings.noticeState,
    };
    return map[social] ?? strings.noticeSocialConfig;
  }
  return null;
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ shopify?: string; social?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await getCurrentUser();
  if (user) redirect(`/${locale}/dashboard`);
  const dict = dictFor(locale);
  const query = await searchParams;
  return (
    <AuthShell locale={locale} dict={dict} title={dict.auth.loginTitle} subtitle={dict.auth.loginSub}>
      <AuthForm
        mode="login"
        locale={locale}
        dict={dict}
        socialProviders={configuredSocialProviders()}
        shopifyReady={shopifyConfigured()}
        notice={noticeFor(query.shopify, query.social, locale)}
      />
    </AuthShell>
  );
}
