import { withSchema } from "./sections";
import { EXPORT_ICON_OPTIONS } from "./icons";

type SchemaSetting = Record<string, unknown>;

const text = (id: string, label: string, def = ""): SchemaSetting => ({ type: "text", id, label, default: def });
const textarea = (id: string, label: string, def = ""): SchemaSetting => ({ type: "textarea", id, label, default: def });
const richtext = (id: string, label: string, def = ""): SchemaSetting => ({ type: "richtext", id, label, default: def });
const checkbox = (id: string, label: string, def = true): SchemaSetting => ({ type: "checkbox", id, label, default: def });
const range = (id: string, label: string, min: number, max: number, step: number, def: number, unit = ""): SchemaSetting => ({ type: "range", id, label, min, max, step, unit, default: def });

/** Gör att tredjepartsappar kan lägga in egna block i sektionen. */
const APP_BLOCK = { type: "@app", name: "App" };

function appBlocks(sectionVariable = "section"): string {
  return `{%- for block in ${sectionVariable}.blocks -%}
  {%- if block.type == '@app' -%}<div class="app-block" {{ block.shopify_attributes }}>{% render block %}</div>{%- endif -%}
{%- endfor -%}`;
}

export function ugcSection(): string {
  const liquid = `
<section class="section" data-reveal>
  <div class="container">
    <div class="section-head section-head--center">
      <h2>{{ section.settings.title }}</h2>
      {%- if section.settings.subtitle != blank -%}<p>{{ section.settings.subtitle }}</p>{%- endif -%}
    </div>
    <div class="ugc-grid">
      {%- for block in section.blocks -%}
        {%- if block.type == 'photo' -%}
          <figure class="ugc" {{ block.shopify_attributes }}>
            {%- if block.settings.image != blank -%}
              {{ block.settings.image | image_url: width: 800 | image_tag: loading: 'lazy', alt: block.settings.caption | escape }}
            {%- endif -%}
            <figcaption>
              <p>{{ block.settings.caption }}</p>
              <span>{{ block.settings.author }}</span>
            </figcaption>
          </figure>
        {%- endif -%}
      {%- endfor -%}
    </div>
    ${appBlocks()}
    {%- if section.settings.handle != blank -%}<p class="ugc__source">{{ section.settings.handle }}</p>{%- endif -%}
  </div>
</section>`;
  return withSchema(liquid, {
    name: "UGC & social proof",
    settings: [text("title", "Heading", "Delat av våra kunder"), textarea("subtitle", "Text"), text("handle", "Hashtag/handle", "@varumärke")],
    blocks: [
      {
        type: "photo",
        name: "Photo",
        settings: [{ type: "image_picker", id: "image", label: "Image" }, text("caption", "Caption"), text("author", "Author")],
      },
      APP_BLOCK,
    ],
    max_blocks: 12,
    presets: [{ name: "UGC" }],
  });
}

export function trustSection(): string {
  const liquid = `
<section class="section section--trust">
  <div class="container">
    {%- if section.settings.title != blank -%}<h2 class="visually-hidden">{{ section.settings.title }}</h2>{%- endif -%}
    <div class="trust-grid">
      {%- for block in section.blocks -%}
        {%- if block.type == 'badge' -%}
          <div class="trust" {{ block.shopify_attributes }}>
            <span class="trust__icon" aria-hidden="true">{% render 'icon', name: block.settings.icon, size: 22 %}</span>
            <b>{{ block.settings.title }}</b>
            <small>{{ block.settings.text }}</small>
          </div>
        {%- endif -%}
      {%- endfor -%}
    </div>
    {%- if section.settings.shipping != blank or section.settings.returns != blank -%}
      <p class="trust__meta">{{ section.settings.shipping }} · {{ section.settings.returns }}</p>
    {%- endif -%}
    ${appBlocks()}
  </div>
</section>`;
  return withSchema(liquid, {
    name: "Trust badges",
    settings: [text("title", "Heading", "Tryggt att handla"), text("shipping", "Shipping info"), text("returns", "Returns info")],
    blocks: [
      {
        type: "badge",
        name: "Badge",
        settings: [
          { type: "select", id: "icon", label: "Icon", default: "shield", options: EXPORT_ICON_OPTIONS },
          text("title", "Title"),
          text("text", "Text"),
        ],
      },
      APP_BLOCK,
    ],
    max_blocks: 8,
    presets: [{ name: "Trust badges" }],
  });
}

