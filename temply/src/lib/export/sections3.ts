import type { Section, ThemeConfig } from "@/lib/theme/types";
import { withSchema } from "./sections";

type SchemaSetting = Record<string, unknown>;

const text = (id: string, label: string, def = ""): SchemaSetting => ({ type: "text", id, label, default: def });
const textarea = (id: string, label: string, def = ""): SchemaSetting => ({ type: "textarea", id, label, default: def });
const checkbox = (id: string, label: string, def = true): SchemaSetting => ({ type: "checkbox", id, label, default: def });
const range = (id: string, label: string, min: number, max: number, step: number, def: number, unit = ""): SchemaSetting =>
  ({ type: "range", id, label, min, max, step, unit, default: def });

/** Layoutmotorns gemensamma schema-inställningar: kolumner, format och luft. */
export function layoutSettings(section: Section): SchemaSetting[] {
  return [
    range("columns", "Columns", 2, 6, 1, section.columns ?? 4),
    {
      type: "select",
      id: "ratio",
      label: "Image ratio",
      default: section.ratio ?? "portrait",
      options: [
        { value: "square", label: "Square" },
        { value: "portrait", label: "Portrait" },
        { value: "landscape", label: "Landscape" },
        { value: "wide", label: "Wide" },
      ],
    },
    range("gap", "Inner spacing", 50, 200, 5, Math.round((section.gap ?? 1) * 100), "%"),
    {
      type: "select",
      id: "span",
      label: "Asymmetry",
      default: section.span ?? "even",
      options: [
        { value: "even", label: "Even" },
        { value: "feature", label: "Featured" },
        { value: "mosaic", label: "Mosaic" },
      ],
    },
  ];
}

/**
 * Klasserna hämtas från sektionens egna Shopify-inställningar, så att handlaren
 * kan ändra kolumner och format direkt i temaeditorn.
 */
const LIQUID_LAYOUT_CLASSES =
  "columns-{{ section.settings.columns }} ratio-{{ section.settings.ratio }} gap-{{ section.settings.gap }} span-{{ section.settings.span }}";

export function countdownSection(config: ThemeConfig): string {
  const section = config.sections.find((item) => item.type === "countdown");
  const endsAt = section?.type === "countdown" ? section.endsAt : "";
  const liquid = `
{%- assign ends = section.settings.ends_at | date: "%s" -%}
{%- assign now = 'now' | date: "%s" -%}
<section class="section countdown countdown--{{ section.settings.style }}" data-countdown="{{ section.settings.ends_at }}" data-reveal>
  <div class="container countdown__inner">
    <div class="countdown__copy">
      {%- if section.settings.eyebrow != blank -%}<p class="eyebrow">{{ section.settings.eyebrow }}</p>{%- endif -%}
      <h2>{{ section.settings.title }}</h2>
      {%- if section.settings.text != blank -%}<p>{{ section.settings.text }}</p>{%- endif -%}
    </div>
    <div class="countdown__timer" aria-live="polite">
      <span class="countdown__unit"><b data-unit="days">00</b><i>d</i></span>
      <span class="countdown__unit"><b data-unit="hours">00</b><i>h</i></span>
      <span class="countdown__unit"><b data-unit="minutes">00</b><i>m</i></span>
      <span class="countdown__unit"><b data-unit="seconds">00</b><i>s</i></span>
    </div>
    {%- if section.settings.cta_label != blank -%}
      <a class="btn" href="{{ section.settings.cta_link | default: routes.all_products_collection_url }}">{{ section.settings.cta_label }}</a>
    {%- endif -%}
  </div>
</section>
{%- if ends == blank -%}{%- endif -%}`;
  return withSchema(liquid, {
    name: "Countdown",
    tag: "section",
    settings: [
      text("eyebrow", "Eyebrow", section?.type === "countdown" ? section.eyebrow : ""),
      text("title", "Headline", section?.type === "countdown" ? section.title : ""),
      textarea("text", "Text", section?.type === "countdown" ? section.text : ""),
      text("ends_at", "Ends at", endsAt),
      text("cta_label", "Button label", section?.type === "countdown" ? section.ctaLabel : ""),
      { type: "url", id: "cta_link", label: "Button link" },
      {
        type: "select",
        id: "style",
        label: "Style",
        default: section?.type === "countdown" ? section.style : "band",
        options: [
          { value: "band", label: "Band" },
          { value: "box", label: "Box" },
        ],
      },
    ],
  });
}

