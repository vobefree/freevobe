import type { ThemeConfig } from "@/lib/theme/types";
import { EXPORT_ICON_OPTIONS } from "./icons";

type SchemaSetting = Record<string, unknown>;

export function withSchema(liquid: string, schema: Record<string, unknown>): string {
  return `${liquid.trim()}\n\n{% schema %}\n${JSON.stringify(schema, null, 2)}\n{% endschema %}\n`;
}

function textarea(id: string, label: string, def = ""): SchemaSetting {
  return { type: "textarea", id, label, default: def };
}
function text(id: string, label: string, def = ""): SchemaSetting {
  return { type: "text", id, label, default: def };
}
function checkbox(id: string, label: string, def = true): SchemaSetting {
  return { type: "checkbox", id, label, default: def };
}
function range(id: string, label: string, min: number, max: number, step: number, def: number, unit = "px"): SchemaSetting {
  return { type: "range", id, label, min, max, step, unit, default: def };
}

export function headerSection(config: ThemeConfig): string {
  const liquid = `
{%- if section.settings.announcement != blank -%}
  <div class="announcement">{{ section.settings.announcement | escape }}</div>
{%- endif -%}
<header class="site-header{% if section.settings.sticky %} site-header--sticky{% endif %}">
  <div class="container header__inner header__inner--{{ section.settings.actions_position | default: 'right' }}">
    <a class="header__logo" href="{{ routes.root_url }}">{{ section.settings.logo_text | default: shop.name | escape }}</a>
    <nav class="header__nav" aria-label="Main menu">
      {%- for link in section.settings.menu.links -%}
        <a href="{{ link.url }}">{{ link.title | escape }}</a>
      {%- endfor -%}
    </nav>
    <div class="header__actions header__actions--{{ section.settings.actions_position | default: 'right' }}">
      {%- if section.settings.show_search -%}
        <a class="header__action" href="{{ routes.search_url }}" aria-label="{{ 'general.search' | t | default: 'Search' }}">
          {% render 'icon', name: 'search' %}
        </a>
      {%- endif -%}
      {%- if section.settings.show_cart -%}
        <a class="header__action" href="{{ routes.cart_url }}" aria-label="{{ 'general.cart' | t | default: 'Cart' }}">
          {% render 'icon', name: 'cart' %}
          <span class="header__cart-count">{{ cart.item_count }}</span>
        </a>
      {%- endif -%}
    </div>
  </div>
</header>`;
  return withSchema(liquid, {
    name: "Header",
    class: "section-header",
    settings: [
      text("logo_text", "Logo text", config.header.logoText || config.shop.name),
      { type: "link_list", id: "menu", label: "Menu", default: "main-menu" },
      checkbox("show_search", "Show search", config.header.showSearch),
      checkbox("show_cart", "Show cart", config.header.showCart),
      { type: "select", id: "actions_position", label: "Search & cart position", default: config.header.actionsPosition ?? "right", options: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }] },
      checkbox("sticky", "Sticky header", config.header.sticky),
      text("announcement", "Announcement bar", config.header.announcement),
    ],
  });
}

