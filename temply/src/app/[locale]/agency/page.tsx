import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { isLocale } from "@/lib/content";
import { getAgencyStrings } from "@/lib/i18n/agency";
import { agencyPlan, AGENCY_PLAN_ORDER } from "@/lib/agency-plans";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { Icon } from "@/components/Icon";
import { dictFor } from "@/lib/content";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = getAgencyStrings(isLocale(locale) ? locale : "sv");
  return { title: `ThemeFold Partner — ${t.heroTitle} ${t.heroAccent}`, description: t.heroSub };
}

const swatches = ["#143328", "#dcf56b", "#ff5a2a", "#f6e6b8", "#9ed3bc"];

export default async function AgencyPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getAgencyStrings(locale);
  const dict = dictFor(locale);
  const user = await getCurrentUser();
  const cta = user ? `/${locale}/agency/workspace` : `/${locale}/signup`;
  const problems = [
    { n: "01", title: t.pain1t, text: t.pain1d },
    { n: "02", title: t.pain2t, text: t.pain2d },
    { n: "03", title: t.pain3t, text: t.pain3d },
  ];
  const flow = [
    { title: t.flow1t, text: t.flow1d },
    { title: t.flow2t, text: t.flow2d },
    { title: t.flow3t, text: t.flow3d },
    { title: t.flow4t, text: t.flow4d },
  ];
  const features: { icon: "grid" | "layers" | "palette" | "eye" | "sparkles" | "shield"; title: string; text: string }[] = [
    { icon: "grid", title: t.f1t, text: t.f1d },
    { icon: "layers", title: t.f2t, text: t.f2d },
    { icon: "palette", title: t.f3t, text: t.f3d },
    { icon: "eye", title: t.f4t, text: t.f4d },
    { icon: "sparkles", title: t.f5t, text: t.f5d },
    { icon: "shield", title: t.f6t, text: t.f6d },
  ];
  const faqs = [
    [t.faq1q, t.faq1a],
    [t.faq2q, t.faq2a],
    [t.faq3q, t.faq3a],
    [t.faq4q, t.faq4a],
  ];

  return (
    <>
      <SiteHeader locale={locale} dict={dict} loggedIn={Boolean(user)} />
      <main className="ag-page">
        <section className="ag-hero">
          <div className="wrap ag-hero__grid">
            <div className="ag-hero__copy">
              <span className="pill ag-pill"><i className="dot" /> {t.heroEyebrow}</span>
              <h1>
                {t.heroTitle}
                <span className="ag-accent"> {t.heroAccent}</span>
              </h1>
              <p className="ag-hero__sub">{t.heroSub}</p>
              <div className="ag-hero__actions">
                <Link className="ui-btn ui-btn--accent ui-btn--lg" href={cta}>
                  {t.ctaPrimary}
                  <Icon name="arrowRight" size="sm" strokeWidth={2.2} />
                </Link>
                <Link className="ui-btn ui-btn--ghost ui-btn--lg" href={`/${locale}/agency/pricing`}>
                  {t.ctaSecondary}
                </Link>
              </div>
              <p className="ag-hero__note">{t.heroNote}</p>
              <div className="ag-stats">
                <div><strong>3–∞</strong><span>{t.stat1}</span></div>
                <div><strong>1</strong><span>{t.stat2}</span></div>
                <div><strong>✓</strong><span>{t.stat3}</span></div>
              </div>
            </div>

            <div className="ag-stage" aria-hidden="true">
              <div className="ag-stage__glow" />
              <div className="ag-console">
                <div className="ag-console__bar">
                  <span className="ag-console__dots"><i /><i /><i /></span>
                  <span className="ag-console__url">partner.themefold.studio</span>
                  <span className="ag-console__live">5 {t.mockProject.toLowerCase()}</span>
                </div>
                <div className="ag-console__body">
                  <div className="ag-console__side">
                    <span className="ag-console__brand">TF<span>partner</span></span>
                    <span className="ag-side-item is-active"><Icon name="grid" size="xs" /> {t.mockProject}</span>
                    <span className="ag-side-item"><Icon name="layers" size="xs" /> {t.mockLibrary}</span>
                    <span className="ag-side-item"><Icon name="eye" size="xs" /> {t.mockReview} <b>2</b></span>
                    <span className="ag-side-item"><Icon name="palette" size="xs" /> {t.mockBrand}</span>
                    <span className="ag-side-item"><Icon name="shield" size="xs" /> {t.mockWhite}</span>
                  </div>
                  <div className="ag-console__main">
                    <div className="ag-console__head">
                      <b>{t.mockTitle}</b>
                      <span className="ag-mini-btn">+</span>
                    </div>
                    {[
                      ["Lera & Sol", "Keramik", "review", "LK"],
                      ["Norr Atelier", "Mode", "approved", "NA"],
                      ["Fjällro", "Friluftsliv", "draft", "FJ"],
                    ].map(([name, client, status, initials]) => (
                      <div className="ag-row" key={name}>
                        <span className={`ag-row__dot ag-row__dot--${status}`} />
                        <span className="ag-row__name"><b>{name}</b><small>{client}</small></span>
                        <span className={`ag-chip ag-chip--${status}`}>
                          {status === "review" ? t.mockReview : status === "approved" ? t.mockApproved : t.statusDraft}
                        </span>
                        <span className="ag-avatar">{initials}</span>
                      </div>
                    ))}
                    <div className="ag-console__review">
                      <div className="ag-console__review-head">
                        <b>{t.mockReview}</b>
                        <span className="ag-chip ag-chip--approved">{t.mockApproved}</span>
                      </div>
                      <p>{t.mockComment}</p>
                      <div className="ag-console__comment">
                        <span className="ag-avatar">EL</span>
                        <span><b>Elin · Lera &amp; Sol</b><small>{t.mockApproved} · 2 min</small></span>
                        <Icon name="check" size="sm" />
                      </div>
                    </div>
                  </div>
                  <div className="ag-console__rail">
                    <div className="ag-rail-card">
                      <small>{t.mockBrand}</small>
                      <div className="ag-swatches">
                        {swatches.map((color) => <i key={color} style={{ background: color }} />)}
                      </div>
                      <div className="ag-type"><b>Aa</b><span>Fraunces<br />Inter</span></div>
                    </div>
                    <div className="ag-rail-card">
                      <small>{t.mockUsage}</small>
                      <div className="ag-meter"><i style={{ width: "61%" }} /></div>
                      <span className="ag-meter__label">61 / 100</span>
                    </div>
                    <div className="ag-rail-card ag-rail-card--dark">
                      <small>{t.mockTeam}</small>
                      <div className="ag-team">
                        <span>LK</span><span>NA</span><span>+2</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <span className="ag-float ag-float--a"><Icon name="store" size="xs" /> {t.mockStore}</span>
              <span className="ag-float ag-float--b"><Icon name="check" size="xs" /> {t.mockApproved}</span>
            </div>
          </div>
        </section>

        <div className="ag-marquee" aria-hidden="true">
          <div>
            {[t.mockLibrary, t.mockReview, t.mockBrand, t.mockWhite, t.mockTeam, t.mockStore, t.mockUsage].map((item) => (
              <span key={item}><i />{item}</span>
            ))}
            {[t.mockLibrary, t.mockReview, t.mockBrand, t.mockWhite, t.mockTeam, t.mockStore, t.mockUsage].map((item) => (
              <span key={`${item}-b`}><i />{item}</span>
            ))}
          </div>
        </div>

        <section className="section-mkt">
          <div className="wrap">
            <div className="section-mkt__head">
              <p className="eyebrow-mkt">{t.painEyebrow}</p>
              <h2>{t.painTitle}</h2>
              <p>{t.painSub}</p>
            </div>
            <div className="ag-pains">
              {problems.map((problem) => (
                <article key={problem.n} className="ag-pain">
                  <span>{problem.n}</span>
                  <h3>{problem.title}</h3>
                  <p>{problem.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section-mkt ag-dark">
          <div className="wrap">
            <div className="section-mkt__head">
              <p className="eyebrow-mkt">{t.flowEyebrow}</p>
              <h2>{t.flowTitle}</h2>
              <p>{t.flowSub}</p>
            </div>
            <div className="ag-flow">
              {flow.map((step, index) => (
                <article key={step.title} className="ag-flow__step">
                  <span className="ag-flow__num">0{index + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                  {index < flow.length - 1 && <i className="ag-flow__line" aria-hidden="true" />}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section-mkt">
          <div className="wrap">
            <div className="section-mkt__head">
              <p className="eyebrow-mkt">{t.featEyebrow}</p>
              <h2>{t.featTitle}</h2>
              <p>{t.featSub}</p>
            </div>
            <div className="ag-features">
              {features.map((feature) => (
                <article key={feature.title} className="ag-feature">
                  <span><Icon name={feature.icon} size="lg" /></span>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section-mkt ag-library">
          <div className="wrap ag-split">
            <div>
              <p className="eyebrow-mkt">{t.libEyebrow}</p>
              <h2>{t.libTitle}</h2>
              <p className="muted">{t.libSub}</p>
              <div className="ag-assets">
                {[
                  ["theme", t.libTheme, "Nord & Form", "#143328"],
                  ["section", t.libSection, "Hero · split", "#ff5a2a"],
                  ["conversion", t.libConversion, "Free shipping bar", "#dcf56b"],
                  ["brand", t.libBrand, "Lera & Sol", "#f6e6b8"],
                ].map(([kind, label, name, color]) => (
                  <div className="ag-asset" key={kind}>
                    <span className="ag-asset__swatch" style={{ background: color }} />
                    <span><small>{label}</small><b>{name}</b></span>
                    <Icon name="check" size="xs" />
                  </div>
                ))}
              </div>
            </div>
            <div className="ag-reuse" aria-hidden="true">
              <div className="ag-reuse__base"><span>BASE</span><b>Nord &amp; Form</b><small>12 sektioner · tokens · Brand DNA</small></div>
              {["Lera & Sol", "Fjällro", "Atelier Norr"].map((name, index) => (
                <div className="ag-reuse__card" key={name} style={{ ["--i" as string]: index }}>
                  <span className="ag-reuse__dot" />
                  <b>{name}</b>
                  <small>{index === 0 ? t.mockReview : index === 1 ? t.mockApproved : t.statusDraft}</small>
                </div>
              ))}
              <div className="ag-reuse__arrow"><Icon name="repeat" size="md" /></div>
            </div>
          </div>
        </section>

        <section className="section-mkt ag-review-block">
          <div className="wrap ag-review">
            <div>
              <p className="eyebrow-mkt">{t.reviewEyebrow}</p>
              <h2>{t.reviewTitle}</h2>
              <p className="muted">{t.reviewSub}</p>
              <div className="ag-review__states">
                <span className="ag-chip ag-chip--review">{t.reviewPending}</span>
                <span className="ag-chip ag-chip--approved">{t.reviewApproved}</span>
                <span className="ag-chip ag-chip--draft">{t.reviewChanges}</span>
              </div>
            </div>
            <div className="ag-thread">
              <div className="ag-thread__head">
                <span className="ag-avatar">EL</span>
                <span><b>Elin · Lera &amp; Sol</b><small>{t.clientPreview}</small></span>
                <span className="ag-chip ag-chip--review">{t.statusReview}</span>
              </div>
              <p className="ag-thread__bubble">{t.mockComment}</p>
              <p className="ag-thread__bubble ag-thread__bubble--alt">“Yes — and keep the serif for the product names.”</p>
              <div className="ag-thread__actions">
                <span className="ui-btn ui-btn--ghost ui-btn--sm">{t.reviewChanges}</span>
                <span className="ui-btn ui-btn--accent ui-btn--sm"><Icon name="check" size="xs" /> {t.reviewApproved}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section-mkt">
          <div className="wrap ag-ai">
            <div>
              <p className="eyebrow-mkt">{t.aiEyebrow}</p>
              <h2>{t.aiTitle}</h2>
              <p className="muted">{t.aiSub}</p>
            </div>
            <div className="ag-ai__grid">
              {AGENCY_PLAN_ORDER.map((id) => {
                const plan = agencyPlan(id);
                return (
                  <div className="ag-ai__card" key={id}>
                    <small>{plan.name}</small>
                    <b>${plan.priceUsd}</b>
                    <span>{plan.aiCopy >= 5000 ? t.aiFairValue : `${plan.aiCopy} ${t.usageCopy.toLowerCase()}`}</span>
                    <span>{plan.aiImages >= 2500 ? t.aiFair : `${plan.aiImages} ${t.usageImages.toLowerCase()}`}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section-mkt" id="plans">
          <div className="wrap">
            <div className="section-mkt__head" style={{ textAlign: "center", marginInline: "auto" }}>
              <p className="eyebrow-mkt">{t.plansEyebrow}</p>
              <h2>{t.plansTitle}</h2>
              <p>{t.plansSub}</p>
            </div>
            <div className="ag-plans">
              {AGENCY_PLAN_ORDER.map((id) => {
                const plan = agencyPlan(id);
                return (
                  <article className={`ag-plan${id === "pro" ? " is-featured" : ""}`} key={id}>
                    {id === "pro" && <span className="ag-plan__badge">MOST POPULAR</span>}
                    <h3>{plan.name}</h3>
                    <div className="ag-plan__price"><strong>${plan.priceUsd}</strong><span>{t.perMonth}</span></div>
                    <p>{id === "starter" ? t.painSub : id === "pro" ? t.featSub : t.flowSub}</p>
                    <ul>
                      <li><Icon name="check" size="sm" /> {plan.projects === Number.POSITIVE_INFINITY ? "∞" : plan.projects} {t.stat1}</li>
                      <li><Icon name="check" size="sm" /> {plan.members === Number.POSITIVE_INFINITY ? "∞" : plan.members} seats</li>
                      <li><Icon name="check" size="sm" /> {t.mockLibrary} · {t.libBrand}</li>
                      <li><Icon name="check" size="sm" /> {plan.aiCopy >= 5000 ? t.aiFairValue : `${plan.aiCopy} AI copy`}</li>
                      {plan.whiteLabel && <li><Icon name="check" size="sm" /> {t.mockWhite}</li>}
                    </ul>
                    <Link className={`ui-btn ui-btn--block ${id === "pro" ? "ui-btn--accent" : "ui-btn--ghost"}`} href={`/${locale}/agency/pricing`}>
                      {t.choose}
                    </Link>
                  </article>
                );
              })}
            </div>
            <div style={{ textAlign: "center", marginTop: 26 }}>
              <Link className="ag-inline-link" href={`/${locale}/agency/pricing`}>
                {t.plansCta} <Icon name="arrowRight" size="xs" />
              </Link>
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

        <section className="section-mkt--tight">
          <div className="wrap">
            <div className="final-cta final-cta--living ag-final">
              <div className="final-cta__aurora" aria-hidden="true">
                <i className="final-cta__blob final-cta__blob--a" />
                <i className="final-cta__blob final-cta__blob--b" />
                <i className="final-cta__blob final-cta__blob--c" />
              </div>
              <div className="final-cta__content">
                <span className="final-cta__eyebrow"><i className="dot" /> {t.heroEyebrow}</span>
                <h2>{t.finalTitle}</h2>
                <p>{t.finalSub}</p>
                <div className="final-cta__actions">
                  <Link className="ui-btn ui-btn--lg final-cta__btn" href={cta}>
                    {t.finalCta}
                    <Icon name="arrowRight" size="sm" strokeWidth={2.2} />
                  </Link>
                  <span className="final-cta__fine">{t.finalFine}</span>
                </div>
              </div>
              <div className="ag-final__stack" aria-hidden="true">
                {["Lera & Sol", "Fjällro", "Norr Atelier"].map((name, index) => (
                  <span key={name} style={{ ["--i" as string]: index }}><i />{name}</span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} dict={dict} />
    </>
  );
}
