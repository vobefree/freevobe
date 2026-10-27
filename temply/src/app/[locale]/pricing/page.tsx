import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { accessFor } from "@/lib/db";
import { stripeEnabled } from "@/lib/billing";
import { dictFor, isLocale, localPrice, LOCALE_META } from "@/lib/content";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SubscribeButton } from "@/components/SubscribeButton";
import { Icon } from "@/components/Icon";

export default async function PricingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ success?: string; canceled?: string; error?: string; locked?: string; dev?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const dict = dictFor(locale);
  const user = await getCurrentUser();
  const access = user ? accessFor(user) : null;
  const price = localPrice(locale);
  const dev = !stripeEnabled();

  return (
    <>
      <SiteHeader locale={locale} dict={dict} loggedIn={Boolean(user)} />
      <main className="section-mkt">
        <div className="wrap" style={{ maxWidth: 980 }}>
          <div className="section-mkt__head" style={{ textAlign: "center", marginInline: "auto" }}>
            <p className="eyebrow-mkt">{dict.landing.priceEyebrow}</p>
            <h2>{dict.pricing.title}</h2>
            <p>{dict.pricing.sub}</p>
          </div>

          {query.success && <div className="banner banner--ok" style={{ textAlign: "center" }}>{query.dev ? `${dict.pricing.success} ${dict.pricing.devMode}` : dict.pricing.success}</div>}
          {query.locked && <div className="banner banner--warn" style={{ textAlign: "center" }}>{dict.pricing.expiredBanner}</div>}
          {query.error && <div className="banner banner--warn" style={{ textAlign: "center" }}>{dict.common.error}</div>}

          <div className="pricing-card">
            <div className="pricing-card__main">
              <span className="trial-badge">{dict.landing.trialBadge}</span>
              <h3 style={{ fontSize: 24, marginTop: 18 }}>{dict.landing.planName}</h3>
              <div className="price-tag">
                <strong>{price}</strong>
                <span>{dict.common.perMonth}</span>
              </div>
              <p className="muted" style={{ fontSize: 12.5 }}>{dict.pricing.localPrice.replace("{local}", price)}</p>
              <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>{dict.landing.planDesc}</p>

              <div style={{ marginTop: 26 }}>
                {!user ? (
                  <Link className="ui-btn ui-btn--accent ui-btn--lg ui-btn--block" href={`/${locale}/signup`}>{dict.landing.priceCta}</Link>
                ) : (
                  <SubscribeButton locale={locale} dict={dict} label={dict.pricing.upgradeNow} active={access?.status === "active"} />
                )}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 12, fontSize: 11.5 }} className="muted">
                  <span><Icon name="check" size="sm" strokeWidth={2} /> {dict.landing.noCard}</span>
                  <span>{dict.landing.cancelAnytime}</span>
                </div>
              </div>

              {user && access && (
                <div style={{ borderTop: "1px solid var(--line)", marginTop: 22, paddingTop: 16, fontSize: 12.5 }}>
                  <strong>{dict.pricing.currentPlan}: </strong>
                  {access.status === "active" ? dict.dashboard.active : access.status === "trial" ? dict.pricing.daysLeft.replace("{days}", String(access.daysLeft)) : dict.dashboard.expiredTitle}
                  <div style={{ marginTop: 10 }}>
                    <Link href={`/${locale}/dashboard`} style={{ textDecoration: "underline", fontSize: 12 }}>{dict.pricing.backToStudio}</Link>
                  </div>
                </div>
              )}

              {dev && <p className="muted" style={{ fontSize: 11, marginTop: 18 }}>{dict.pricing.devMode}</p>}
            </div>

            <div className="pricing-card__side">
              <p className="eyebrow-mkt" style={{ marginBottom: 12 }}>{dict.landing.featuresEyebrow}</p>
              <div className="price-features">
                {dict.landing.priceFeatures.map((feature) => (
                  <div key={feature}>
                    <Icon name="check" size="sm" strokeWidth={2} />
                    {feature}
                  </div>
                ))}
              </div>
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16, marginTop: 22, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{LOCALE_META[locale].currency}</strong>
                  <span className="muted">{LOCALE_META[locale].name}</span>
                </div>
                <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{dict.landing.langsSub}</p>
                {!dev && (
                  <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
                    <Icon name="lock" size="xs" /> {dict.pricing.securedBy}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: 26 }}>
            <Link className="muted" style={{ fontSize: 12.5, textDecoration: "underline" }} href={`/${locale}`}>{dict.common.back}</Link>
          </div>
        </div>
      </main>
      <SiteFooter locale={locale} dict={dict} />
    </>
  );
}
