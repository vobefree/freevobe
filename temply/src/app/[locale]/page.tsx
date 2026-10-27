import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { dictFor, isLocale, LOCALES, LOCALE_META, localPrice, type Dict } from "@/lib/content";
import { applyMood, baseTheme } from "@/lib/theme/presets";
import { copyFor } from "@/lib/content";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { PromptStart } from "@/components/marketing/PromptStart";
import { LogoWave } from "@/components/marketing/LogoWave";
import { Icon, type IconName } from "@/components/Icon";
import { ShapePlayground } from "@/components/marketing/ShapePlayground";
import { StepArt } from "@/components/marketing/StepArt";
import { HeroShowcase } from "@/components/marketing/HeroShowcase";
import { FinalCta } from "@/components/marketing/FinalCta";
import { getAgencyStrings } from "@/lib/i18n/agency";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const dict = dictFor(locale);
  return { title: `ThemeFold — ${dict.landing.h1} ${dict.landing.h1Accent}`, description: dict.landing.sub };
}

function Check() {
  return <Icon name="check" size="sm" strokeWidth={2} />;
}

function demoTheme(locale: string) {
  const demo = applyMood(baseTheme(), "warm");
  demo.shape = { ...demo.shape, radius: 22, buttonRadius: 999 };
  const scandinavian = locale === "sv" || locale === "nb" || locale === "da";
  const price = (amount: number) => (locale === "en" ? `$${amount}` : scandinavian ? `${amount * 10} kr` : `${amount} €`);
  const shipping = locale === "en" ? "Free shipping over $79" : scandinavian ? "Fri frakt över 799 kr" : "Free shipping over €79";
  demo.header.announcement = `${shipping} · ${scandinavian ? "Handgjort i Skåne" : "Handmade in Sweden"}`;
  if (!scandinavian) {
    demo.shop.name = "Nord & Form";
    demo.shop.tagline = "Handmade ceramics for everyday rituals.";
    demo.shop.products = demo.shop.products.map((product, index) => ({
      ...product,
      name: ["Morning Mug", "Quiet Vase", "Clay Platter", "Candle No. 2", "Tea Pot Sand", "Water Jug"][index] ?? product.name,
      price: price([49, 79, 89, 55, 129, 99][index] ?? 49),
    }));
    demo.sections = demo.sections.map((section) => {
      if (section.type === "hero") {
        return {
          ...section,
          title: "Objects that last for generations.",
          subtitle: "Handmade ceramics and timeless pieces for the home. Small batches, endless care.",
          eyebrow: "Made in Sweden",
        };
      }
      if (section.type === "productGrid") return { ...section, title: "Chosen right now", subtitle: "Seasonal favourites, made to be used every day." };
      return section;
    });
  }
  return demo;
}