export function collectionSection(config: ThemeConfig): string {
  const section = config.sections.find((item) => item.type === "collection");
  const layout = section?.type === "collection" ? section.layout : "grid";
  const liquid = `
<section class="section collection collection--{{ section.settings.layout }} ${LIQUID_LAYOUT_CLASSES}" data-reveal>
  <div class="container">
    <div class="section-head">
      <h2>{{ section.settings.title }}</h2>
      {%- if section.settings.subtitle != blank -%}<p>{{ section.settings.subtitle }}</p>{%- endif -%}
    </div>
    <div class="collection-grid">
      {%- for block in section.blocks -%}
        <a class="collection-tile" href="{{ block.settings.link | default: routes.all_products_collection_url }}" {{ block.shopify_attributes }}>
          <div class="collection-tile__media">
            {%- if block.settings.image != blank -%}
              {{ block.settings.image | image_url: width: 900 | image_tag: loading: 'lazy', alt: block.settings.title | escape }}
            {%- endif -%}
          </div>
          <h3>{{ block.settings.title }}</h3>
          {%- if block.settings.count != blank -%}<span class="collection-tile__count">{{ block.settings.count }}</span>{%- endif -%}
        </a>
      {%- endfor -%}
    </div>
  </div>
</section>`;
  return withSchema(liquid, {
    name: "Categories",
    tag: "section",
    settings: [
      text("title", "Title", section?.type === "collection" ? section.title : ""),
      textarea("subtitle", "Subtitle", section?.type === "collection" ? section.subtitle : ""),
      {
        type: "select",
        id: "layout",
        label: "Layout",
        default: layout,
        options: [
          { value: "grid", label: "Grid" },
          { value: "editorial", label: "Editorial" },
          { value: "mosaic", label: "Mosaic" },
        ],
      },
      ...layoutSettings(section ?? ({ type: "collection", columns: 4 } as Section)),
    ],
    blocks: [{ type: "tile", name: "Category" }],
    max_blocks: 12,
  });
}

export function comparisonSection(config: ThemeConfig): string {
  const section = config.sections.find((item) => item.type === "comparison");
  const liquid = `
<section class="section compare-wrap" data-reveal>
  <div class="container">
    <div class="section-head section-head--center">
      <h2>{{ section.settings.title }}</h2>
      {%- if section.settings.subtitle != blank -%}<p>{{ section.settings.subtitle }}</p>{%- endif -%}
    </div>
    <div class="compare compare--{{ section.settings.variant }} columns-{{ section.settings.columns }}">
      <div class="compare__row compare__row--head">
        <span></span>
        {%- for block in section.blocks -%}
          {%- if block.type == 'plan' -%}
            <span class="compare__plan{% if block.settings.highlight %} is-highlight{% endif %}" {{ block.shopify_attributes }}>
              <b>{{ block.settings.title }}</b>
              <i>{{ block.settings.price }}</i>
            </span>
          {%- endif -%}
        {%- endfor -%}
      </div>
      {%- for block in section.blocks -%}
        {%- if block.type == 'row' -%}
          <div class="compare__row" {{ block.shopify_attributes }}>
            <span class="compare__label">{{ block.settings.label }}</span>
            <span>{{ block.settings.value_1 }}</span>
            <span>{{ block.settings.value_2 }}</span>
            <span>{{ block.settings.value_3 }}</span>
            <span>{{ block.settings.value_4 }}</span>
          </div>
        {%- endif -%}
      {%- endfor -%}
    </div>
    {%- if section.settings.note != blank -%}<p class="hint">{{ section.settings.note }}</p>{%- endif -%}
  </div>
</section>`;
  return withSchema(liquid, {
    name: "Comparison",
    tag: "section",
    settings: [
      text("title", "Title", section?.type === "comparison" ? section.title : ""),
      textarea("subtitle", "Subtitle", section?.type === "comparison" ? section.subtitle : ""),
      textarea("note", "Note", section?.type === "comparison" ? section.note : ""),
      {
        type: "select",
        id: "variant",
        label: "Variant",
        default: section?.variant ?? "table",
        options: [
          { value: "table", label: "Table" },
          { value: "cards", label: "Cards" },
        ],
      },
      ...layoutSettings(section ?? ({ type: "comparison", columns: 3 } as Section)),
    ],
    blocks: [
      { type: "plan", name: "Plan" },
      { type: "row", name: "Row" },
    ],
    max_blocks: 12,
  });
}