export function footerSection(config: ThemeConfig): string {
  const liquid = `
<footer class="site-footer">
  <div class="container footer__grid">
    <div>
      <p class="footer__brand">{{ section.settings.brand | default: shop.name | escape }}</p>
      <p class="footer__about">{{ section.settings.text | escape }}</p>
    </div>
    {%- for block in section.blocks -%}
      {%- if block.type == 'menu' or block.type == 'menu_2' or block.type == 'menu_3' -%}
        <div class="footer__col" {{ block.shopify_attributes }}>
          <h4>{{ block.settings.title | escape }}</h4>
          {%- for link in block.settings.menu.links -%}
            <a href="{{ link.url }}">{{ link.title | escape }}</a>
          {%- endfor -%}
        </div>
      {%- endif -%}
    {%- endfor -%}
  </div>
  <div class="container footer__integrations">
    {% render 'integration-newsletter' %}
    {%- for block in section.blocks -%}
      {%- if block.type == '@app' -%}<div class="app-block" {{ block.shopify_attributes }}>{% render block %}</div>{%- endif -%}
    {%- endfor -%}
    {% render 'integration-payments' %}
  </div>
  <div class="container footer__bottom">
    <p>&copy; {{ 'now' | date: '%Y' }} {{ shop.name }} &middot; Powered by Shopify</p>
    <div class="footer__social"><span>{{ section.settings.social | escape }}</span></div>
  </div>
  <div class="container markets">
    {% render 'markets' %}
    {%- if settings.klaviyo and settings.klaviyo_company_id != blank -%}
      <p class="markets__note">Nyhetsbrev via Klaviyo</p>
    {%- endif -%}
  </div>
</footer>`;
  return withSchema(liquid, {
    name: "Footer",
    settings: [
      text("brand", "Brand name", config.shop.name),
      textarea("text", "About text", config.footer.text),
      text("social", "Social links", config.footer.social.join(" · ")),
    ],
    blocks: [
      {
        type: "menu",
        name: "Menu column",
        limit: 3,
        settings: [text("title", "Heading", config.footer.columns[0]?.title ?? "Shop"), { type: "link_list", id: "menu", label: "Menu", default: "footer" }],
      },
      {
        type: "menu_2",
        name: "Menu column 2",
        limit: 3,
        settings: [text("title", "Heading", config.footer.columns[1]?.title ?? "Help"), { type: "link_list", id: "menu", label: "Menu", default: "footer" }],
      },
      {
        type: "menu_3",
        name: "Menu column 3",
        limit: 3,
        settings: [text("title", "Heading", config.footer.columns[2]?.title ?? "About"), { type: "link_list", id: "menu", label: "Menu", default: "footer" }],
      },
      { type: "@app", name: "App" },
    ],
    max_blocks: 8,
    presets: [
      {
        name: "Footer",
        blocks: [{ type: "menu" }, { type: "menu_2" }, { type: "menu_3" }],
      },
    ],
  });
}

export function heroSection(): string {
  const liquid = `
{%- assign layout = section.settings.layout -%}
<section class="hero hero--{{ layout }}{% if section.settings.align == 'center' %} hero--center{% endif %}" data-reveal>
  <div class="container">
    <div class="hero__inner">
      <div class="hero__copy">
        {%- if section.settings.eyebrow != blank -%}<p class="eyebrow">{{ section.settings.eyebrow | escape }}</p>{%- endif -%}
        <h1 class="hero__title" data-hero-title>{{ section.settings.title }}</h1>
        {%- if section.settings.subtitle != blank -%}<p class="hero__sub">{{ section.settings.subtitle }}</p>{%- endif -%}
        <div class="hero__actions">
          {%- if section.settings.cta_label != blank -%}
            <a class="btn" data-hero-cta href="{{ section.settings.cta_url | default: routes.all_products_collection_url }}">{{ section.settings.cta_label | escape }}</a>
          {%- endif -%}
          {%- if section.settings.secondary_label != blank -%}
            <a class="btn btn--secondary" href="{{ section.settings.secondary_url | default: routes.root_url }}">{{ section.settings.secondary_label | escape }}</a>
          {%- endif -%}
        </div>
      </div>
      {%- if section.settings.show_image -%}
        <div class="hero__media">
          {%- if section.settings.image -%}
            {{ section.settings.image | image_url: width: 1400 | image_tag: loading: 'eager', class: 'hero__image', alt: section.settings.title | escape }}
          {%- else -%}
            <div class="hero__placeholder"><span>{{ section.settings.placeholder_caption | default: section.settings.eyebrow | escape }}</span></div>
          {%- endif -%}
        </div>
      {%- endif -%}
    </div>
  </div>
</section>`;
  return withSchema(liquid, {
    name: "Hero",
    settings: [
      text("eyebrow", "Eyebrow", ""),
      textarea("title", "Headline", "Form som håller i generationer."),
      textarea("subtitle", "Subheadline", ""),
      text("cta_label", "Button label", "Handla nu"),
      { type: "url", id: "cta_url", label: "Button link" },
      text("secondary_label", "Secondary button label", ""),
      { type: "url", id: "secondary_url", label: "Secondary button link" },
      { type: "select", id: "layout", label: "Layout", default: "split", options: [{ value: "split", label: "Split" }, { value: "center", label: "Centered" }, { value: "overlay", label: "Overlay" }] },
      { type: "select", id: "align", label: "Text alignment", default: "left", options: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }] },
      checkbox("show_image", "Show image", true),
      { type: "image_picker", id: "image", label: "Image" },
      text("placeholder_caption", "Placeholder caption", ""),
    ],
    presets: [{ name: "Hero" }],
  });
}