export function bundleSection(): string {
  const liquid = `
<section class="section" data-reveal>
  <div class="container">
    <div class="section-head section-head--center">
      <h2>{{ section.settings.title }}</h2>
      {%- if section.settings.subtitle != blank -%}<p>{{ section.settings.subtitle }}</p>{%- endif -%}
    </div>
    <div class="bundle-grid">
      {%- for block in section.blocks -%}
        {%- if block.type == 'tier' -%}
          <div class="bundle-tier" {{ block.shopify_attributes }}>
            <b>{{ block.settings.quantity }}×</b>
            <span>{{ block.settings.label }}</span>
            <strong>−{{ block.settings.discount }}%</strong>
          </div>
        {%- endif -%}
      {%- endfor -%}
    </div>
    {%- if section.settings.note != blank -%}<p class="trust__meta">{{ section.settings.note }}</p>{%- endif -%}
  </div>
</section>`;
  return withSchema(liquid, {
    name: "Volume discount",
    settings: [text("title", "Heading", "Köp fler, spara mer"), textarea("subtitle", "Text"), text("note", "Note")],
    blocks: [
      {
        type: "tier",
        name: "Tier",
        settings: [range("quantity", "Quantity", 2, 10, 1, 2), range("discount", "Discount %", 5, 40, 1, 10, "%"), text("label", "Label", "2 för 10 %")],
      },
    ],
    max_blocks: 5,
    presets: [{ name: "Volume discount" }],
  });
}

export function sizeGuideSection(): string {
  const liquid = `
<section class="section">
  <div class="container">
    <div class="section-head section-head--center">
      <h2>{{ section.settings.title }}</h2>
      {%- if section.settings.note != blank -%}<p>{{ section.settings.note }}</p>{%- endif -%}
    </div>
    <div class="size-table">
      <table>
        <thead>
          <tr>
            <th>{{ 'products.size' | t | default: 'Size' }}</th>
            <th>{{ section.settings.col_2 | default: 'Byst' }}</th>
            <th>{{ section.settings.col_3 | default: 'Längd' }}</th>
            <th>{{ section.settings.col_4 | default: 'Ärm' }}</th>
          </tr>
        </thead>
        <tbody>
          {%- for block in section.blocks -%}
            {%- if block.type == 'row' -%}
              <tr {{ block.shopify_attributes }}>
                <td>{{ block.settings.size }}</td>
                <td>{{ block.settings.chest }}</td>
                <td>{{ block.settings.length }}</td>
                <td>{{ block.settings.sleeve }}</td>
              </tr>
            {%- endif -%}
          {%- endfor -%}
        </tbody>
      </table>
    </div>
  </div>
</section>`;
  return withSchema(liquid, {
    name: "Size guide",
    settings: [
      text("title", "Heading", "Storleksguide"),
      textarea("note", "Note"),
      text("col_2", "Column 2", "Byst"),
      text("col_3", "Column 3", "Längd"),
      text("col_4", "Column 4", "Ärm"),
    ],
    blocks: [
      {
        type: "row",
        name: "Row",
        settings: [text("size", "Size", "M"), text("chest", "Column 2"), text("length", "Column 3"), text("sleeve", "Column 4")],
      },
    ],
    max_blocks: 16,
    presets: [{ name: "Size guide" }],
  });
}

export function aboutSection(): string {
  const liquid = `
<section class="section">
  <div class="container">
    <div class="page-head">
      <h1>{{ section.settings.title | default: page.title }}</h1>
      {%- if section.settings.lead != blank -%}<p class="lead">{{ section.settings.lead }}</p>{%- endif -%}
    </div>
    <div class="about-grid">
      <div class="about-media">
        {%- if section.settings.image != blank -%}
          {{ section.settings.image | image_url: width: 1200 | image_tag: loading: 'lazy', alt: section.settings.title | escape }}
        {%- endif -%}
      </div>
      <div class="rte">
        {{ section.settings.body }}
        {%- if section.settings.values != blank -%}
          <ul>
            {%- assign items = section.settings.values | split: ',' -%}
            {%- for item in items -%}<li>{{ item | strip }}</li>{%- endfor -%}
          </ul>
        {%- endif -%}
      </div>
    </div>
  </div>
</section>`;
  return withSchema(liquid, {
    name: "About",
    settings: [text("title", "Heading"), textarea("lead", "Lead"), richtext("body", "Content"), { type: "image_picker", id: "image", label: "Image" }, textarea("values", "Values (comma separated)")],
    presets: [{ name: "About" }],
  });
}

