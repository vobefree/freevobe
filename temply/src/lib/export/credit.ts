/**
 * Låst ThemeFold-credit för teman som exporteras under provperioden.
 *
 * Sektionen renderas statiskt från `layout/theme.liquid`. Statiska sektioner
 * ligger utanför templates/JSON och kan därför inte tas bort, flyttas eller
 * läggas till i Shopifys temaeditor – bara redigeras om de har inställningar,
 * och den här sektionen har medvetet inga. Betalande användare får aldrig med
 * filen eller layoutraden i sin export.
 */

export const THEMEFOLD_URL = "https://themefold.se";
export const CREDIT_SECTION = "themefold-footer";

export function creditSection(): string {
  const href = `${THEMEFOLD_URL}?utm_source=shopify-theme&utm_medium=watermark&utm_campaign=trial`;
  return `<footer class="tf-credit" role="contentinfo" aria-label="ThemeFold" lang="en">
  <p class="tf-credit__text">
    <a class="tf-credit__link" href="${href.replace(/&/g, "&amp;")}" target="_blank" rel="noopener" title="ThemeFold – Shopify themes built with AI">
      Made with <span class="tf-credit__heart" aria-hidden="true">❤️</span><span class="tf-credit__sr">love</span> using <strong>ThemeFold</strong>
    </a>
  </p>
</footer>

<style>
  .tf-credit {
    padding: 18px 16px 26px;
    border-top: 1px solid var(--border, rgba(0, 0, 0, 0.12));
    text-align: center;
  }
  .tf-credit__text {
    margin: 0;
    font-family: var(--font-body, system-ui, -apple-system, sans-serif);
    font-size: 12.5px;
    line-height: 1.5;
    letter-spacing: 0.01em;
    color: var(--muted, #6f6a63);
  }
  .tf-credit__link {
    display: inline-flex;
    align-items: center;
    gap: 0.25em;
    color: inherit;
    text-decoration: none;
  }
  .tf-credit__link:hover,
  .tf-credit__link:focus-visible {
    color: var(--text, #14140f);
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
  .tf-credit__heart {
    color: #d4595b;
  }
  .tf-credit__sr {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
</style>

{% schema %}
{
  "name": "ThemeFold credit",
  "class": "tf-credit-section",
  "settings": []
}
{% endschema %}
`;
}
