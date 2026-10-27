import type { IntegrationBlockId, ThemeConfig } from "@/lib/theme/types";
import { INTEGRATION_BY_ID, canvaDesignFor, isIntegrationLive } from "@/lib/integrations/catalog";
import { withSchema } from "./sections";

type SchemaSetting = Record<string, unknown>;

function live(config: ThemeConfig, id: IntegrationBlockId) {
  return isIntegrationLive(config.integrations.blocks?.[id]);
}

function providers(config: ThemeConfig, id: IntegrationBlockId): string {
  return (config.integrations.blocks?.[id]?.providers ?? []).join(",");
}

function account(config: ThemeConfig, id: IntegrationBlockId): string {
  return config.integrations.blocks?.[id]?.account ?? "";
}

/** Inställningar som följer med temat så att app blocks och app embeds kan placeras rätt. */
export function integrationSchemaSettings(config: ThemeConfig): SchemaSetting[] {
  const settings: SchemaSetting[] = [
    { type: "header", content: "Förberedda integrationsplatser" },
  ];
  const ids: IntegrationBlockId[] = ["reviews", "newsletter", "chat", "loyalty", "analytics", "consent", "payments", "ugc", "campaign"];
  for (const id of ids) {
    const block = INTEGRATION_BY_ID[id];
    settings.push({
      type: "checkbox",
      id: `integration_${id}_enabled`,
      label: `${block.id === "reviews" ? "Recensioner" : block.id === "newsletter" ? "Nyhetsbrev" : block.id === "chat" ? "Chatt" : block.id === "loyalty" ? "Lojalitet" : block.id === "analytics" ? "Analys & pixlar" : block.id === "consent" ? "Samtycke" : block.id === "payments" ? "Betalningar" : block.id === "ugc" ? "UGC" : "Kampanj"} (${block.kind === "app-block" ? "app block" : "app embed"})`,
      default: live(config, id),
    });
    if (id === "reviews" || id === "newsletter" || id === "analytics" || id === "consent") {
      settings.push({ type: "text", id: `integration_${id}_providers`, label: "Leverantörer (kommaseparerade)", default: providers(config, id) });
      settings.push({ type: "text", id: `integration_${id}_account`, label: "Konto-/mät-ID", default: account(config, id) });
    }
    if (id === "chat") {
      settings.push({ type: "text", id: "integration_chat_provider", label: "Chattleverantör (tidio, gorgias, intercom)", default: providers(config, id) });
      settings.push({ type: "text", id: "integration_chat_account", label: "Chatt-ID (Tidio public key)", default: account(config, id) });
    }
    if (id === "payments" || id === "loyalty" || id === "ugc") {
      settings.push({ type: "text", id: `integration_${id}_providers`, label: "Leverantörer", default: providers(config, id) });
    }
  }
  return settings;
}

export function integrationSettingsData(config: ThemeConfig): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const id of ["reviews", "newsletter", "chat", "loyalty", "analytics", "consent", "payments", "ugc", "campaign"] as IntegrationBlockId[]) {
    data[`integration_${id}_enabled`] = live(config, id);
  }
  data.integration_reviews_providers = providers(config, "reviews");
  data.integration_reviews_account = account(config, "reviews");
  data.integration_newsletter_providers = providers(config, "newsletter");
  data.integration_newsletter_account = account(config, "newsletter");
  data.integration_chat_provider = providers(config, "chat");
  data.integration_chat_account = account(config, "chat");
  data.integration_analytics_providers = providers(config, "analytics");
  data.integration_analytics_account = account(config, "analytics");
  data.integration_consent_providers = providers(config, "consent");
  data.integration_consent_account = account(config, "consent");
  data.integration_payments_providers = providers(config, "payments");
  data.integration_loyalty_providers = providers(config, "loyalty");
  data.integration_ugc_providers = providers(config, "ugc");
  data.integration_campaign_providers = providers(config, "campaign");
  // Bakåtkompatibla nycklar som temats befintliga snippets läser.
  data.reviews_app = live(config, "reviews") && providers(config, "reviews") ? providers(config, "reviews").split(",")[0] : "none";
  data.reviews_id = account(config, "reviews");
  data.klaviyo = live(config, "newsletter") && providers(config, "newsletter").includes("klaviyo");
  data.klaviyo_company_id = data.klaviyo ? account(config, "newsletter") : "";
  data.app_blocks = config.integrations.appBlocks;
  return data;
}

