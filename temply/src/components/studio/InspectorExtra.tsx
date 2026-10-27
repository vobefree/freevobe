"use client";

import type { ReactNode } from "react";
import type { Dict } from "@/lib/i18n";
import type { Locale, Section } from "@/lib/theme/types";
import { Field, Segmented, Slider, TextArea, TextInput } from "./controls";
import { Icon, type IconName } from "@/components/Icon";

type Patch = (values: Record<string, unknown>) => void;

const LABELS: Record<
  Locale,
  {
    source: string;
    customers: string;
    badges: string;
    icon: string;
    shipping: string;
    returns: string;
    quantity: string;
    discount: string;
    tier: string;
    note: string;
    size: string;
    chest: string;
    length: string;
    sleeve: string;
    caption: string;
    author: string;
    handle: string;
    image: string;
  }
> = {
  sv: {
    source: "Källa",
    customers: "Kunder",
    badges: "Trygghetsmärken",
    icon: "Ikon",
    shipping: "Leverans",
    returns: "Retur",
    quantity: "Antal",
    discount: "Rabatt",
    tier: "Etikett",
    note: "Notis",
    size: "Storlek",
    chest: "Byst",
    length: "Längd",
    sleeve: "Ärm",
    caption: "Bildtext",
    author: "Namn",
    handle: "Konto",
    image: "Bildadress (valfri)",
  },
  nb: {
    source: "Kilde",
    customers: "Kunder",
    badges: "Trygghetsmerker",
    icon: "Ikon",
    shipping: "Levering",
    returns: "Retur",
    quantity: "Antall",
    discount: "Rabatt",
    tier: "Etikett",
    note: "Notis",
    size: "Størrelse",
    chest: "Bryst",
    length: "Lengde",
    sleeve: "Erme",
    caption: "Bildetekst",
    author: "Navn",
    handle: "Konto",
    image: "Bildeadresse (valgfri)",
  },
  fi: {
    source: "Lähde",
    customers: "Asiakkaat",
    badges: "Luottamusmerkit",
    icon: "Kuvake",
    shipping: "Toimitus",
    returns: "Palautus",
    quantity: "Määrä",
    discount: "Alennus",
    tier: "Tunniste",
    note: "Huomautus",
    size: "Koko",
    chest: "Rinta",
    length: "Pituus",
    sleeve: "Hiha",
    caption: "Kuvateksti",
    author: "Nimi",
    handle: "Tili",
    image: "Kuvaosoite (valinnainen)",
  },
  da: {
    source: "Kilde",
    customers: "Kunder",
    badges: "Tryghedsmærker",
    icon: "Ikon",
    shipping: "Levering",
    returns: "Retur",
    quantity: "Antal",
    discount: "Rabat",
    tier: "Etiket",
    note: "Note",
    size: "Størrelse",
    chest: "Bryst",
    length: "Længde",
    sleeve: "Ærme",
    caption: "Billedtekst",
    author: "Navn",
    handle: "Konto",
    image: "Billedadresse (valgfri)",
  },
  en: {
    source: "Source",
    customers: "Customers",
    badges: "Trust badges",
    icon: "Icon",
    shipping: "Shipping",
    returns: "Returns",
    quantity: "Quantity",
    discount: "Discount",
    tier: "Label",
    note: "Note",
    size: "Size",
    chest: "Chest",
    length: "Length",
    sleeve: "Sleeve",
    caption: "Caption",
    author: "Name",
    handle: "Handle",
    image: "Image URL (optional)",
  },
  fr: {
    source: "Source",
    customers: "Clients",
    badges: "Badges de confiance",
    icon: "Icône",
    shipping: "Livraison",
    returns: "Retours",
    quantity: "Quantité",
    discount: "Remise",
    tier: "Libellé",
    note: "Note",
    size: "Taille",
    chest: "Poitrine",
    length: "Longueur",
    sleeve: "Manche",
    caption: "Légende",
    author: "Nom",
    handle: "Compte",
    image: "URL de l'image (optionnel)",
  },
  de: {
    source: "Quelle",
    customers: "Kunden",
    badges: "Vertrauens-Badges",
    icon: "Symbol",
    shipping: "Versand",
    returns: "Rückgabe",
    quantity: "Menge",
    discount: "Rabatt",
    tier: "Label",
    note: "Hinweis",
    size: "Größe",
    chest: "Brust",
    length: "Länge",
    sleeve: "Ärmel",
    caption: "Bildtext",
    author: "Name",
    handle: "Konto",
    image: "Bildadresse (optional)",
  },
  es: {
    source: "Origen",
    customers: "Clientes",
    badges: "Sellos de confianza",
    icon: "Icono",
    shipping: "Envío",
    returns: "Devoluciones",
    quantity: "Cantidad",
    discount: "Descuento",
    tier: "Etiqueta",
    note: "Nota",
    size: "Talla",
    chest: "Pecho",
    length: "Largo",
    sleeve: "Manga",
    caption: "Leyenda",
    author: "Nombre",
    handle: "Cuenta",
    image: "URL de imagen (opcional)",
  },
};