export function lookbookSection(config: ThemeConfig): string {
  const section = config.sections.find((item) => item.type === "lookbook");
  const liquid = `
<section class="section lookbook-wrap" data-reveal>
  <div class="container">
    <div class="section-head">
      <h2>{{ section.settings.title }}</h2>
      {%- if section.settings.subtitle != blank -%}<p>{{ section.settings.subtitle }}</p>{%- endif -%}
    </div>
    <div class="lookbook ${LIQUID_LAYOUT_CLASSES}">
      {%- for block in section.blocks -%}
        <figure class="lookbook__item" {{ block.shopify_attributes }}>
          <div class="lookbook__media">
            {%- if block.settings.image != blank -%}
              {{ block.settings.image | image_url: width: 1000 | image_tag: loading: 'lazy', alt: block.settings.caption | escape }}
            {%- endif -%}
            {%- if block.settings.tag != blank -%}<span class="lookbook__tag">{{ block.settings.tag }}</span>{%- endif -%}
          </div>
          <figcaption><span>{{ block.settings.caption }}</span></figcaption>
        </figure>
      {%- endfor -%}
    </div>
  </div>
</section>`;
  return withSchema(liquid, {
    name: "Lookbook",
    tag: "section",
    settings: [
      text("title", "Title", section?.type === "lookbook" ? section.title : ""),
      textarea("subtitle", "Subtitle", section?.type === "lookbook" ? section.subtitle : ""),
      ...layoutSettings(section ?? ({ type: "lookbook", columns: 3 } as Section)),
    ],
    blocks: [{ type: "photo", name: "Photo" }],
    max_blocks: 12,
  });
}

export function completeTheLookSection(config: ThemeConfig): string {
  const section = config.sections.find((item) => item.type === "completeTheLook");
  const liquid = `
<section class="section ctl-wrap" data-reveal>
  <div class="container">
    <div class="section-head">
      <h2>{{ section.settings.title }}</h2>
      {%- if section.settings.subtitle != blank -%}<p>{{ section.settings.subtitle }}</p>{%- endif -%}
    </div>
    <div class="ctl variant-{{ section.settings.variant }} columns-{{ section.settings.columns }}">
      <div class="ctl__hero">
        {%- if section.settings.hero_image != blank -%}
          {{ section.settings.hero_image | image_url: width: 900 | image_tag: loading: 'lazy', alt: section.settings.title | escape }}
        {%- endif -%}
        <span>{{ section.settings.hero_title }}</span>
      </div>
      <div class="ctl__items">
        {%- for block in section.blocks -%}
          {%- if block.type == 'item' -%}
            <div class="ctl__item" {{ block.shopify_attributes }}>
              <span class="ctl__thumb">
                {%- if block.settings.image != blank -%}
                  {{ block.settings.image | image_url: width: 240 | image_tag: loading: 'lazy', alt: block.settings.name | escape }}
                {%- endif -%}
              </span>
              <span>{{ block.settings.name }}</span>
              <b>{{ block.settings.price }}</b>
            </div>
          {%- endif -%}
        {%- endfor -%}
        <div class="ctl__total">
          <b>{{ section.settings.total }}</b>
          <a class="btn" href="{{ routes.cart_url }}">{{ section.settings.cta_label }}</a>
        </div>
      </div>
    </div>
  </div>
</section>`;
  return withSchema(liquid, {
    name: "Complete the look",
    tag: "section",
    settings: [
      text("title", "Title", section?.type === "completeTheLook" ? section.title : ""),
      textarea("subtitle", "Subtitle", section?.type === "completeTheLook" ? section.subtitle : ""),
      text("hero_title", "Main product", section?.type === "completeTheLook" ? section.hero : ""),
      text("total", "Total price", section?.type === "completeTheLook" ? section.total : ""),
      text("cta_label", "Button label", section?.type === "completeTheLook" ? section.ctaLabel : ""),
      { type: "image_picker", id: "hero_image", label: "Main product image" },
      {
        type: "select",
        id: "variant",
        label: "Variant",
        default: section?.variant ?? "bundle",
        options: [
          { value: "bundle", label: "Bundle" },
          { value: "cards", label: "Cards" },
        ],
      },
      ...layoutSettings(section ?? ({ type: "completeTheLook", columns: 4 } as Section)),
    ],
    blocks: [{ type: "item", name: "Product" }],
    max_blocks: 8,
  });
}