export function productGridSection(): string {
  const liquid = `
{%- assign grid_collection = collections[section.settings.collection] -%}
{%- if grid_collection == blank -%}{%- assign grid_collection = collections.all -%}{%- endif -%}
<section class="section columns-{{ section.settings.columns }} ratio-{{ section.settings.ratio }} gap-{{ section.settings.gap }} span-{{ section.settings.span }} variant-{{ section.settings.variant }}" data-reveal>
  <div class="container">
    <div class="section-head{% if section.settings.align == 'center' %} section-head--center{% endif %}">
      {%- if section.settings.title != blank -%}<h2>{{ section.settings.title }}</h2>{%- endif -%}
      {%- if section.settings.subtitle != blank -%}<p>{{ section.settings.subtitle }}</p>{%- endif -%}
    </div>
    <div class="product-grid product-grid--{{ section.settings.style }}">
      {%- if grid_collection.products.size > 0 -%}
        {%- for product in grid_collection.products limit: section.settings.limit -%}
          {% render 'product-card', product: product, show_price: section.settings.show_price, show_rating: section.settings.show_rating, badge: section.settings.badge %}
        {%- endfor -%}
      {%- else -%}
        {%- for i in (1..section.settings.columns) -%}
          <article class="card">
            <div class="card__media"><div class="card__placeholder"></div></div>
            <div class="card__info"><h3 class="card__title">Your product</h3><p class="card__price">Add products in Shopify</p></div>
          </article>
        {%- endfor -%}
      {%- endif -%}
    </div>
    {%- if section.settings.cta_label != blank -%}
      <div class="section-foot"><a class="btn btn--ghost" href="{{ grid_collection.url }}">{{ section.settings.cta_label | escape }}</a></div>
    {%- endif -%}
  </div>
</section>`;
  return withSchema(liquid, {
    name: "Product grid",
    settings: [
      text("title", "Heading", "Utvalt just nu"),
      textarea("subtitle", "Subheading", ""),
      { type: "collection", id: "collection", label: "Collection" },
      { type: "select", id: "style", label: "Card style", default: "rounded", options: [{ value: "minimal", label: "Minimal" }, { value: "rounded", label: "Rounded" }, { value: "cards", label: "Cards" }] },
      range("columns", "Columns", 2, 6, 1, 3, ""),
      range("limit", "Products shown", 2, 12, 1, 8, ""),
      { type: "select", id: "ratio", label: "Image ratio", default: "portrait", options: [{ value: "square", label: "Square" }, { value: "portrait", label: "Portrait" }, { value: "landscape", label: "Landscape" }, { value: "wide", label: "Wide" }] },
      range("gap", "Inner spacing", 50, 200, 5, 100, "%"),
      { type: "select", id: "span", label: "Asymmetry", default: "even", options: [{ value: "even", label: "Even" }, { value: "feature", label: "Featured" }, { value: "mosaic", label: "Mosaic" }] },
      { type: "select", id: "variant", label: "Variant", default: "grid", options: [{ value: "grid", label: "Grid" }, { value: "dense", label: "Dense" }, { value: "deal", label: "Deal" }, { value: "showcase", label: "Showcase" }, { value: "editorial", label: "Editorial" }, { value: "spec", label: "Spec" }] },
      checkbox("show_price", "Show price", true),
      checkbox("show_rating", "Show rating", true),
      text("badge", "Product badge", ""),
      { type: "select", id: "align", label: "Heading alignment", default: "left", options: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }] },
      text("cta_label", "Button label", ""),
    ],
    presets: [{ name: "Product grid" }],
  });
}