function analyticsSnippet(): string {
  return `{%- if settings.integration_analytics_enabled -%}
<script>
(function () {
  var providers = "{{ settings.integration_analytics_providers }}".split(",").filter(Boolean);
  var id = "{{ settings.integration_analytics_account }}";
  var loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    providers.forEach(function (provider) {
      if (!id) return;
      if (provider === "ga4") {
        var gtagScript = document.createElement("script");
        gtagScript.async = true;
        gtagScript.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
        document.head.appendChild(gtagScript);
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        gtag("js", new Date());
        gtag("config", id);
      }
      if (provider === "meta") {
        !function (f, b, e, v, n, t, s) {
          if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
          if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
          t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
        }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
        fbq("init", id);
        fbq("track", "PageView");
      }
      if (provider === "tiktok") {
        !function (w, d, t) {
          w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || [];
          ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
          ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; };
          for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
          ttq.load = function (e, n) {
            var r = "https://analytics.tiktok.com/i18n/pixel/events.js";
            ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = r;
            ttq._t = ttq._t || {}; ttq._t[e] = +new Date; ttq._o = ttq._o || {}; ttq._o[e] = n || {};
            var s = document.createElement("script"); s.type = "text/javascript"; s.async = !0; s.src = r + "?sdkid=" + e + "&lib=" + t;
            var a = document.getElementsByTagName("script")[0]; a.parentNode.insertBefore(s, a);
          };
        }(window, document, "ttq");
        ttq.load(id);
        ttq.page();
      }
    });
  }
  var required = {{ settings.integration_consent_enabled | json }};
  var consent = null;
  try { consent = window.localStorage.getItem("temply-consent"); } catch (error) {}
  if (!required || consent === "granted") load();
  document.addEventListener("temply:consent", function (event) {
    if (event.detail === "granted") load();
  });
})();
</script>
{%- endif -%}
`;
}

function consentSnippet(): string {
  return `{%- if settings.integration_consent_enabled -%}
<div class="temply-consent" data-consent hidden>
  <div class="temply-consent__copy">
    <strong>Vi använder cookies</strong>
    <p>Nödvändiga cookies håller butiken igång. Övriga används för analys och marknadsföring.</p>
  </div>
  <div class="temply-consent__actions">
    <button type="button" data-consent-value="denied">Avvisa</button>
    <button type="button" data-consent-value="granted">Acceptera</button>
  </div>
</div>
<style>
.temply-consent{position:fixed;left:16px;right:16px;bottom:16px;z-index:80;display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:14px 16px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);box-shadow:0 24px 60px -40px rgba(0,0,0,.7);font-size:.82rem}
.temply-consent[hidden]{display:none}
.temply-consent strong{display:block;margin-bottom:2px}
.temply-consent p{margin:0;color:var(--muted);max-width:60ch}
.temply-consent__actions{display:flex;gap:8px}
.temply-consent button{border:1px solid var(--border);border-radius:var(--btn-radius);background:transparent;padding:.45rem .9rem;cursor:pointer}
.temply-consent button[data-consent-value=granted]{background:var(--primary);color:var(--on-primary);border-color:var(--primary)}
</style>
<script>
(function () {
  var banner = document.querySelector("[data-consent]");
  if (!banner) return;
  var stored = null;
  try { stored = window.localStorage.getItem("temply-consent"); } catch (error) {}
  if (!stored) banner.hidden = false;
  banner.addEventListener("click", function (event) {
    var button = event.target.closest("[data-consent-value]");
    if (!button) return;
    var value = button.getAttribute("data-consent-value");
    try { window.localStorage.setItem("temply-consent", value); } catch (error) {}
    banner.hidden = true;
    document.dispatchEvent(new CustomEvent("temply:consent", { detail: value }));
  });
})();
</script>
{%- endif -%}
`;
}

