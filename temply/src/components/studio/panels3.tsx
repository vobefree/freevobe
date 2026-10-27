"use client";

import type { Locale, Market, SectionColumns, SectionRatio, SectionSpan, ThemeConfig } from "@/lib/theme/types";
import { isLocale } from "@/lib/theme/types";
import { LAYOUT_RECIPES, RECIPE_ORDER, applyRecipe, gridPlan, setGlobalGrid } from "@/lib/theme/layout";
import { getLayoutStrings, RECIPE_DESCRIPTIONS, RECIPE_LABELS } from "@/lib/i18n/layout";
import { SECTION_LABELS } from "@/lib/theme/labels";
import { Field, Segmented, Slider, TextInput, Toggle } from "./controls";
import { Icon } from "@/components/Icon";

type Update = (recipe: (config: ThemeConfig) => ThemeConfig) => void;
type Props = { config: ThemeConfig; update: Update; locale: Locale };

const COLUMN_STEPS: SectionColumns[] = [2, 3, 4, 5, 6];

export function LayoutPanel({ config, update, locale }: Props) {
  const t = getLayoutStrings(locale);
  const recipe = LAYOUT_RECIPES[config.layoutRecipe] ?? LAYOUT_RECIPES.boutique;
  const sections = config.sections.filter((section) => section.visible);

  const gridSections = sections.filter((section) => ["productGrid", "collection", "lookbook", "ugc", "completeTheLook", "features", "testimonials"].includes(section.type));
  const currentColumns = (gridSections.find((section) => section.columns)?.columns ?? recipe.columns) as SectionColumns;
  const currentRatio = (gridSections.find((section) => section.ratio)?.ratio ?? recipe.ratio) as SectionRatio;
  const currentSpan = (gridSections.find((section) => section.span)?.span ?? recipe.span) as SectionSpan;

  return (
    <>
      <div className="panel-title">{t.title}</div>
      <p className="hint" style={{ marginBottom: 12 }}>{t.sub}</p>

      <div className="panel-section">
        <div className="panel-title">
          <span>{t.recipe}</span>
          <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>{t.recipeHint}</span>
        </div>
        <div className="recipe-grid">
          {RECIPE_ORDER.map((id) => {
            const item = LAYOUT_RECIPES[id];
            return (
              <button
                key={id}
                type="button"
                className={`recipe-card${config.layoutRecipe === id ? " is-active" : ""}`}
                onClick={() => update((current) => applyRecipe(current, id))}
              >
                <b>{RECIPE_LABELS[id]}</b>
                <span>{RECIPE_DESCRIPTIONS[locale][id]}</span>
                <i className="recipe-card__meta">
                  {item.columns} × {item.plan.length}
                </i>
              </button>
            );
          })}
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-title">{t.density}</div>
        <Segmented
          value={config.layout.density}
          options={[
            { value: "compact", label: locale === "en" ? "Compact" : "Kompakt" },
            { value: "cozy", label: locale === "en" ? "Cozy" : "Bekväm" },
            { value: "airy", label: locale === "en" ? "Airy" : "Luftig" },
          ]}
          onChange={(value) =>
            update((current) => ({
              ...current,
              layout: {
                ...current.layout,
                density: value,
                sectionSpacing: value === "airy" ? 128 : value === "compact" ? 64 : 96,
                gridGap: value === "airy" ? 34 : value === "compact" ? 16 : 24,
              },
            }))
          }
        />
      </div>

      <div className="panel-section">
        <div className="panel-title">{t.columns}</div>
        <Segmented
          value={currentColumns}
          options={COLUMN_STEPS.map((value) => ({ value, label: String(value) }))}
          onChange={(value) => update((current) => setGlobalGrid(current, { columns: value as SectionColumns }))}
        />
        <div className="field-row" style={{ marginTop: 6 }}>
          {COLUMN_STEPS.map((value) => {
            const plan = gridPlan(value);
            return (
              <span key={value} className="hint" style={{ fontSize: 9.5 }}>
                {value}: {plan.tablet}/{plan.mobile}
              </span>
            );
          })}
        </div>
        <p className="hint">{t.variantHint}</p>
        <Slider
          label={t.gap}
          value={Math.round(((gridSections[0]?.gap ?? 1) * 100))}
          min={50}
          max={200}
          step={5}
          unit="%"
          onChange={(value) => update((current) => setGlobalGrid(current, { gap: value / 100 }))}
        />
      </div>

      <div className="panel-section">
        <div className="panel-title">{t.ratio}</div>
        <Segmented
          value={currentRatio}
          options={[
            { value: "square" as SectionRatio, label: t.ratioSquare },
            { value: "portrait" as SectionRatio, label: t.ratioPortrait },
            { value: "landscape" as SectionRatio, label: t.ratioLandscape },
            { value: "wide" as SectionRatio, label: t.ratioWide },
          ]}
          onChange={(value) => update((current) => setGlobalGrid(current, { ratio: value as SectionRatio }))}
        />
        <div className="panel-title" style={{ marginTop: 14 }}>{t.span}</div>
        <Segmented
          value={currentSpan}
          options={[
            { value: "even" as SectionSpan, label: t.spanEven },
            { value: "feature" as SectionSpan, label: t.spanFeature },
            { value: "mosaic" as SectionSpan, label: t.spanMosaic },
          ]}
          onChange={(value) => update((current) => setGlobalGrid(current, { span: value as SectionSpan }))}
        />
      </div>

      <div className="panel-section">
        <div className="panel-title">{t.sections}</div>
        <div className="layout-list">
          {sections.map((section) => (
            <div className="layout-row" key={section.id}>
              <span>{SECTION_LABELS[locale][section.type]}</span>
              <span className="hint">
                {section.columns ?? "—"} · {section.ratio ?? "—"} · {section.variant ?? "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-title">{t.megaTitle}</div>
        <Toggle
          label={t.megaEnable}
          checked={config.header.mega.enabled}
          onChange={(value) => update((current) => ({ ...current, header: { ...current.header, mega: { ...current.header.mega, enabled: value } } }))}
        />
        <p className="hint">{t.megaHint}</p>
        <Field label={t.menuColumns}>
          <Segmented
            value={config.header.mega.columns}
            options={[2, 3, 4].map((value) => ({ value: value as 2 | 3 | 4, label: String(value) }))}
            onChange={(value) => update((current) => ({ ...current, header: { ...current.header, mega: { ...current.header.mega, columns: value as 2 | 3 | 4 } } }))}
          />
        </Field>
        {config.header.mega.groups.map((group, index) => (
          <div className="mega-group" key={group.id}>
            <div className="field-row">
              <TextInput
                value={group.label}
                onChange={(value) =>
                  update((current) => ({
                    ...current,
                    header: {
                      ...current.header,
                      mega: { ...current.header.mega, groups: current.header.mega.groups.map((item, i) => (i === index ? { ...item, label: value } : item)) },
                    },
                  }))
                }
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={t.marketRemove}
                onClick={() =>
                  update((current) => ({
                    ...current,
                    header: { ...current.header, mega: { ...current.header.mega, groups: current.header.mega.groups.filter((_, i) => i !== index) } },
                  }))
                }
              >
                <Icon name="close" size="sm" />
              </button>
            </div>
            <TextInput
              value={group.children.join(", ")}
              onChange={(value) =>
                update((current) => ({
                  ...current,
                  header: {
                    ...current.header,
                    mega: {
                      ...current.header.mega,
                      groups: current.header.mega.groups.map((item, i) =>
                        i === index ? { ...item, children: value.split(",").map((part) => part.trim()).filter(Boolean) } : item,
                      ),
                    },
                  },
                }))
              }
            />
          </div>
        ))}
        <button
          className="ui-btn ui-btn--ghost ui-btn--block"
          type="button"
          onClick={() =>
            update((current) => ({
              ...current,
              header: {
                ...current.header,
                mega: {
                  ...current.header.mega,
                  groups: [
                    ...current.header.mega.groups,
                    { id: `m${current.header.mega.groups.length + 1}-${Math.random().toString(36).slice(2, 5)}`, label: t.megaGroup, children: [], highlight: false },
                  ],
                },
              },
            }))
          }
        >
          {t.megaAddGroup}
        </button>
      </div>
    </>
  );
}

const LOCALES: Locale[] = ["sv", "nb", "fi", "da", "en", "fr", "de", "es"];

export function MarketPanel({ config, update, locale }: Props) {
  const t = getLayoutStrings(locale);
  const markets = config.markets.markets;

  const patchMarket = (id: string, patch: Partial<Market>) =>
    update((current) => ({
      ...current,
      markets: { ...current.markets, markets: current.markets.markets.map((market) => (market.id === id ? { ...market, ...patch } : market)) },
    }));

  return (
    <>
      <div className="panel-title">{t.marketTitle}</div>
      <p className="hint" style={{ marginBottom: 12 }}>{t.marketSub}</p>

      <div className="panel-section">
        <Toggle
          label={t.marketTitle}
          checked={config.markets.enabled}
          onChange={(value) => update((current) => ({ ...current, markets: { ...current.markets, enabled: value } }))}
        />
        <p className="hint">{t.marketHint}</p>
      </div>

      {markets.map((market) => (
        <div className={`market-card${config.markets.activeId === market.id ? " is-active" : ""}`} key={market.id}>
          <div className="market-card__head">
            <button
              type="button"
              className={`pill${config.markets.activeId === market.id ? " is-active" : ""}`}
              onClick={() => update((current) => ({ ...current, markets: { ...current.markets, activeId: market.id } }))}
            >
              {config.markets.activeId === market.id ? t.marketActive : market.label}
            </button>
            <span className="hint">{market.currency}</span>
            {markets.length > 1 && (
              <button
                type="button"
                className="icon-btn"
                aria-label={t.marketRemove}
                onClick={() =>
                  update((current) => {
                    const next = current.markets.markets.filter((item) => item.id !== market.id);
                    return {
                      ...current,
                      markets: {
                        ...current.markets,
                        markets: next,
                        activeId: current.markets.activeId === market.id ? next[0]?.id ?? "" : current.markets.activeId,
                      },
                    };
                  })
                }
              >
                <Icon name="close" size="sm" />
              </button>
            )}
          </div>

          <Field label={t.marketLabel}>
            <TextInput value={market.label} onChange={(value) => patchMarket(market.id, { label: value })} />
          </Field>
          <div className="field-row">
            <Field label={t.marketLocale}>
              <select className="select" value={market.locale} onChange={(event) => (isLocale(event.target.value) ? patchMarket(market.id, { locale: event.target.value }) : null)}>
                {LOCALES.map((code) => (
                  <option key={code} value={code}>{code.toUpperCase()}</option>
                ))}
              </select>
            </Field>
            <Field label={t.marketCurrency}>
              <TextInput value={market.currency} onChange={(value) => patchMarket(market.id, { currency: value })} />
            </Field>
          </div>
          <Field label={t.marketShipping}>
            <TextInput value={market.shipping} onChange={(value) => patchMarket(market.id, { shipping: value })} />
          </Field>
          <Field label={t.marketReturns}>
            <TextInput value={market.returns} onChange={(value) => patchMarket(market.id, { returns: value })} />
          </Field>
          <Field label={t.marketCampaign}>
            <TextInput value={market.campaign} onChange={(value) => patchMarket(market.id, { campaign: value })} />
          </Field>
          <Field label={t.marketHero}>
            <TextInput value={market.heroTitle} onChange={(value) => patchMarket(market.id, { heroTitle: value })} />
          </Field>
        </div>
      ))}

      <div className="panel-section">
        <button
          className="ui-btn ui-btn--ghost ui-btn--block"
          type="button"
          onClick={() =>
            update((current) => {
              const id = `m${current.markets.markets.length + 1}`;
              const base = current.markets.markets[0];
              return {
                ...current,
                markets: {
                  ...current.markets,
                  markets: [
                    ...current.markets.markets,
                    {
                      id,
                      label: `Marknad ${current.markets.markets.length + 1}`,
                      locale,
                      currency: base?.currency ?? "EUR",
                      shipping: base?.shipping ?? "",
                      returns: base?.returns ?? "",
                      campaign: base?.campaign ?? "",
                      heroTitle: "",
                      heroSubtitle: "",
                    },
                  ],
                },
              };
            })
          }
        >
          {t.marketAdd}
        </button>
      </div>
    </>
  );
}