export function featuresSection(): string {
  const liquid = `
<section class="section" data-reveal style="--features: {{ section.blocks.size | at_least: 1 }}">
  <div class="container">
    <div class="section-head{% if section.settings.align == 'center' %} section-head--center{% endif %}">
      {%- if section.settings.title != blank -%}<h2>{{ section.settings.title }}</h2>{%- endif -%}
      {%- if section.settings.subtitle != blank -%}<p>{{ section.settings.subtitle }}</p>{%- endif -%}
    </div>
    <div class="features">
      {%- for block in section.blocks -%}
        <div class="feature" {{ block.shopify_attributes }}>
          <span class="feature__icon" aria-hidden="true">{% render 'icon', name: block.settings.icon, size: 22 %}</span>
          <h3>{{ block.settings.title | escape }}</h3>
          <p>{{ block.settings.text | escape }}</p>
        </div>
      {%- endfor -%}
    </div>
  </div>
</section>`;
  return withSchema(liquid, {
    name: "Features",
    settings: [text("title", "Heading", ""), textarea("subtitle", "Subheading", ""), { type: "select", id: "align", label: "Heading alignment", default: "center", options: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }] }],
    blocks: [
      {
        type: "feature",
        name: "Feature",
        settings: [
          { type: "select", id: "icon", label: "Icon", default: "sparkles", options: EXPORT_ICON_OPTIONS },
          text("title", "Title", "Feature"),
          textarea("text", "Text", ""),
        ],
      },
    ],
    max_blocks: 4,
    presets: [{ name: "Features" }],
  });
}

export function imageTextSection(): string {
  const liquid = `
<section class="section" data-reveal>
  <div class="container">
    <div class="image-text{% if section.settings.image_side == 'right' %} image-text--right{% endif %}">
      <div class="image-text__media">
        {%- if section.settings.image -%}
          {{ section.settings.image | image_url: width: 1200 | image_tag: loading: 'lazy', alt: section.settings.title | escape }}
        {%- endif -%}
      </div>
      <div class="image-text__body">
        {%- if section.settings.eyebrow != blank -%}<p class="eyebrow">{{ section.settings.eyebrow | escape }}</p>{%- endif -%}
        <h2>{{ section.settings.title }}</h2>
        <div class="rte">{{ section.settings.text }}</div>
        {%- if section.settings.cta_label != blank -%}
          <a class="btn btn--secondary" href="{{ section.settings.cta_url | default: routes.root_url }}">{{ section.settings.cta_label | escape }}</a>
        {%- endif -%}
      </div>
    </div>
  </div>
</section>`;
  return withSchema(liquid, {
    name: "Image with text",
    settings: [
      text("eyebrow", "Eyebrow", ""),
      text("title", "Heading", "Vår berättelse"),
      { type: "richtext", id: "text", label: "Text", default: "<p>Berätta om ditt varumärke.</p>" },
      text("cta_label", "Button label", ""),
      { type: "url", id: "cta_url", label: "Button link" },
      { type: "image_picker", id: "image", label: "Image" },
      { type: "select", id: "image_side", label: "Image position", default: "left", options: [{ value: "left", label: "Left" }, { value: "right", label: "Right" }] },
    ],
    presets: [{ name: "Image with text" }],
  });
}

export function testimonialsSection(): string {
  const liquid = `
<section class="section" data-reveal>
  <div class="container">
    {%- if section.settings.title != blank -%}
      <div class="section-head section-head--center"><h2>{{ section.settings.title }}</h2></div>
    {%- endif -%}
    <div class="testimonials">
      {%- for block in section.blocks -%}
        <blockquote class="testimonial" {{ block.shopify_attributes }}>
          <span class="testimonial__stars" aria-label="{{ block.settings.rating }} out of 5">{% for i in (1..block.settings.rating) %}{% render 'icon', name: 'star', size: 14, stroke: 2 %}{% endfor %}</span>
          <p class="testimonial__quote">“{{ block.settings.quote | escape }}”</p>
          <p class="testimonial__author"><strong>{{ block.settings.author | escape }}</strong>{% if block.settings.role != blank %} · {{ block.settings.role | escape }}{% endif %}</p>
        </blockquote>
      {%- endfor -%}
    </div>
  </div>
</section>`;
  return withSchema(liquid, {
    name: "Testimonials",
    settings: [text("title", "Heading", "")],
    blocks: [
      {
        type: "testimonial",
        name: "Testimonial",
        settings: [textarea("quote", "Quote", ""), text("author", "Name", ""), text("role", "Location / role", ""), range("rating", "Stars", 1, 5, 1, 5, "")],
      },
    ],
    max_blocks: 6,
    presets: [{ name: "Testimonials" }],
  });
}