function chatSnippet(): string {
  return `{%- if settings.integration_chat_enabled -%}
  {%- if settings.integration_chat_provider == "tidio" and settings.integration_chat_account != blank -%}
    <script src="https://code.tidio.co/{{ settings.integration_chat_account }}.js" async></script>
  {%- elsif settings.integration_chat_provider == "gorgias" -%}
    {%- comment -%} Gorgias aktiveras via appens egen app embed när appen är installerad. {%- endcomment -%}
  {%- elsif settings.integration_chat_provider == "intercom" -%}
    {%- comment -%} Intercom aktiveras via appens egen app embed när appen är installerad. {%- endcomment -%}
  {%- endif -%}
{%- endif -%}
`;
}

function paymentsSnippet(): string {
  return `{%- if settings.integration_payments_enabled -%}
<div class="payment-trust" aria-label="Betalningsmetoder">
  {%- for type in shop.enabled_payment_types -%}
    {{ type | payment_type_svg_tag: class: 'payment-trust__icon' }}
  {%- endfor -%}
</div>
<style>
.payment-trust{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:14px}
.payment-trust svg{height:22px;width:auto}
</style>
{%- endif -%}
`;
}

function newsletterSnippet(): string {
  return `{%- if settings.integration_newsletter_enabled -%}
<form class="newsletter newsletter--integration" method="post" action="/contact#newsletter" accept-charset="UTF-8">
  <input type="hidden" name="form_type" value="customer">
  <input type="hidden" name="utf8" value="✓">
  <input type="hidden" name="contact[tags]" value="newsletter">
  <label class="visually-hidden" for="NewsletterEmail">E-post</label>
  <input id="NewsletterEmail" type="email" name="contact[email]" placeholder="din@epost.se" required>
  <button class="btn" type="submit">Prenumerera</button>
</form>
<style>
.newsletter--integration{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin:1.4rem 0 0;padding:1rem 0;background:transparent;border-top:1px solid var(--border);border-radius:0;text-align:left}
.newsletter--integration input{flex:1 1 14rem;max-width:22rem}
.footer__integrations .payment-trust{margin-top:.8rem}
</style>
{%- endif -%}
`;
}

/** Alla globala snippets som hör till integrationsblocken. */
export function integrationSnippets(): Record<string, string> {
  return {
    "snippets/integration-analytics.liquid": analyticsSnippet(),
    "snippets/integration-chat.liquid": chatSnippet(),
    "snippets/integration-consent.liquid": consentSnippet(),
    "snippets/integration-payments.liquid": paymentsSnippet(),
    "snippets/integration-newsletter.liquid": newsletterSnippet(),
  };
}

/** Kampanjbandet läggs bara in i mallen när kampanjblocket är kopplat. */
export function campaignSection(config: ThemeConfig): string {
  const design = canvaDesignFor(config, "campaign");
  const liquid = `
<section class="campaign-band"{% if section.settings.image != blank %} style="background-image: url('{{ section.settings.image }}')"{% endif %}>
  <div class="container campaign-band__inner">
    {%- if section.settings.eyebrow != blank -%}<p class="eyebrow">{{ section.settings.eyebrow }}</p>{%- endif -%}
    <h2>{{ section.settings.title }}</h2>
    <p>{{ section.settings.text }}</p>
    {%- if section.settings.cta != blank -%}<a class="btn" href="{{ section.settings.url }}">{{ section.settings.cta }}</a>{%- endif -%}
  </div>
</section>
<style>
.campaign-band{background:var(--primary);color:var(--on-primary);background-size:cover;background-position:center;position:relative}
.campaign-band__inner{padding-block:clamp(38px,7vw,72px);position:relative}
.campaign-band h2{color:inherit;margin:0 0 .4em}
.campaign-band .eyebrow{opacity:.7}
</style>`;
  return withSchema(liquid, {
    name: "Campaign band",
    settings: [
      { type: "text", id: "eyebrow", label: "Eyebrow", default: "Kampanj" },
      { type: "text", id: "title", label: "Heading", default: "Ny kollektion ute nu" },
      { type: "textarea", id: "text", label: "Text", default: "Fri frakt och tidig access – så länge lagret räcker." },
      { type: "text", id: "cta", label: "Button label", default: "Se kampanjen" },
      { type: "url", id: "url", label: "Button link" },
      { type: "text", id: "image", label: "Bild-URL (från Canva)", default: design?.url ?? "" },
    ],
    presets: [{ name: "Campaign band" }],
  });
}
