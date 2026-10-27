/**
 * Lucide-ikoner för det exporterade Shopify-temat.
 *
 * Butikens Liquid kan inte importera från npm, så de ikoner temat faktiskt
 * renderar ligger här som färdig SVG-markup (Lucide v1.59, ISC). Ett avsnitt
 * (`{% render 'icon', name: 'truck' %}`) slår upp namnet och skriver ut SVG:n,
 * vilket ger samma linjetjocklek och rundade hörn som i Templys gränssnitt.
 */
export const EXPORT_ICON_PATHS: Record<string, string> = {
  search: '<path d=\'m21 21-4.34-4.34\' /><circle cx=\'11\' cy=\'11\' r=\'8\' />',
  cart: '<path d=\'M16 10a4 4 0 0 1-8 0\' /><path d=\'M3.103 6.034h17.794\' /><path d=\'M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z\' />',
  truck: '<path d=\'M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2\' /><path d=\'M15 18H9\' /><path d=\'M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14\' /><circle cx=\'17\' cy=\'18\' r=\'2\' /><circle cx=\'7\' cy=\'18\' r=\'2\' />',
  shield: '<path d=\'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\' /><path d=\'m9 12 2 2 4-4\' />',
  heart: '<path d=\'M11 14h2a2 2 0 0 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16\' /><path d=\'m14.45 13.39 5.05-4.694C20.196 8 21 6.85 21 5.75a2.75 2.75 0 0 0-4.797-1.837.276.276 0 0 1-.406 0A2.75 2.75 0 0 0 11 5.75c0 1.2.802 2.248 1.5 2.946L16 11.95\' /><path d=\'m2 15 6 6\' /><path d=\'m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a1 1 0 0 0-2.75-2.91\' />',
  star: '<path d=\'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\' />',
  leaf: '<path d=\'M11 20a10 10 0 0010-10 25.9 25.9 0 00-1.04-7.281 1 1 0 00-1.755-.325C15.833 5.5 13 5.5 9.8 6.1A7 7 0 0011 20\' /><path d=\'M2 21a5 5 0 012.911-4.544C7.613 15.212 8.351 15.24 11 13\' />',
  sparkles: '<path d=\'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\' /><path d=\'M20 2v4\' /><path d=\'M22 4h-4\' /><circle cx=\'4\' cy=\'20\' r=\'2\' />',
  check: '<path d=\'M20 6 9 17l-5-5\' />',
  mail: '<path d=\'m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7\' /><rect x=\'2\' y=\'4\' width=\'20\' height=\'16\' rx=\'2\' />',
  plus: '<path d=\'M5 12h14\' /><path d=\'M12 5v14\' />',
  minus: '<path d=\'M5 12h14\' />',
};

/** Ikonnamn som går att välja i temats sektionsinställningar. */
export const EXPORT_ICON_NAMES = Object.keys(EXPORT_ICON_PATHS);

/** Läsbara etiketter till temats ikonväljare. */
export const EXPORT_ICON_LABELS: Record<string, string> = {
  search: "Search",
  cart: "Shopping bag",
  truck: "Fast shipping",
  shield: "Secure purchase",
  heart: "Handmade",
  star: "Rating",
  leaf: "Natural",
  sparkles: "Highlights",
  check: "Included",
  mail: "Newsletter",
  plus: "Add",
  minus: "Remove",
};

/** Ikonnamn -> { value, label } för Liquid-scheman. */
export const EXPORT_ICON_OPTIONS = EXPORT_ICON_NAMES.map((value) => ({ value, label: EXPORT_ICON_LABELS[value] ?? value }));

/** Fullständig, fristående SVG-sträng för ett ikonnamn. */
/** Översätter Templys ikon-id (från sektionsmodellen) till exportens ikonnamn. */
export function exportIconName(value: string | undefined): string {
  const aliases: Record<string, string> = { hand: "heart", rating: "star" };
  const name = aliases[value ?? ""] ?? value ?? "sparkles";
  return EXPORT_ICON_PATHS[name] ? name : "sparkles";
}

export function exportIconSvg(name: string, size = 18, strokeWidth = 1.75): string {
  const body = EXPORT_ICON_PATHS[name] ?? EXPORT_ICON_PATHS.star;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** Samma ikon som data-URI, för CSS-masker (t.ex. avskiljare i marquee:n). */
export function exportIconDataUri(name: string, size = 24): string {
  const encoded = exportIconSvg(name, size, 2)
    .replace(/"/g, "'")
    .replace(/[<>#]/g, (char) => (char === "<" ? "%3C" : char === ">" ? "%3E" : "%23"))
    .replace(/\s+/g, " ");
  return `url("data:image/svg+xml,${encoded}")`;
}