const ICON_OPTIONS: { value: string; label: ReactNode }[] = ([
  { value: "truck", name: "truck" },
  { value: "shield", name: "shield" },
  { value: "hand", name: "heart" },
  { value: "star", name: "star" },
] as { value: string; name: IconName }[]).map((option) => ({ value: option.value, label: <Icon name={option.name} size="sm" /> }));

/** Redigering för de nyare sektionstyperna (UGC, trygghet, mängdrabatt, storleksguide). */
export function InspectorExtra({ section, patch, dict, locale }: { section: Section; patch: Patch; dict: Dict; locale: Locale }) {
  const l = LABELS[locale] ?? LABELS.en;
  const newId = () => Math.random().toString(36).slice(2, 8);
  const removeBtn = (onClick: () => void) => (
    <button className="layer__eye" type="button" style={{ marginTop: 4 }} onClick={onClick}>
      {dict.studio.removeItem}
    </button>
  );

  if (section.type === "ugc") {
    return (
      <div className="panel-section">
        <Field label={dict.studio.headline}>
          <TextInput value={section.title} onChange={(value) => patch({ title: value })} />
        </Field>
        <Field label={dict.studio.heroSub}>
          <TextInput value={section.subtitle} onChange={(value) => patch({ subtitle: value })} />
        </Field>
        <Field label={l.source}>
          <Segmented
            value={section.source}
            options={[
              { value: "instagram", label: "Instagram" },
              { value: "tiktok", label: "TikTok" },
              { value: "customers", label: l.customers },
            ]}
            onChange={(value) => patch({ source: value })}
          />
        </Field>
        <div className="panel-title" style={{ marginTop: 12 }}>{dict.studio.items}</div>
        {section.items.map((item, index) => (
          <div key={item.id} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: 8, marginBottom: 8 }}>
            <TextInput
              value={item.image}
              placeholder={l.image}
              onChange={(value) => patch({ items: section.items.map((it, i) => (i === index ? { ...it, image: value } : it)) })}
            />
            <div style={{ height: 6 }} />
            <TextArea
              value={item.caption}
              rows={2}
              onChange={(value) => patch({ items: section.items.map((it, i) => (i === index ? { ...it, caption: value } : it)) })}
            />
            <div style={{ height: 6 }} />
            <div className="field-row">
              <TextInput
                value={item.author}
                placeholder={l.author}
                onChange={(value) => patch({ items: section.items.map((it, i) => (i === index ? { ...it, author: value } : it)) })}
              />
              <TextInput
                value={item.handle}
                placeholder={l.handle}
                onChange={(value) => patch({ items: section.items.map((it, i) => (i === index ? { ...it, handle: value } : it)) })}
              />
            </div>
            {removeBtn(() => patch({ items: section.items.filter((_, i) => i !== index) }))}
          </div>
        ))}
        <button
          className="ui-btn ui-btn--ghost ui-btn--sm ui-btn--block"
          type="button"
          onClick={() =>
            patch({
              items: [
                ...section.items,
                { id: `u-${newId()}`, caption: "Ny bildtext", author: "Namn", handle: "@konto", image: "", tone: Math.ceil(Math.random() * 4) },
              ],
            })
          }
        >
          <Icon name="plus" size="sm" /> {dict.studio.addItem}
        </button>
      </div>
    );
  }

  if (section.type === "trust") {
    return (
      <div className="panel-section">
        <Field label={dict.studio.headline}>
          <TextInput value={section.title} onChange={(value) => patch({ title: value })} />
        </Field>
        <div className="panel-title" style={{ marginTop: 12 }}>{l.badges}</div>
        {section.badges.map((badge, index) => (
          <div key={badge.id} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: 8, marginBottom: 8 }}>
            <TextInput
              value={badge.title}
              placeholder={dict.studio.headline}
              onChange={(value) => patch({ badges: section.badges.map((b, i) => (i === index ? { ...b, title: value } : b)) })}
            />
            <div style={{ height: 6 }} />
            <TextInput
              value={badge.text}
              placeholder={dict.studio.bodyText}
              onChange={(value) => patch({ badges: section.badges.map((b, i) => (i === index ? { ...b, text: value } : b)) })}
            />
            <div style={{ height: 6 }} />
            <Field label={l.icon}>
              <Segmented
                value={badge.icon}
                options={ICON_OPTIONS}
                onChange={(value) => patch({ badges: section.badges.map((b, i) => (i === index ? { ...b, icon: value } : b)) })}
              />
            </Field>
            {removeBtn(() => patch({ badges: section.badges.filter((_, i) => i !== index) }))}
          </div>
        ))}
        <button
          className="ui-btn ui-btn--ghost ui-btn--sm ui-btn--block"
          type="button"
          onClick={() =>
            patch({ badges: [...section.badges, { id: `b-${newId()}`, icon: "star", title: "Nytt märke", text: "Kort beskrivning" }] })
          }
        >
          <Icon name="plus" size="sm" /> {dict.studio.addItem}
        </button>
        <Field label={l.shipping}>
          <TextInput value={section.shipping} onChange={(value) => patch({ shipping: value })} />
        </Field>
        <Field label={l.returns}>
          <TextInput value={section.returns} onChange={(value) => patch({ returns: value })} />
        </Field>
      </div>
    );
  }

  if (section.type === "bundle") {
    return (
      <div className="panel-section">
        <Field label={dict.studio.headline}>
          <TextInput value={section.title} onChange={(value) => patch({ title: value })} />
        </Field>
        <Field label={dict.studio.heroSub}>
          <TextInput value={section.subtitle} onChange={(value) => patch({ subtitle: value })} />
        </Field>
        <div className="panel-title" style={{ marginTop: 12 }}>{dict.studio.items}</div>
        {section.tiers.map((tier, index) => (
          <div key={tier.id} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: 8, marginBottom: 8 }}>
            <TextInput
              value={tier.label}
              placeholder={l.tier}
              onChange={(value) => patch({ tiers: section.tiers.map((t, i) => (i === index ? { ...t, label: value } : t)) })}
            />
            <Slider
              label={l.quantity}
              value={tier.quantity}
              min={1}
              max={6}
              step={1}
              unit="×"
              onChange={(value) => patch({ tiers: section.tiers.map((t, i) => (i === index ? { ...t, quantity: Math.round(value) } : t)) })}
            />
            <Slider
              label={l.discount}
              value={tier.discount}
              min={0}
              max={50}
              step={1}
              unit="%"
              onChange={(value) => patch({ tiers: section.tiers.map((t, i) => (i === index ? { ...t, discount: Math.round(value) } : t)) })}
            />
            {removeBtn(() => patch({ tiers: section.tiers.filter((_, i) => i !== index) }))}
          </div>
        ))}
        <button
          className="ui-btn ui-btn--ghost ui-btn--sm ui-btn--block"
          type="button"
          onClick={() =>
            patch({
              tiers: [...section.tiers, { id: `t-${newId()}`, quantity: Math.min(6, section.tiers.length + 2), discount: 10, label: "Ny nivå" }],
            })
          }
        >
          <Icon name="plus" size="sm" /> {dict.studio.addItem}
        </button>
      </div>
    );
  }

  if (section.type === "sizeGuide") {
    return (
      <div className="panel-section">
        <Field label={dict.studio.headline}>
          <TextInput value={section.title} onChange={(value) => patch({ title: value })} />
        </Field>
        <Field label={l.note}>
          <TextInput value={section.note} onChange={(value) => patch({ note: value })} />
        </Field>
        <div className="panel-title" style={{ marginTop: 12 }}>{dict.studio.items}</div>
        {section.rows.map((row, index) => (
          <div key={row.id} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: 8, marginBottom: 8 }}>
            <div className="field-row">
              <TextInput
                value={row.size}
                placeholder={l.size}
                onChange={(value) => patch({ rows: section.rows.map((r, i) => (i === index ? { ...r, size: value } : r)) })}
              />
              <TextInput
                value={row.chest}
                placeholder={l.chest}
                onChange={(value) => patch({ rows: section.rows.map((r, i) => (i === index ? { ...r, chest: value } : r)) })}
              />
            </div>
            <div style={{ height: 6 }} />
            <div className="field-row">
              <TextInput
                value={row.length}
                placeholder={l.length}
                onChange={(value) => patch({ rows: section.rows.map((r, i) => (i === index ? { ...r, length: value } : r)) })}
              />
              <TextInput
                value={row.sleeve}
                placeholder={l.sleeve}
                onChange={(value) => patch({ rows: section.rows.map((r, i) => (i === index ? { ...r, sleeve: value } : r)) })}
              />
            </div>
            {removeBtn(() => patch({ rows: section.rows.filter((_, i) => i !== index) }))}
          </div>
        ))}
        <button
          className="ui-btn ui-btn--ghost ui-btn--sm ui-btn--block"
          type="button"
          onClick={() => patch({ rows: [...section.rows, { id: `r-${newId()}`, size: "L", chest: "", length: "", sleeve: "" }] })}
        >
          <Icon name="plus" size="sm" /> {dict.studio.addItem}
        </button>
      </div>
    );
  }

  return null;
}