export function marqueeSection(): string {
  const liquid = `
<div class="marquee marquee--{{ section.settings.style }}" style="--marquee-speed: {{ section.settings.speed }}s">
  <div class="marquee__track">
    <span>{{ section.settings.text | escape }}</span>
    <span aria-hidden="true">{{ section.settings.text | escape }}</span>
  </div>
</div>`;
  return withSchema(liquid, {
    name: "Marquee",
    settings: [
      textarea("text", "Text", "Fri frakt över 799 kr · Snabb leverans · 30 dagars retur"),
      range("speed", "Speed", 10, 80, 2, 28, "s"),
      { type: "select", id: "style", label: "Style", default: "solid", options: [{ value: "solid", label: "Solid" }, { value: "outline", label: "Outline" }] },
    ],
    presets: [{ name: "Marquee" }],
  });
}

export function faqSection(): string {
  const liquid = `
<section class="section" data-reveal>
  <div class="container">
    <div class="section-head section-head--center"><h2>{{ section.settings.title }}</h2></div>
    <div class="faq">
      {%- for block in section.blocks -%}
        <details class="faq__item" {{ block.shopify_attributes }}>
          <summary>{{ block.settings.question | escape }}</summary>
          <div class="faq__answer">{{ block.settings.answer }}</div>
        </details>
      {%- endfor -%}
    </div>
  </div>
</section>`;
  return withSchema(liquid, {
    name: "FAQ",
    settings: [text("title", "Heading", "Vanliga frågor")],
    blocks: [
      {
        type: "question",
        name: "Question",
        settings: [text("question", "Question", "Hur lång är leveransen?"), { type: "richtext", id: "answer", label: "Answer", default: "<p>1–3 arbetsdagar.</p>" }],
      },
    ],
    presets: [{ name: "FAQ" }],
  });
}

export function newsletterSection(): string {
  const liquid = `
<section class="section" data-reveal>
  <div class="container">
    <div class="newsletter">
      <h2>{{ section.settings.title }}</h2>
      <p>{{ section.settings.text }}</p>
      {%- form 'customer' -%}
        <input type="hidden" name="contact[tags]" value="newsletter">
        <div class="newsletter__form">
          <label class="visually-hidden" for="NewsletterEmail-{{ section.id }}">Email</label>
          <input id="NewsletterEmail-{{ section.id }}" type="email" name="contact[email]" placeholder="din@epost.se" required>
          <button class="btn" type="submit">{{ section.settings.cta_label | escape }}</button>
        </div>
        {%- if form.posted_successfully? -%}<p class="newsletter__note">Tack! Du är nu prenumerant.</p>{%- endif -%}
        {%- if form.errors -%}<p class="newsletter__note">{{ form.errors | default_errors }}</p>{%- endif -%}
      {%- endform -%}
    </div>
  </div>
</section>`;
  return withSchema(liquid, {
    name: "Newsletter",
    settings: [text("title", "Heading", "Bli först att veta"), textarea("text", "Text", ""), text("cta_label", "Button label", "Prenumerera")],
    presets: [{ name: "Newsletter" }],
  });
}