export function contactSection(): string {
  const liquid = `
<section class="section">
  <div class="container contact-grid">
    <div>
      <h1>{{ section.settings.title }}</h1>
      <p>{{ section.settings.text }}</p>
      {%- form 'contact', class: 'contact-form' -%}
        {%- if form.posted_successfully? -%}<p class="form-note">{{ section.settings.success | default: 'Tack! Vi svarar inom kort.' }}</p>{%- endif -%}
        {%- if form.errors -%}<p class="form-note">{{ form.errors | default_errors }}</p>{%- endif -%}
        <label class="visually-hidden" for="ContactName">Namn</label>
        <input id="ContactName" type="text" name="contact[name]" placeholder="Namn" required>
        <label class="visually-hidden" for="ContactEmail">E-post</label>
        <input id="ContactEmail" type="email" name="contact[email]" placeholder="E-post" required>
        <label class="visually-hidden" for="ContactBody">Meddelande</label>
        <textarea id="ContactBody" name="contact[body]" rows="5" placeholder="Meddelande" required></textarea>
        <button class="btn" type="submit">{{ section.settings.cta | default: 'Skicka' }}</button>
      {%- endform -%}
    </div>
    <aside class="contact-aside">
      {%- if section.settings.email != blank -%}<p><b>E-post</b> <a href="mailto:{{ section.settings.email }}">{{ section.settings.email }}</a></p>{%- endif -%}
      {%- if section.settings.phone != blank -%}<p><b>Telefon</b> {{ section.settings.phone }}</p>{%- endif -%}
      {%- if section.settings.address != blank -%}<p><b>Adress</b> {{ section.settings.address }}</p>{%- endif -%}
      {%- if section.settings.hours != blank -%}<p><b>Öppettider</b> {{ section.settings.hours }}</p>{%- endif -%}
    </aside>
  </div>
</section>`;
  return withSchema(liquid, {
    name: "Contact",
    settings: [
      text("title", "Heading", "Kontakta oss"),
      textarea("text", "Text"),
      text("cta", "Button label", "Skicka"),
      text("success", "Success message", "Tack! Vi svarar inom kort."),
      text("email", "E-mail"),
      text("phone", "Phone"),
      text("address", "Address"),
      text("hours", "Opening hours"),
    ],
    presets: [{ name: "Contact" }],
  });
}

/** Kort med nyligen visade produkter (fylls av theme.js via localStorage). */
export function recentlyViewedSnippet(): string {
  return `<div class="recently-viewed" data-recently-viewed hidden>
  <h2>Nyligen visade</h2>
  <div class="product-grid" data-recently-viewed-list></div>
</div>
`;
}

/** Recensionsyta: app block om en recensionsapp är vald, annars Shopify-metafält. */
export function reviewsSnippet(): string {
  return `{%- if settings.reviews_app != 'none' -%}
  <div class="reviews" data-reviews-app="{{ settings.reviews_app }}"></div>
{%- elsif product.metafields.reviews.rating.value != blank -%}
  <div class="reviews reviews--native">
    <p class="card__rating">{% render 'icon', name: 'star', size: 14, stroke: 2 %} {{ product.metafields.reviews.rating.value }} · {{ product.metafields.reviews.rating_count }} omdömen</p>
  </div>
{%- endif -%}
`;
}

/** Sticky add-to-cart som följer med när kunden scrollar på produktsidan. */
export function stickyAtcSnippet(): string {
  return `{%- if settings.sticky_atc -%}
  <div class="sticky-atc" data-sticky-atc hidden>
    <div class="sticky-atc__info">
      <b>{{ product.title }}</b>
      <small>{{ product.selected_or_first_available_variant.price | money }}</small>
    </div>
    {%- form 'product', product, class: 'sticky-atc__form' -%}
      <input type="hidden" name="id" value="{{ product.selected_or_first_available_variant.id }}">
      <button class="btn" type="submit">{{ section.settings.button_label | default: 'Lägg i varukorg' }}</button>
    {%- endform -%}
  </div>
{%- endif -%}
`;
}

/** Språk- och valutasväljare (Shopify Markets) i sidfoten. */
export function marketsSnippet(): string {
  return `{%- if settings.show_markets and localization.available_countries.size > 1 or localization.available_languages.size > 1 -%}
  <div class="markets">
    {%- if localization.available_languages.size > 1 -%}
      {%- form 'localization', class: 'markets__form' -%}
        <input type="hidden" name="return_to" value="{{ request.path }}">
        <label class="visually-hidden" for="LanguageSelect">Språk</label>
        <select id="LanguageSelect" name="locale_code" onchange="this.form.submit()">
          {%- for language in localization.available_languages -%}
            <option value="{{ language.iso_code }}" {% if language.iso_code == localization.language.iso_code %}selected{% endif %}>{{ language.endonym_name }}</option>
          {%- endfor -%}
        </select>
      {%- endform -%}
    {%- endif -%}
    {%- if localization.available_countries.size > 1 -%}
      {%- form 'localization', class: 'markets__form' -%}
        <input type="hidden" name="return_to" value="{{ request.path }}">
        <label class="visually-hidden" for="CountrySelect">Land</label>
        <select id="CountrySelect" name="country_code" onchange="this.form.submit()">
          {%- for country in localization.available_countries -%}
            <option value="{{ country.iso_code }}" {% if country.iso_code == localization.country.iso_code %}selected{% endif %}>{{ country.name }} ({{ country.currency.iso_code }} {{ country.currency.symbol }})</option>
          {%- endfor -%}
        </select>
      {%- endform -%}
    {%- endif -%}
  </div>
{%- endif -%}
`;
}

