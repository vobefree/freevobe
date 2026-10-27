/**
 * Ikoner i Advanced är inte begränsade till appens inbyggda set.
 *
 * - Inbyggda ikoner exporteras som Liquid.
 * - Egna uppladdade/valda SVG-ikoner sparas som sanerad markup på noden, så
 *   de fungerar både i editorn och i det exporterade temat utan externa
 *   beroenden i butiken.
 */

const ALLOWED_TAGS = new Set([
  "svg",
  "g",
  "path",
  "circle",
  "rect",
  "line",
  "polyline",
  "polygon",
  "ellipse",
  "defs",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "mask",
  "title",
]);

const ALLOWED_ATTRS = new Set([
  "xmlns",
  "viewBox",
  "width",
  "height",
  "fill",
  "fill-rule",
  "clip-rule",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "opacity",
  "d",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "points",
  "transform",
  "offset",
  "stop-color",
  "stop-opacity",
  "gradientUnits",
  "gradientTransform",
  "id",
  "clip-path",
  "mask",
]);

const TAG_RE = /<\/?([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const ATTR_RE = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function attr(value: string): string | null {
  const clean = value.trim();
  if (!clean || clean.length > 1200) return null;
  if (/^javascript:/i.test(clean) || /^data:/i.test(clean) && !/^data:image\//i.test(clean)) return null;
  if (/expression\s*\(/i.test(clean) || /url\s*\(\s*['"]?(?:https?:|javascript:)/i.test(clean)) return null;
  return clean;
}

/**
 * Tar bort allt som inte är en säker, statisk SVG-form. Tillåter paths,
 * cirklar, gradienter och clip-paths – men aldrig script, eventhanterare eller
 * externa resurser.
 */
export function sanitizeSvg(raw: string): string {
  if (typeof raw !== "string") return "";
  let text = raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*script[\s\S]*?<\/\s*script\s*>/gi, "")
    .replace(/<\s*style[\s\S]*?<\/\s*style\s*>/gi, "")
    .replace(/<\s*foreignObject[\s\S]*?<\/\s*foreignObject\s*>/gi, "")
    .slice(0, 20_000);

  text = text.replace(TAG_RE, (match, tagName: string, rawAttrs: string) => {
    const tag = tagName.toLowerCase();
    const allowed = [...ALLOWED_TAGS].some((entry) => entry.toLowerCase() === tag);
    if (!allowed) return "";
    if (match.startsWith("</")) return `</${tagName}>`;
    const attrs: string[] = [];
    for (const found of rawAttrs.matchAll(ATTR_RE)) {
      const name = found[1];
      if (!ALLOWED_ATTRS.has(name)) continue;
      if (/^on/i.test(name)) continue;
      if (name === "href" || name === "xlink:href") continue;
      const value = attr(found[2] ?? found[3] ?? "");
      if (value === null) continue;
      attrs.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
    }
    return `<${tagName}${attrs.length ? ` ${attrs.join(" ")}` : ""}>`;
  });

  const start = text.indexOf("<svg");
  const end = text.lastIndexOf("</svg>");
  // Anropas ibland med bara innehållet (paths) – då är det redan sanerat.
  if (start < 0) return text.trim();
  const innerStart = text.indexOf(">", start);
  if (innerStart < 0) return "";
  if (end < 0) return text.slice(innerStart + 1).trim();
  return text.slice(innerStart + 1, end).trim();
}

/** Ett helt, fristående SVG-element med rätt färg och storlek. */
export function svgElement(inner: string, className = "adv-custom-icon"): string {
  return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${sanitizeSvg(inner)}</svg>`;
}

/** Iconify-prefix:name -> URL som fungerar direkt i en <img>. */
export function iconifyUrl(name: string, height = 24, color = "currentColor"): string {
  const [prefix, icon] = name.split(":");
  if (!prefix || !icon) return "";
  return `https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(icon)}.svg?height=${height}&color=${encodeURIComponent(color)}`;
}

export function iconifySvgUrl(name: string): string {
  const [prefix, icon] = name.split(":");
  if (!prefix || !icon) return "";
  return `https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(icon)}.svg?height=24`;
}