export function mainProductSection(): string {
  const liquid = `
{%- assign variant = product.selected_or_first_available_variant -%}
<section class="section" data-product-id="{{ product.id }}" data-product-handle="{{ product.handle }}" data-product-title="{{ product.title | escape }}" data-product-price="{{ variant.price | money | escape }}" data-product-url="{{ product.url }}">
  <div class="container product">
    <div class="product__media">
      {%- if product.media.size > 0 -%}
        {%- for media in product.media limit: 4 -%}
          {%- if media.media_type == 'video' and settings.product_video -%}
            {{ media | video_tag: controls: true, class: 'product__video' }}
          {%- else -%}
            {{ media | image_url: width: 1200 | image_tag: loading: 'eager', class: 'product__image', alt: media.alt | default: product.title | escape }}
          {%- endif -%}
        {%- endfor -%}
      {%- endif -%}
    </div>
    <div class="product__info">
      {%- if section.settings.show_vendor and product.vendor != blank -%}<p class="eyebrow">{{ product.vendor | escape }}</p>{%- endif -%}
      <h1>{{ product.title }}</h1>
      <p class="product__price">
        {{ variant.price | money }}
        {%- if variant.compare_at_price > variant.price -%} <s>{{ variant.compare_at_price | money }}</s>{%- endif -%}
        {%- if product.metafields.reviews.rating.value != blank -%}<span class="card__rating">{% render 'icon', name: 'star', size: 14, stroke: 2 %} {{ product.metafields.reviews.rating.value }} · {{ product.metafields.reviews.rating_count }}</span>{%- endif -%}
      </p>
      {%- form 'product', product, class: 'product__form' -%}
        {%- unless product.has_only_default_variant -%}
          <label class="visually-hidden" for="VariantSelect">Variant</label>
          <select id="VariantSelect" name="id" data-variant-select>
            {%- for item in product.variants -%}
              <option value="{{ item.id }}" {% if item == variant %}selected{% endif %} {% unless item.available %}disabled{% endunless %}>{{ item.title }} — {{ item.price | money }}</option>
            {%- endfor -%}
          </select>
        {%- else -%}
          <input type="hidden" name="id" value="{{ variant.id }}">
        {%- endunless -%}
        <div class="qty-row">
          <label class="visually-hidden" for="Quantity">Antal</label>
          <input id="Quantity" class="qty" type="number" name="quantity" value="1" min="1" inputmode="numeric">
          <button class="btn btn--full" type="submit" {% unless product.available %}disabled{% endunless %}>
            {%- if product.available -%}{{ section.settings.button_label | escape }}{%- else -%}{{ 'products.sold_out' | t | default: 'Slutsåld' }}{%- endif -%}
          </button>
        </div>
        {%- if settings.dynamic_checkout -%}{{ form | payment_button }}{%- endif -%}
      {%- endform -%}

      {%- if product.metafields.custom.ingredients != blank -%}
        <div class="metafield-block"><b>{{ 'products.ingredients' | t | default: 'Ingredienser' }}</b><div class="rte">{{ product.metafields.custom.ingredients | metafield_tag }}</div></div>
      {%- endif -%}
      {%- if product.metafields.custom.material != blank -%}
        <div class="metafield-block"><b>{{ 'products.material' | t | default: 'Material' }}</b><div class="rte">{{ product.metafields.custom.material | metafield_tag }}</div></div>
      {%- endif -%}
      {%- if product.metafields.custom.sustainability != blank -%}
        <div class="metafield-block"><b>{{ 'products.sustainability' | t | default: 'Hållbarhet' }}</b><div class="rte">{{ product.metafields.custom.sustainability | metafield_tag }}</div></div>
      {%- endif -%}
      {%- if settings.size_guide -%}
        <div class="metafield-block">
          <b>{{ 'products.size_guide' | t | default: 'Storleksguide' }}</b>
          {%- if product.metafields.custom.size_guide != blank -%}
            <div class="rte">{{ product.metafields.custom.size_guide | metafield_tag }}</div>
          {%- else -%}
            {% render 'size-guide' %}
          {%- endif -%}
        </div>
      {%- endif -%}
      <div class="rte">{{ product.description }}</div>

      {%- if settings.complete_the_look and product.collections.first.products.size > 1 -%}
        <div class="metafield-block">
          <b>Complete the look</b>
          <div class="look-row">
            {%- for item in product.collections.first.products limit: 4 -%}
              {%- unless item.id == product.id -%}
                <a href="{{ item.url }}">
                  {%- if item.featured_image -%}{{ item.featured_image | image_url: width: 400 | image_tag: loading: 'lazy', alt: item.title | escape }}{%- endif -%}
                  <span>{{ item.title }}</span>
                </a>
              {%- endunless -%}
            {%- endfor -%}
          </div>
        </div>
      {%- endif -%}

      {%- if settings.trust_badges -%}
        <div class="trust-inline">
          {%- assign badges = settings.trust_text | default: 'Fri frakt · 30 dagars retur · Säker betalning' -%}
          {{ badges }}
        </div>
      {%- endif -%}

      {% render 'integration-payments' %}
      {% render 'reviews' %}
      {%- for block in section.blocks -%}
        {%- if block.type == '@app' -%}<div class="app-block" {{ block.shopify_attributes }}>{% render block %}</div>{%- endif -%}
      {%- endfor -%}
    </div>
  </div>

  {%- if settings.recently_viewed -%}{% render 'recently-viewed' %}{%- endif -%}

  {%- if recommendations.performed and recommendations.products_count > 0 -%}
    <div class="container recommendations">
      <h2>{{ 'products.you_may_like' | t | default: 'Du kanske också gillar' }}</h2>
      <div class="product-grid" style="--columns:4">
        {%- for item in recommendations.products -%}
          {% render 'product-card', product: item, show_price: true, show_rating: false %}
        {%- endfor -%}
      </div>
    </div>
  {%- endif -%}
</section>
{% render 'sticky-atc', product: product %}`;
  return withSchema(liquid, {
    name: "Product",
    settings: [checkbox("show_vendor", "Show vendor", false), text("button_label", "Button label", "Lägg i varukorg")],
    blocks: [{ type: "@app", name: "App" }],
    max_blocks: 6,
  });
}