/** Exit intent-popup med e-postinsamling och tydligt GDPR-samtycke. */
export function exitIntentSnippet(): string {
  return `{%- if settings.exit_intent -%}
  <div class="popup" data-exit-popup hidden>
    <div class="popup__box" role="dialog" aria-modal="true" aria-label="{{ settings.popup_title | default: 'Innan du går' }}">
      <button class="popup__close" type="button" data-popup-close aria-label="Close">×</button>
      <h3>{{ settings.popup_title | default: 'Innan du går' }}</h3>
      <p>{{ settings.popup_text | default: 'Få 10 % på ditt första köp.' }}</p>
      {%- form 'customer', class: 'popup__form' -%}
        <input type="hidden" name="contact[tags]" value="newsletter,exit-intent">
        <label class="visually-hidden" for="PopupEmail">Email</label>
        <input id="PopupEmail" type="email" name="contact[email]" placeholder="din@epost.se" required>
        {%- if settings.gdpr_consent -%}
          <label class="popup__consent">
            <input type="checkbox" name="customer[accepts_marketing]" value="true" required>
            <span>{{ settings.gdpr_text }}</span>
          </label>
        {%- endif -%}
        <button class="btn btn--full" type="submit">{{ settings.popup_cta | default: 'Skicka' }}</button>
      {%- endform -%}
    </div>
  </div>
  {%- endif -%}
`;
}

/** Fallback-storleksguide på produktsidan när metafältet saknas. */
export function sizeGuideSnippet(): string {
  return `<div class="size-table">
  <table>
    <thead>
      <tr><th>Size</th><th>Byst</th><th>Längd</th><th>Ärm</th></tr>
    </thead>
    <tbody>
      <tr><td>XS</td><td>82</td><td>64</td><td>58</td></tr>
      <tr><td>S</td><td>88</td><td>66</td><td>59</td></tr>
      <tr><td>M</td><td>94</td><td>68</td><td>60</td></tr>
      <tr><td>L</td><td>100</td><td>70</td><td>61</td></tr>
      <tr><td>XL</td><td>106</td><td>72</td><td>62</td></tr>
    </tbody>
  </table>
  <p class="trust__meta">Måtten är i centimeter. Ersätt med metafältet <code>custom.size_guide</code> för dina egna mått.</p>
</div>
`;
}

/** Fri frakt-bar med progress som räknas fram ur kundkorgen. */
export function freeShippingBarSnippet(): string {
  return `{%- assign threshold = settings.free_shipping_threshold | times: 100 -%}
{%- if threshold > 0 -%}
  {%- if cart.total_price >= threshold -%}
    {%- assign remaining = 0 -%}
    {%- assign progress = 100 -%}
  {%- else -%}
    {%- assign remaining = threshold | minus: cart.total_price -%}
    {%- assign progress = cart.total_price | times: 100 | divided_by: threshold -%}
  {%- endif -%}
  <div class="shipbar" data-shipbar data-threshold="{{ threshold }}">
    <div class="container shipbar__inner">
      <span data-shipbar-text>
        {%- if remaining == 0 -%}Fri frakt uppnådd
        {%- else -%}Fri frakt om {{ remaining | money }}
        {%- endif -%}
      </span>
      <span class="shipbar__track"><i data-shipbar-progress style="width: {{ progress }}%"></i></span>
    </div>
  </div>
{%- endif -%}
`;
}

/** Klaviyo (och andra appar) via app embed – Shopify injicerar övriga embeds automatiskt. */
export function appEmbedSnippet(): string {
  return `{%- if settings.klaviyo and settings.klaviyo_company_id != blank -%}
  <script async type="text/javascript" src="https://static.klaviyo.com/onsite/js/klaviyo.js?company_id={{ settings.klaviyo_company_id }}"></script>
{%- endif -%}
`;
}
