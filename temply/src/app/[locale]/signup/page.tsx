import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { dictFor, isLocale } from "@/lib/content";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { getAuthSocialStrings } from "@/lib/i18n/auth-social";
import { configuredSocialProviders } from "@/lib/social";
import { shopifyConfigured } from "@/lib/shopify";

export default async function SignupPage({
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
  const social = getAuthSocialStrings(locale);
  const notice = query.shopify === "noaccount"
    ? social.noticeNoAccount
    : query.social
      ? query.social === "email"
        ? social.noticeEmail
        : social.noticeSocialConfig
      : null;
  return (
    <AuthShell locale={locale} dict={dict} title={dict.auth.signupTitle} subtitle={dict.auth.signupSub}>
      <AuthForm
        mode="signup"
        locale={locale}
        dict={dict}
        socialProviders={configuredSocialProviders()}
        shopifyReady={shopifyConfigured()}
        showShopify={false}
        notice={notice}
      />
    </AuthShell>
  );
}