export function mainCollectionSection(): string {
  const liquid = `
<section class="section">
  <div class="container">
    <div class="page-head">
      <h1>{{ collection.title }}</h1>
      {%- if collection.description != blank -%}<p>{{ collection.description | strip_html | truncate: 180 }}</p>{%- endif -%}
    </div>
    {%- if settings.search_filters and collection.filters.size > 0 -%}
      <div class="facets">
        {%- for filter in collection.filters -%}
          <details class="facets__group" open>
            <summary>{{ filter.label }} <span class="facets__count">{{ filter.active_values.size }}</span></summary>
            <div class="facets__body">
              {%- case filter.type -%}
                {%- when 'list' -%}
                  <ul>
                    {%- for value in filter.values -%}
                      <li>
                        <label>
                          <input type="checkbox" name="{{ value.param_name }}" value="{{ value.value }}" {% if value.active %}checked{% endif %} {% if value.count == 0 and value.active == false %}disabled{% endif %} onchange="this.form.submit()">
                          <span>{{ value.label }} ({{ value.count }})</span>
                        </label>
                      </li>
                    {%- endfor -%}
                  </ul>
                {%- when 'price_range' -%}
                  <div class="facets__price">
                    <span>{{ filter.min_value.value | default: 0 | money }} – {{ filter.max_value.value | default: filter.range_max | money }}</span>
                  </div>
              {%- endcase -%}
            </div>
          </details>
        {%- endfor -%}
        <div class="facets__sort">
          <label for="SortBy">{{ 'collections.sort' | t | default: 'Sortera' }}</label>
          <select id="SortBy" name="sort_by" onchange="this.form.submit()">
            {%- for option in collection.sort_options -%}
              <option value="{{ option.value }}" {% if option.value == collection.sort_by %}selected{% endif %}>{{ option.name }}</option>
            {%- endfor -%}
          </select>
        </div>
      </div>
    {%- endif -%}
    {%- paginate collection.products by 24 -%}
      <div class="product-grid">
        {%- for product in collection.products -%}
          {% render 'product-card', product: product, show_price: true, show_rating: false %}
        {%- else -%}
          <p class="empty">Inga produkter än.</p>
        {%- endfor -%}
      </div>
      {%- if paginate.pages > 1 -%}
        <div class="pagination">
          {%- for part in paginate.parts -%}
            {%- if part.is_link -%}<a href="{{ part.url }}">{{ part.title }}</a>
            {%- elsif part.title == paginate.current_page -%}<span class="is-current">{{ part.title }}</span>
            {%- else -%}<span>{{ part.title }}</span>{%- endif -%}
          {%- endfor -%}
        </div>
      {%- endif -%}
    {%- endpaginate -%}
  </div>
</section>`;
  return withSchema(liquid, { name: "Collection", settings: [] });
}

