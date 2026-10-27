import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { dictFor, isLocale } from "@/lib/content";
import { getAgencyStrings } from "@/lib/i18n/agency";
import { AGENCY_PLAN_ORDER, agencyPlan } from "@/lib/agency-plans";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { Icon } from "@/components/Icon";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = getAgencyStrings(isLocale(locale) ? locale : "sv");
  return { title: `Partner pricing — ${t.priceTitle}`, description: t.priceSub };
}

const FOR_WHOM: Record<string, { sv: string; en: string }> = {
  starter: { sv: "Freelancers och små byråer", en: "Freelancers and small studios" },
  pro: { sv: "Byråer med flera kunder", en: "Agencies with several clients" },
  unlimited: { sv: "Större byråer och Shopify-partners", en: "Larger agencies and Shopify partners" },
};

export default async function AgencyPricingPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getAgencyStrings(locale);
  const dict = dictFor(locale);
  const user = await getCurrentUser();
  const sv = locale === "sv" || locale === "nb" || locale === "da";
  const base = user ? `/${locale}/agency/workspace` : `/${locale}/signup`;

  const rows: { label: string; values: [string, string, string] }[] = [
    { label: t.stat1, values: ["3", "10", "∞"] },
    { label: t.seats, values: ["2", "5", "∞"] },
    { label: t.mockLibrary, values: ["✓", "✓", "✓"] },
    { label: t.libBrand, values: ["✓", "✓", "✓"] },
    { label: t.mockWhite, values: ["—", "✓", "✓"] },
    { label: t.mockReview, values: ["—", "✓", "✓"] },
    { label: t.tabReviews, values: ["—", "✓", "✓"] },
    { label: "API", values: ["—", "—", "✓"] },
    { label: t.role, values: ["2", "5", "∞"] },
  ];

  const faqs = [
    [t.priceFaq1q, t.priceFaq1a],
    [t.priceFaq2q, t.priceFaq2a],
    [t.priceFaq3q, t.priceFaq3a],
  ];

  return (
    <>
      <SiteHeader locale={locale} dict={dict} loggedIn={Boolean(user)} />
      <main className="ag-page">
        <section className="ag-price-hero">
          <div className="wrap">
            <Link className="ag-back" href={`/${locale}/agency`}>
              <Icon name="arrowLeft" size="xs" /> {t.nav}
            </Link>
            <p className="eyebrow-mkt">{t.priceEyebrow}</p>
            <h1>{t.priceTitle}</h1>
            <p className="ag-price-hero__sub">{t.priceSub}</p>
            <div className="ag-price-hero__badges">
              <span className="pill"><i className="dot" /> {t.heroEyebrow}</span>
              <span className="pill">{t.heroNote}</span>
            </div>
          </div>
        </section>

        <section className="ag-price-section">
          <div className="wrap">
            <div className="ag-price-grid">
              {AGENCY_PLAN_ORDER.map((id) => {
                const plan = agencyPlan(id);
                const featured = id === "pro";
                return (
                  <article className={`ag-price-card${featured ? " is-featured" : ""}`} key={id}>
                    {featured && <span className="ag-price-card__badge">MOST POPULAR</span>}
                    <div className="ag-price-card__top">
                      <h2>{plan.name}</h2>
                      <p>{FOR_WHOM[id][sv ? "sv" : "en"]}</p>
                    </div>
                    <div className="ag-price-card__price">
                      <strong>${plan.priceUsd}</strong>
                      <span>{t.perMonth}</span>
                    </div>
                    <p className="ag-price-card__note">{t.currentNote}</p>

                    <div className="ag-price-card__ai">
                      <b>{t.aiHeading}</b>
                      <span><Icon name="sparkles" size="xs" /> {plan.aiCopy >= 5000 ? t.aiFairValue : `${plan.aiCopy} ${t.aiCopy.toLowerCase()}`}</span>
                      <span><Icon name="image" size="xs" /> {plan.aiImages >= 2500 ? t.aiFair : `${plan.aiImages} ${t.aiImages.toLowerCase()}`}</span>
                    </div>

                    <ul>
                      <li><Icon name="check" size="sm" /> {plan.projects === Number.POSITIVE_INFINITY ? (sv ? "Obegränsade kundprojekt" : "Unlimited client projects") : `${plan.projects} ${t.stat1}`}</li>
                      <li><Icon name="check" size="sm" /> {plan.members === Number.POSITIVE_INFINITY ? (sv ? "Obegränsat team" : "Unlimited team") : `${plan.members} ${t.seats}`}</li>
                      <li><Icon name="check" size="sm" /> {t.mockLibrary} · {t.libSection} · {t.libConversion}</li>
                      <li><Icon name="check" size="sm" /> {t.libBrand} · {t.saveTokens}</li>
                      <li><Icon name="check" size="sm" /> {sv ? "Draft-publicering" : "Draft publishing"}</li>
                      {plan.whiteLabel && <li><Icon name="check" size="sm" /> {t.whiteLabel}</li>}
                      {plan.clientReview && <li><Icon name="check" size="sm" /> {t.mockReview} + {t.tabReviews}</li>}
                      {plan.versions && <li><Icon name="check" size="sm" /> {sv ? "Versionshistorik" : "Version history"}</li>}
                      {plan.api && <li><Icon name="check" size="sm" /> API · {sv ? "prioriterad support" : "priority support"}</li>}
                    </ul>

                    <Link className={`ui-btn ui-btn--block ui-btn--lg ${featured ? "ui-btn--accent" : "ui-btn--ghost"}`} href={`${base}${user ? `?plan=${id}` : `?agency=${id}`}`}>
                      {id === "unlimited" ? t.ctaContact : t.choose}
                      <Icon name="arrowRight" size="xs" />
                    </Link>
                  </article>
                );
              })}
            </div>
            <p className="ag-price-footnote">{t.currentNote}</p>
          </div>
        </section>

        <section className="ag-ai-band">
          <div className="wrap ag-ai-band__grid">
            <div>
              <p className="eyebrow-mkt">{t.aiEyebrow}</p>
              <h2>{t.aiHeading}</h2>
              <p>{t.aiSub}</p>
            </div>
            <div className="ag-ai-table">
              <div className="ag-ai-table__row is-head">
                <span>Plan</span><span>{t.aiCopy}</span><span>{t.aiImages}</span>
              </div>
              {AGENCY_PLAN_ORDER.map((id) => {
                const plan = agencyPlan(id);
                return (
                  <div className="ag-ai-table__row" key={id}>
                    <span><b>{plan.name}</b><small>${plan.priceUsd}{t.perMonth}</small></span>
                    <span>{plan.aiCopy >= 5000 ? t.aiFair : plan.aiCopy}</span>
                    <span>{plan.aiImages >= 2500 ? t.aiFair : plan.aiImages}</span>
                  </div>
                );
              })}
              <p className="ag-ai-table__note"><Icon name="info" size="xs" /> {t.fairNote}</p>
            </div>
          </div>
        </section>

        <section className="section-mkt">
          <div className="wrap">
            <div className="section-mkt__head" style={{ textAlign: "center", marginInline: "auto" }}>
              <h2>{t.compareTitle}</h2>
              <p>{t.compareSub}</p>
            </div>
            <div className="ag-compare">
              <div className="ag-compare__row is-head">
                <span />
                {AGENCY_PLAN_ORDER.map((id) => <span key={id}>{agencyPlan(id).name.replace("Partner ", "")}</span>)}
              </div>
              {rows.map((row) => (
                <div className="ag-compare__row" key={row.label}>
                  <span>{row.label}</span>
                  {row.values.map((value, index) => (
                    <span key={index} className={value === "—" ? "is-muted" : ""}>{value}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section-mkt">
          <div className="wrap" style={{ maxWidth: 880 }}>
            <div className="section-mkt__head" style={{ textAlign: "center", marginInline: "auto" }}>
              <h2>{t.faqTitle}</h2>
            </div>
            <div className="faq-list">
              {faqs.map(([q, a]) => (
                <details className="faq-item" key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="ag-price-cta">
          <div className="wrap">
            <h2>{t.finalTitle}</h2>
            <p>{t.finalSub}</p>
            <div className="ag-price-cta__actions">
              <Link className="ui-btn ui-btn--accent ui-btn--lg" href={base}>{t.ctaStart}</Link>
              <Link className="ui-btn ui-btn--ghost ui-btn--lg" href={`/${locale}/contact`}>{t.ctaContact}</Link>
            </div>
            <Link className="ag-inline-link" href={`/${locale}/agency`}>
              <Icon name="arrowLeft" size="xs" /> {t.nav}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} dict={dict} />
    </>
  );
}
