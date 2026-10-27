"use client";

import { useState } from "react";
import type { Dict } from "@/lib/i18n";
import type { ProStrings } from "@/lib/i18n/pro";
import type { Locale, Section, SectionColumns, SectionRatio, SectionSpan, SectionWidth, ThemeConfig } from "@/lib/theme/types";
import { premiumifySection } from "@/lib/theme/premium";
import { GRID_SECTIONS, defaultColumns, gridPlan, variantOptions } from "@/lib/theme/layout";
import { getLayoutStrings } from "@/lib/i18n/layout";
import { Field, Segmented, Slider, TextArea, TextInput, Toggle } from "./controls";
import { InspectorExtra } from "./InspectorExtra";
import { Icon } from "@/components/Icon";

type Update = (recipe: (config: ThemeConfig) => ThemeConfig) => void;

export function Inspector({
  update,
  dict,
  pro,
  locale,
  section,
  onDelete,
  onDuplicate,
}: {
  config: ThemeConfig;
  update: Update;
  dict: Dict;
  pro: ProStrings;
  locale: Locale;
  section: Section;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const [command, setCommand] = useState("");
  const layout = getLayoutStrings(locale);
  const variants = variantOptions(section.type);
  const isGrid = GRID_SECTIONS.includes(section.type);
  const columns = (section.columns ?? defaultColumns(section.type)) as SectionColumns;
  const plan = gridPlan(columns);
  const patch = (values: Record<string, unknown>) =>
    update((current) => ({
      ...current,
      sections: current.sections.map((item) => (item.id === section.id ? ({ ...item, ...values } as Section) : item)),
    }));

  const newId = () => Math.random().toString(36).slice(2, 8);

  return (
    <div>
      <div className="panel-title">
        <span>{dict.studio.sectionSettings}</span>
        <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>{dict.common.settings}</span>
      </div>

      <div className="panel-section">
        <Toggle label={dict.studio.visible} checked={section.visible} onChange={(value) => patch({ visible: value })} />
      </div>

      {variants.length > 1 && (
        <div className="panel-section">
          <Field label={layout.variant}>
            <div className="variant-grid">
              {variants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  className={`variant-chip${(section.variant ?? variants[0].id) === variant.id ? " is-active" : ""}`}
                  onClick={() => patch({ variant: variant.id })}
                >
                  {variant.label}
                </button>
              ))}
            </div>
          </Field>
          <p className="hint">{layout.variantHint}</p>
        </div>
      )}

      {isGrid && (
        <div className="panel-section">
          <Field label={layout.columns}>
            <Segmented
              value={columns}
              options={([2, 3, 4, 5, 6] as SectionColumns[]).map((value) => ({ value, label: String(value) }))}
              onChange={(value) => patch({ columns: value as SectionColumns })}
            />
          </Field>
          <p className="hint">
            {plan.desktop} → {plan.tablet} → {plan.mobile}
          </p>
          <Field label={layout.ratio}>
            <Segmented
              value={(section.ratio ?? "portrait") as SectionRatio}
              options={[
                { value: "square" as SectionRatio, label: layout.ratioSquare },
                { value: "portrait" as SectionRatio, label: layout.ratioPortrait },
                { value: "landscape" as SectionRatio, label: layout.ratioLandscape },
                { value: "wide" as SectionRatio, label: layout.ratioWide },
              ]}
              onChange={(value) => patch({ ratio: value as SectionRatio })}
            />
          </Field>
          <Field label={layout.span}>
            <Segmented
              value={(section.span ?? "even") as SectionSpan}
              options={[
                { value: "even" as SectionSpan, label: layout.spanEven },
                { value: "feature" as SectionSpan, label: layout.spanFeature },
                { value: "mosaic" as SectionSpan, label: layout.spanMosaic },
              ]}
              onChange={(value) => patch({ span: value as SectionSpan })}
            />
          </Field>
          <Slider
            label={layout.gap}
            value={Math.round((section.gap ?? 1) * 100)}
            min={50}
            max={200}
            step={5}
            unit="%"
            onChange={(value) => patch({ gap: value / 100 })}
          />
        </div>
      )}

      {section.type === "hero" && (
        <div className="panel-section">
          <Field label={dict.studio.bodyText}>
            <TextInput value={section.eyebrow} onChange={(value) => patch({ eyebrow: value })} />
          </Field>
          <Field label={dict.studio.headline}>
            <TextArea value={section.title} rows={2} onChange={(value) => patch({ title: value })} />
          </Field>
          <Field label={dict.studio.subtitle}>
            <TextArea value={section.subtitle} rows={3} onChange={(value) => patch({ subtitle: value })} />
          </Field>
          <div className="field-row">
            <Field label={dict.studio.cta}>
              <TextInput value={section.ctaLabel} onChange={(value) => patch({ ctaLabel: value })} />
            </Field>
            <Field label={dict.studio.secondaryCta}>
              <TextInput value={section.secondaryLabel} onChange={(value) => patch({ secondaryLabel: value })} />
            </Field>
          </div>
          <Field label={dict.studio.layout}>
            <Segmented
              value={section.layout}
              options={[
                { value: "split", label: dict.studio.split },
                { value: "center", label: dict.studio.centered },
                { value: "overlay", label: dict.studio.overlay },
              ]}
              onChange={(value) => patch({ layout: value, align: value === "center" ? "center" : section.align })}
            />
          </Field>
          <Field label={dict.studio.alignment}>
            <Segmented
              value={section.align}
              options={[
                { value: "left", label: dict.studio.left },
                { value: "center", label: dict.studio.centered },
              ]}
              onChange={(value) => patch({ align: value })}
            />
          </Field>
          <Toggle label={dict.studio.showImage} checked={section.showImage} onChange={(value) => patch({ showImage: value })} />
          <Field label={dict.studio.imageUrl}>
            <TextInput value={section.image} onChange={(value) => patch({ image: value })} placeholder="https://…" />
          </Field>
        </div>
      )}

      {section.type === "productGrid" && (
        <div className="panel-section">
          <Field label={dict.studio.headline}>
            <TextInput value={section.title} onChange={(value) => patch({ title: value })} />
          </Field>
          <Field label={dict.studio.subtitle}>
            <TextArea value={section.subtitle} rows={2} onChange={(value) => patch({ subtitle: value })} />
          </Field>
          <Field label={dict.studio.columns}>
            <Segmented
              value={section.columns}
              options={[2, 3, 4].map((value) => ({ value, label: String(value) }))}
              onChange={(value) => patch({ columns: value })}
            />
          </Field>
          <Field label={dict.studio.style}>
            <Segmented
              value={section.style}
              options={[
                { value: "minimal", label: dict.studio.minimal },
                { value: "rounded", label: dict.studio.rounded },
                { value: "cards", label: dict.studio.cards },
              ]}
              onChange={(value) => patch({ style: value })}
            />
          </Field>
          <Toggle label={dict.studio.showPrice} checked={section.showPrice} onChange={(value) => patch({ showPrice: value })} />
          <Toggle label={dict.studio.showRating} checked={section.showRating} onChange={(value) => patch({ showRating: value })} />
        </div>
      )}

      {section.type === "features" && (
        <div className="panel-section">
          <Field label={dict.studio.headline}>
            <TextInput value={section.title} onChange={(value) => patch({ title: value })} />
          </Field>
          <Field label={dict.studio.subtitle}>
            <TextInput value={section.subtitle} onChange={(value) => patch({ subtitle: value })} />
          </Field>
          <div className="panel-title" style={{ marginTop: 12 }}>{dict.studio.items}</div>
          {section.items.map((item, index) => (
            <div key={item.id} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: 8, marginBottom: 8 }}>
              <TextInput value={item.title} onChange={(value) => patch({ items: section.items.map((it, i) => (i === index ? { ...it, title: value } : it)) })} />
              <div style={{ height: 6 }} />
              <TextArea value={item.text} rows={2} onChange={(value) => patch({ items: section.items.map((it, i) => (i === index ? { ...it, text: value } : it)) })} />
              <button className="layer__eye" type="button" style={{ marginTop: 4 }} onClick={() => patch({ items: section.items.filter((_, i) => i !== index) })}>
                {dict.studio.removeItem}
              </button>
            </div>
          ))}
          <button
            className="ui-btn ui-btn--ghost ui-btn--sm ui-btn--block"
            type="button"
            onClick={() => patch({ items: [...section.items, { id: `f-${newId()}`, icon: "star", title: "Ny fördel", text: "Beskriv fördelen." }] })}
          >
            <Icon name="plus" size="sm" /> {dict.studio.addItem}
          </button>
        </div>
      )}

      {section.type === "imageText" && (
        <div className="panel-section">
          <Field label={dict.studio.headline}>
            <TextInput value={section.title} onChange={(value) => patch({ title: value })} />
          </Field>
          <Field label={dict.studio.bodyText}>
            <TextArea value={section.text} rows={4} onChange={(value) => patch({ text: value })} />
          </Field>
          <Field label={dict.studio.cta}>
            <TextInput value={section.ctaLabel} onChange={(value) => patch({ ctaLabel: value })} />
          </Field>
          <Field label={dict.studio.imageSide}>
            <Segmented
              value={section.imageSide}
              options={[
                { value: "left", label: dict.studio.left },
                { value: "right", label: dict.studio.right },
              ]}
              onChange={(value) => patch({ imageSide: value })}
            />
          </Field>
        </div>
      )}

      {section.type === "testimonials" && (
        <div className="panel-section">
          <Field label={dict.studio.headline}>
            <TextInput value={section.title} onChange={(value) => patch({ title: value })} />
          </Field>
          <div className="panel-title" style={{ marginTop: 12 }}>{dict.studio.items}</div>
          {section.items.map((item, index) => (
            <div key={item.id} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: 8, marginBottom: 8 }}>
              <TextArea value={item.quote} rows={2} onChange={(value) => patch({ items: section.items.map((it, i) => (i === index ? { ...it, quote: value } : it)) })} />
              <div style={{ height: 6 }} />
              <div className="field-row">
                <TextInput value={item.author} onChange={(value) => patch({ items: section.items.map((it, i) => (i === index ? { ...it, author: value } : it)) })} />
                <TextInput value={item.role} onChange={(value) => patch({ items: section.items.map((it, i) => (i === index ? { ...it, role: value } : it)) })} />
              </div>
              <button className="layer__eye" type="button" style={{ marginTop: 4 }} onClick={() => patch({ items: section.items.filter((_, i) => i !== index) })}>
                {dict.studio.removeItem}
              </button>
            </div>
          ))}
          <button
            className="ui-btn ui-btn--ghost ui-btn--sm ui-btn--block"
            type="button"
            onClick={() => patch({ items: [...section.items, { id: `t-${newId()}`, quote: "Nöjd kund!", author: "Namn", role: "Ort", rating: 5 }] })}
          >
            <Icon name="plus" size="sm" /> {dict.studio.addItem}
          </button>
        </div>
      )}

      {section.type === "marquee" && (
        <div className="panel-section">
          <Field label={dict.studio.marqueeText}>
            <TextArea value={section.text} rows={3} onChange={(value) => patch({ text: value })} />
          </Field>
          <Slider label={dict.studio.speedLabel} value={section.speed} min={10} max={80} step={2} unit="s" onChange={(value) => patch({ speed: value })} />
          <Field label={dict.studio.style}>
            <Segmented
              value={section.style}
              options={[
                { value: "solid", label: dict.studio.cards },
                { value: "outline", label: dict.studio.minimal },
              ]}
              onChange={(value) => patch({ style: value })}
            />
          </Field>
        </div>
      )}

      {section.type === "faq" && (
        <div className="panel-section">
          <Field label={dict.studio.headline}>
            <TextInput value={section.title} onChange={(value) => patch({ title: value })} />
          </Field>
          <div className="panel-title" style={{ marginTop: 12 }}>{dict.studio.items}</div>
          {section.items.map((item, index) => (
            <div key={item.id} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: 8, marginBottom: 8 }}>
              <TextInput value={item.q} onChange={(value) => patch({ items: section.items.map((it, i) => (i === index ? { ...it, q: value } : it)) })} />
              <div style={{ height: 6 }} />
              <TextArea value={item.a} rows={2} onChange={(value) => patch({ items: section.items.map((it, i) => (i === index ? { ...it, a: value } : it)) })} />
              <button className="layer__eye" type="button" style={{ marginTop: 4 }} onClick={() => patch({ items: section.items.filter((_, i) => i !== index) })}>
                {dict.studio.removeItem}
              </button>
            </div>
          ))}
          <button
            className="ui-btn ui-btn--ghost ui-btn--sm ui-btn--block"
            type="button"
            onClick={() => patch({ items: [...section.items, { id: `q-${newId()}`, q: "Ny fråga?", a: "Nytt svar." }] })}
          >
            <Icon name="plus" size="sm" /> {dict.studio.addItem}
          </button>
        </div>
      )}

      {section.type === "newsletter" && (
        <div className="panel-section">
          <Field label={dict.studio.headline}>
            <TextInput value={section.title} onChange={(value) => patch({ title: value })} />
          </Field>
          <Field label={dict.studio.bodyText}>
            <TextArea value={section.text} rows={3} onChange={(value) => patch({ text: value })} />
          </Field>
          <Field label={dict.studio.cta}>
            <TextInput value={section.ctaLabel} onChange={(value) => patch({ ctaLabel: value })} />
          </Field>
        </div>
      )}

      <InspectorExtra section={section} patch={patch} dict={dict} locale={locale} />

      <div className="panel-section">
        <div className="panel-title">{pro.premiumBtn}</div>
        <div className="field-row">
          <input
            className="input"
            value={command}
            placeholder={`${pro.premiumBtn}: “mer premium”`}
            aria-label={pro.premiumBtn}
            onChange={(event) => setCommand(event.target.value)}
          />
          <button
            className="ui-btn ui-btn--accent ui-btn--sm"
            type="button"
            aria-label={pro.premiumBtn}
            onClick={() => update((current) => premiumifySection(current, section.id, command, locale))}
          >
            <Icon name="sparkles" size="sm" />
          </button>
        </div>
      </div>

      <div className="panel-section">
        <Field label={pro.widthLabel}>
          <Segmented<SectionWidth>
            value={section.width ?? "boxed"}
            options={[
              { value: "narrow", label: pro.widthNarrow },
              { value: "boxed", label: pro.widthBoxed },
              { value: "wide", label: pro.widthWide },
              { value: "full", label: pro.widthFull },
            ]}
            onChange={(value) => patch({ width: value })}
          />
        </Field>
        <Slider
          label={pro.spaceScale}
          value={section.space ?? 1}
          min={0.4}
          max={2}
          step={0.05}
          unit="×"
          onChange={(value) => patch({ space: value })}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" style={{ flex: 1 }} onClick={() => onDuplicate(section.id)}>
          {dict.common.duplicate}
        </button>
        <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={() => onDelete(section.id)} style={{ color: "#a33618" }}>
          {dict.common.delete}
        </button>
      </div>
      <p className="hint" style={{ marginTop: 14 }}>{dict.studio.selectHint}</p>
    </div>
  );
}