export function mainCartSection(): string {
  const liquid = `
<section class="section">
  <div class="container">
    <div class="page-head"><h1>Din varukorg</h1></div>
    <form action="{{ routes.cart_url }}" method="post" class="cart">
      {%- for item in cart.items -%}
        <div class="cart__row">
          {%- if item.image -%}<img src="{{ item.image | image_url: width: 200 }}" alt="{{ item.title | escape }}" loading="lazy">{%- endif -%}
          <div>
            <a href="{{ item.url }}"><strong>{{ item.product.title }}</strong></a>
            <p>{{ item.variant.title }} · {{ item.original_price | money }}</p>
            <input type="number" name="updates[]" value="{{ item.quantity }}" min="0" aria-label="Antal">
          </div>
          <p>{{ item.final_line_price | money }}</p>
        </div>
      {%- else -%}
        <p class="empty">Din varukorg är tom. <a href="{{ routes.all_products_collection_url }}">Fortsätt handla</a></p>
      {%- endfor -%}
      {%- if cart.item_count > 0 -%}
        <div class="cart__total"><span>Totalt</span><span>{{ cart.total_price | money }}</span></div>
        <div class="cart__actions">
          <button class="btn btn--secondary" type="submit" name="update">Uppdatera</button>
          <button class="btn" type="submit" name="checkout">Till kassan</button>
        </div>
      {%- endif -%}
    </form>
    {% render 'integration-payments' %}
  </div>
</section>`;
  return withSchema(liquid, { name: "Cart", settings: [] });
}

export function mainPageSection(): string {
  const liquid = `
<section class="section">
  <div class="container" style="max-width:760px">
    <div class="page-head"><h1>{{ page.title }}</h1></div>
    <div class="rte">{{ page.content }}</div>
  </div>
</section>`;
  return withSchema(liquid, { name: "Page", settings: [] });
}

export function main404Section(): string {
  const liquid = `
<section class="section">
  <div class="container" style="text-align:center;max-width:620px">
    <p class="eyebrow">404</p>
    <h1>Sidan hittades inte.</h1>
    <p class="hero__sub" style="margin-inline:auto">Den här sidan har flyttat eller finns inte längre.</p>
    <a class="btn" href="{{ routes.all_products_collection_url }}">Fortsätt handla</a>
  </div>
</section>`;
  return withSchema(liquid, { name: "404", settings: [] });
}

export function mainSearchSection(): string {
  const liquid = `
<section class="section">
  <div class="container">
    <div class="page-head"><h1>Sök</h1></div>
    <form action="{{ routes.search_url }}" method="get" class="search-form" role="search">
      <input type="search" name="q" value="{{ search.terms | escape }}" placeholder="Sök produkter…" aria-label="Sök">
      <button class="btn" type="submit">Sök</button>
    </form>
    {%- if search.performed -%}
      {%- if search.results.size > 0 -%}
        <div class="product-grid">
          {%- for item in search.results -%}
            {%- if item.object_type == 'product' -%}
              {% render 'product-card', product: item, show_price: true, show_rating: false %}
            {%- endif -%}
          {%- endfor -%}
        </div>
      {%- else -%}
        <p class="empty">Inga träffar för “{{ search.terms | escape }}”.</p>
      {%- endif -%}
    {%- endif -%}
  </div>
</section>`;
  return withSchema(liquid, { name: "Search", settings: [] });
}

export function mainListCollectionsSection(): string {
  const liquid = `
<section class="section">
  <div class="container">
    <div class="page-head"><h1>Kollektioner</h1></div>
    <div class="features">
      {%- for collection in collections -%}
        <a class="feature" href="{{ collection.url }}">
          <h3>{{ collection.title }}</h3>
          <p>{{ collection.products_count }} produkter</p>
        </a>
      {%- endfor -%}
    </div>
  </div>
</section>`;
  return withSchema(liquid, { name: "Collections", settings: [] });
}