export function storySection(config: ThemeConfig): string {
  const section = config.sections.find((item) => item.type === "story");
  const liquid = `
<section class="section story story--{{ section.settings.image_side }} ${LIQUID_LAYOUT_CLASSES}" data-reveal>
  <div class="container story__inner">
    <div class="story__media">
      {%- if section.settings.image != blank -%}
        {{ section.settings.image | image_url: width: 1200 | image_tag: loading: 'lazy', alt: section.settings.title | escape }}
      {%- endif -%}
    </div>
    <div class="story__copy">
      <h2>{{ section.settings.title }}</h2>
      <p>{{ section.settings.text }}</p>
      <div class="story__steps">
        {%- for block in section.blocks -%}
          <div class="story__step" {{ block.shopify_attributes }}>
            <h3>{{ block.settings.title }}</h3>
            <p>{{ block.settings.text }}</p>
          </div>
        {%- endfor -%}
      </div>
    </div>
  </div>
</section>`;
  return withSchema(liquid, {
    name: "Storytelling",
    tag: "section",
    settings: [
      text("title", "Title", section?.type === "story" ? section.title : ""),
      textarea("text", "Text", section?.type === "story" ? section.text : ""),
      { type: "image_picker", id: "image", label: "Image" },
      {
        type: "select",
        id: "image_side",
        label: "Image side",
        default: section?.type === "story" ? section.imageSide : "left",
        options: [
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ],
      },
      ...layoutSettings(section ?? ({ type: "story", columns: 2 } as Section)),
    ],
    blocks: [{ type: "step", name: "Chapter" }],
    max_blocks: 6,
  });
}

/** Mega-meny: kategorier i kolumner, kopplade till butikens menyer. */
export function megaSnippet(config: ThemeConfig): string {
  const mega = config.header.mega;
  if (!mega?.enabled) return `{%- comment -%} Mega menu disabled {%- endcomment -%}`;
  return `<nav class="mega" aria-label="Mega menu" data-columns="${mega.columns}">
  <div class="container mega__inner">
    {%- for link in linklists[section.settings.menu].links -%}
      <div class="mega__group{% if forloop.first %} is-highlight{% endif %}">
        <span class="mega__label">{{ link.title | escape }}</span>
        <ul>
          {%- for child in link.links -%}
            <li><a href="{{ child.url }}">{{ child.title | escape }}</a></li>
          {%- endfor -%}
        </ul>
      </div>
    {%- endfor -%}
  </div>
</nav>`;
}

/** Marknadsväljare: språk och valuta per marknad via Shopify Markets. */
export function marketSwitcherSnippet(): string {
  return `{%- comment -%} Market & currency switcher (Shopify Markets) {%- endcomment -%}
{%- if localization.available_countries.size > 1 -%}
  <div class="market-switcher">
    <form method="post" action="{{ routes.root_url }}localization" accept-charset="UTF-8">
      <input type="hidden" name="form_type" value="localization" />
      <input type="hidden" name="utf8" value="✓" />
      <input type="hidden" name="_method" value="put" />
      <label class="visually-hidden" for="market-country">Marknad</label>
      <select id="market-country" name="country_code" onchange="this.form.submit()">
        {%- for country in localization.available_countries -%}
          <option value="{{ country.iso_code }}" {% if country.iso_code == localization.country.iso_code %}selected{% endif %}>
            {{ country.name }} ({{ country.currency.iso_code }} {{ country.currency.symbol }})
          </option>
        {%- endfor -%}
      </select>
      {%- if localization.available_languages.size > 1 -%}
        <select name="language_code" onchange="this.form.submit()" aria-label="Språk">
          {%- for language in localization.available_languages -%}
            <option value="{{ language.iso_code }}" {% if language.iso_code == localization.language.iso_code %}selected{% endif %}>{{ language.endonym_name }}</option>
          {%- endfor -%}
        </select>
      {%- endif -%}
    </form>
  </div>
{%- endif -%}`;
}