export default async function LandingPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict: Dict = dictFor(locale);
  const user = await getCurrentUser();
  const loggedIn = Boolean(user);
  const demo = demoTheme(locale);
  const price = localPrice(locale);
  const copy = copyFor(locale);
  const agency = getAgencyStrings(locale);

  const features: { icon: IconName; bg: string; title: string; text: string }[] = [
    { icon: "contrast", bg: "bg-1", title: dict.landing.f1t, text: dict.landing.f1d },
    { icon: "type", bg: "bg-2", title: dict.landing.f2t, text: dict.landing.f2d },
    { icon: "frame", bg: "bg-3", title: dict.landing.f3t, text: dict.landing.f3d },
    { icon: "moveVertical", bg: "bg-4", title: dict.landing.f4t, text: dict.landing.f4d },
    { icon: "edit", bg: "bg-5", title: dict.landing.f5t, text: dict.landing.f5d },
    { icon: "zap", bg: "bg-6", title: dict.landing.f6t, text: dict.landing.f6d },
  ];

  const steps = [
    { title: dict.landing.st1t, text: dict.landing.st1d },
    { title: dict.landing.st2t, text: dict.landing.st2d },
    { title: dict.landing.st3t, text: dict.landing.st3d },
  ];

  const faqs = [
    [dict.landing.faq1q, dict.landing.faq1a],
    [dict.landing.faq2q, dict.landing.faq2a],
    [dict.landing.faq3q, dict.landing.faq3a],
    [dict.landing.faq4q, dict.landing.faq4a],
  ];

  return (
    <>
      <SiteHeader locale={locale} dict={dict} loggedIn={loggedIn} />
      <main>
        <section className="mkt-hero">
          <div className="wrap mkt-hero__grid">
            <div>
              <span className="pill">
                <i className="dot" /> {dict.landing.badge}
              </span>
              <h1 style={{ marginTop: 22 }}>
                {dict.landing.h1} <span className="accent">{dict.landing.h1Accent}</span>
              </h1>
              <p className="mkt-hero__sub">{dict.landing.sub}</p>
              <PromptStart locale={locale} dict={dict} loggedIn={loggedIn} />
              <div className="trust">
                <span><Check /> {dict.landing.trust}</span>
              </div>
              <div className="hero-stats">
                <div className="hero-stat"><strong>{dict.landing.s1v}</strong><span>{dict.landing.s1l}</span></div>
                <div className="hero-stat"><strong>{dict.landing.s2v}</strong><span>{dict.landing.s2l}</span></div>
                <div className="hero-stat"><strong>{dict.landing.s3v}</strong><span>{dict.landing.s3l}</span></div>
              </div>
            </div>

            <div className="preview-stage">
              <div className="preview-stage__glow" />
              <HeroShowcase
                demo={demo}
                locale={locale}
                labels={{ saved: dict.common.saved }}
              />
              <div className="preview-badge preview-badge--a">
                <span style={{ width: 22, height: 22, borderRadius: 7, background: "#FF5A2A", display: "grid", placeItems: "center", color: "#fff", fontSize: 11 }}>Aa</span>
                <span><strong>A+</strong><br /><span style={{ color: "#6c6659" }}>{dict.studio.quickType}</span></span>
              </div>
              <div className="preview-badge preview-badge--b">
                <span style={{ width: 22, height: 22, borderRadius: 7, border: "1.5px solid #131310", display: "grid", placeItems: "center" }}>
                  <Icon name="frame" size="xs" tone="ink" />
                </span>
                <span><strong>{demo.shape.radius}px</strong><br /><span style={{ color: "#6c6659" }}>{dict.studio.quickShape}</span></span>
              </div>
            </div>
          </div>
        </section>

        <LogoWave note={copy.trademark} />

        <section className="section-mkt--tight">
          <div className="wrap">
            <div className="lang-strip">
              {LOCALES.map((code) => (
                <Link
                  key={code}
                  className={`lang-strip__item${code === locale ? " is-active" : ""}`}
                  href={`/${code}`}
                  aria-current={code === locale ? "true" : undefined}
                >
                  <span>
                    <b>{LOCALE_META[code].name}</b>
                    <small>{LOCALE_META[code].stripPrice}</small>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="section-mkt" id="how">
          <div className="wrap">
            <div className="section-mkt__head">
              <p className="eyebrow-mkt">{dict.landing.stepsEyebrow}</p>
              <h2>{dict.landing.stepsTitle}</h2>
              <p>{dict.landing.stepsSub}</p>
            </div>
            <div className="steps">
              {steps.map((step, index) => (
                <article className="step-card" key={step.title}>
                  <StepArt step={(index + 1) as 1 | 2 | 3} />
                  <div className="step-card__body">
                    <div className="step-card__num">0{index + 1}</div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section-mkt" id="features">
          <div className="wrap">
            <div className="section-mkt__head">
              <p className="eyebrow-mkt">{dict.landing.featuresEyebrow}</p>
              <h2>{dict.landing.featuresTitle}</h2>
              <p>{dict.landing.featuresSub}</p>
            </div>
            <div className="feature-grid">
              {features.map((feature) => (
                <article className="feature-card" key={feature.title}>
                  <span className={`feature-card__icon ${feature.bg}`}>
                    <Icon name={feature.icon} size="lg" />
                  </span>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section-mkt">
          <div className="wrap easy-grid">
            <div>
              <p className="eyebrow-mkt">{dict.landing.easyEyebrow}</p>
              <h2>{dict.landing.easyTitle}</h2>
              <p className="muted" style={{ marginTop: 16, maxWidth: "32rem" }}>{dict.landing.easySub}</p>
              <ul className="easy-list">
                {[dict.landing.e1, dict.landing.e2, dict.landing.e3].map((item) => (
                  <li key={item}>
                    <span className="easy-check"><Check /></span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 28 }}>
                <Link className="ui-btn ui-btn--accent ui-btn--lg" href={`/${locale}/signup`}>{dict.landing.easyCta}</Link>
              </div>
            </div>
            <ShapePlayground dict={dict} />
          </div>
        </section>

        <section className="section-mkt" id="pricing">
          <div className="wrap">
            <div className="section-mkt__head" style={{ textAlign: "center", marginInline: "auto" }}>
              <p className="eyebrow-mkt">{dict.landing.priceEyebrow}</p>
              <h2>{dict.landing.priceTitle}</h2>
              <p>{dict.landing.priceSub}</p>
            </div>
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
                <div style={{ marginTop: 24, display: "grid", gap: 9 }}>
                  <Link className="ui-btn ui-btn--accent ui-btn--lg ui-btn--block" href={`/${locale}/signup`}>{dict.landing.priceCta}</Link>
                  <span className="muted" style={{ fontSize: 11.5, textAlign: "center" }}>{dict.landing.noCard} · {dict.landing.cancelAnytime}</span>
                </div>
              </div>
              <div className="pricing-card__side">
                <p className="eyebrow-mkt" style={{ marginBottom: 10 }}>{dict.landing.featuresEyebrow}</p>
                <div className="price-features">
                  {dict.landing.priceFeatures.map((feature) => (
                    <div key={feature}><Check /> {feature}</div>
                  ))}
                </div>
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16, fontSize: 12 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <strong>{LOCALE_META[locale].price}</strong>
                    <span className="muted">· {LOCALE_META[locale].name}</span>
                  </div>
                  <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                    {dict.landing.langsSub}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-mkt">
          <div className="wrap">
            <div className="section-mkt__head" style={{ textAlign: "center", marginInline: "auto" }}>
              <h2>{dict.landing.faqTitle}</h2>
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

        <section className="section-mkt--tight">
          <div className="wrap">
            <div className="ag-teaser">
              <span className="ag-teaser__stamp">partner</span>
              <div className="ag-teaser__copy">
                <span className="ag-teaser__eyebrow"><i /> {agency.teaserEyebrow}</span>
                <h3>{agency.teaserTitle}</h3>
                <p>{agency.teaserText}</p>
              </div>
              <div className="ag-teaser__side">
                <div className="ag-teaser__facts">
                  <span><b>3–∞</b><small>{agency.stat1}</small></span>
                  <span><b>1</b><small>{agency.stat2}</small></span>
                  <span><b>0</b><small>{locale === "sv" ? "mejltrådar" : "email threads"}</small></span>
                </div>
                <Link className="ag-inline-link" href={`/${locale}/agency`}>
                  {agency.teaserCta} <Icon name="arrowRight" size="xs" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="section-mkt--tight">
          <div className="wrap">
            <FinalCta dict={dict} href={`/${locale}/signup`} />
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} dict={dict} />
    </>
  );
}
