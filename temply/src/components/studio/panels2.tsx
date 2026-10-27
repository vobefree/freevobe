"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dict } from "@/lib/i18n";
import type { ProStrings } from "@/lib/i18n/pro";
import type { AbTestId, Locale, StylePresetId, ThemeConfig } from "@/lib/theme/types";
import { STYLE_PRESET_ORDER } from "@/lib/theme/types";
import { applyTokens } from "@/lib/theme/tokens";
import { applyBrand, brandAssets } from "@/lib/brand/kit";
import { BrandDnaEditor } from "./BrandDnaEditor";
import { chromaKey, quantizeColors, subjectFocus } from "@/lib/brand/image-tools";
import { STYLE_PRESETS } from "@/lib/brand/styles";
import type { CopyItem, CopyTarget } from "@/lib/ai/copy";
import type { ImageKind } from "@/lib/ai/image";
import { Field, Segmented, Slider, TextArea, TextInput, Toggle } from "./controls";
import { Icon } from "@/components/Icon";

type Update = (recipe: (config: ThemeConfig) => ThemeConfig) => void;
type PanelProps = { config: ThemeConfig; update: Update; locale: Locale; dict: Dict; pro: ProStrings; projectId?: string };

/** Sidetiketter för förhandsvisningen: startsida, produkt, om oss, kontakt, kundkorg. */
export const PAGE_LABELS: Record<Locale, string[]> = {
  sv: ["Start", "Produkt", "Kollektion", "Sök", "Om oss", "Kontakt", "Kundvagn", "404"],
  nb: ["Start", "Produkt", "Kolleksjon", "Søk", "Om oss", "Kontakt", "Handlekurv", "404"],
  fi: ["Etusivu", "Tuote", "Kokoelma", "Haku", "Meistä", "Yhteys", "Ostoskori", "404"],
  da: ["Start", "Produkt", "Kollektion", "Søg", "Om os", "Kontakt", "Kurv", "404"],
  en: ["Home", "Product", "Collection", "Search", "About", "Contact", "Cart", "404"],
  fr: ["Accueil", "Produit", "Collection", "Recherche", "À propos", "Contact", "Panier", "404"],
  de: ["Start", "Produkt", "Kollektion", "Suche", "Über uns", "Kontakt", "Warenkorb", "404"],
  es: ["Inicio", "Producto", "Colección", "Buscar", "Nosotros", "Contacto", "Carrito", "404"],
};

const STYLE_LABEL_KEY: Record<StylePresetId, "stylePremiumSkincare" | "styleGaming" | "styleKids" | "styleNordic" | "styleLuxury" | "styleStreetwear"> = {
  premiumSkincare: "stylePremiumSkincare",
  gaming: "styleGaming",
  kidsClothes: "styleKids",
  nordicMinimal: "styleNordic",
  luxury: "styleLuxury",
  streetwear: "styleStreetwear",
};

function downloadSvg(name: string, svg: string) {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

async function readPixels(src: string): Promise<{ data: Uint8ClampedArray; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const max = 900;
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      try {
        ctx.drawImage(image, 0, 0, width, height);
        resolve({ data: ctx.getImageData(0, 0, width, height).data, width, height });
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

async function writeCanvas(data: Uint8ClampedArray, width: number, height: number): Promise<string | null> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(data);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

export function BrandPanel({ config, update, locale, dict, pro }: PanelProps) {
  const [colors, setColors] = useState(config.brand.colors.join(" "));
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const assets = brandAssets(config, locale);

  const applyColors = async (raw: string, source: "palette" | "logo") => {
    const res = await fetch("/api/brand/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colors: raw }),
    });
    const json = (await res.json()) as { palette?: ThemeConfig["palette"]; colors?: string[]; tone?: ThemeConfig["brand"]["tone"] };
    if (!json.palette) return;
    update((current) => applyBrand(current, { palette: json.palette, colors: json.colors, tone: json.tone, source }));
  };

  const onLogo = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
    const pixels = await readPixels(dataUrl);
    const found = pixels ? quantizeColors(pixels.data, 4) : [];
    update((current) => applyBrand(current, { logoUrl: dataUrl, colors: found.length ? found : current.brand.colors, source: "logo", sourceLabel: file.name }));
    if (found.length) await applyColors(found.join(" "), "logo");
  };

  return (
    <>
      <div className="panel-title">{pro.brandTitle}</div>
      <p className="hint" style={{ marginBottom: 12 }}>{pro.brandSub}</p>

      <BrandDnaEditor config={config} update={update} locale={locale} dict={dict} />

      <div className="panel-section">
        <div className="panel-title">{pro.logoLabel}</div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onLogo(file);
          }}
        />
        <button className="ui-btn ui-btn--ghost ui-btn--block" type="button" onClick={() => fileRef.current?.click()}>
          {pro.logoUpload}
        </button>
        {config.brand.logoUrl && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={config.brand.logoUrl} alt="" style={{ width: 46, height: 46, objectFit: "contain", background: "#fff", borderRadius: 8 }} />
            <button
              className="ui-btn ui-btn--ghost ui-btn--sm"
              type="button"
              aria-label={dict.common.delete}
              onClick={() => update((c) => ({ ...c, brand: { ...c.brand, logoUrl: "" }, media: { ...c.media, logo: "" } }))}
            >
              <Icon name="close" size="sm" />
            </button>
          </div>
        )}
      </div>

      <div className="panel-section">
        <div className="panel-title">{pro.presetsTitle}</div>
        <div className="style-grid">
          {STYLE_PRESET_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className={`style-card${config.brand.styleId === id ? " is-active" : ""}`}
              onClick={() => update((current) => applyBrand(current, { styleId: id, palette: { ...STYLE_PRESETS[id].palette }, tone: STYLE_PRESETS[id].tone, source: "preset", sourceLabel: id }))}
            >
              <span className="style-card__swatches">
                {[STYLE_PRESETS[id].palette.background, STYLE_PRESETS[id].palette.primary, STYLE_PRESETS[id].palette.accent].map((color) => (
                  <i key={color} style={{ background: color }} />
                ))}
              </span>
              <b>{pro[STYLE_LABEL_KEY[id]]}</b>
            </button>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-title">{pro.paletteLabel}</div>
        <TextArea value={colors} rows={2} onChange={setColors} />
        <button className="ui-btn ui-btn--ghost ui-btn--block" type="button" style={{ marginTop: 8 }} onClick={() => void applyColors(colors, "palette")}>
          {pro.paletteApply}
        </button>
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {[config.palette.primary, config.palette.accent, config.palette.background, config.palette.text].map((color) => (
            <span key={color} title={color} style={{ width: 26, height: 26, borderRadius: 8, background: color, boxShadow: "0 0 0 1px var(--line)" }} />
          ))}
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-title">{pro.assetsTitle}</div>
        <div className="field-row">
          <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={() => downloadSvg("favicon.svg", assets.favicon)}>
            {pro.dlFavicon}
          </button>
          <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={() => downloadSvg("logo.svg", assets.logo)}>
            {pro.dlLogo}
          </button>
          <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={() => downloadSvg("og-image.svg", assets.og)}>
            {pro.dlOg}
          </button>
        </div>
        {message && <p className="hint" style={{ marginTop: 8 }}>{message}</p>}
      </div>
    </>
  );
}

export function TokensPanel({ config, update, pro }: PanelProps) {
  const shape = config.tokens;
  return (
    <>
      <div className="panel-title">{pro.tokensTitle}</div>
      <div className="panel-section">
        <Slider label={pro.roundness} value={shape.roundness} min={0} max={100} step={1} unit="" onChange={(value) => update((current) => applyTokens(current, { roundness: value }))} />
        <Slider label={pro.shadowLevel} value={shape.shadowLevel} min={0} max={100} step={1} unit="" onChange={(value) => update((current) => applyTokens(current, { shadowLevel: value }))} />
        <Slider label={pro.spaceScale} value={shape.spaceScale} min={0.75} max={1.4} step={0.05} unit="×" onChange={(value) => update((current) => applyTokens(current, { spaceScale: value }))} />
        <Slider label={pro.typeScale} value={shape.typeScale} min={0.9} max={1.2} step={0.01} unit="×" onChange={(value) => update((current) => applyTokens(current, { typeScale: value }))} />
        <Field label={pro.buttonStyle}>
          <Segmented
            value={config.tokens.buttonStyle}
            options={[
              { value: "solid", label: pro.btnSolid },
              { value: "outline", label: pro.btnOutline },
              { value: "soft", label: pro.btnSoft },
            ]}
            onChange={(value) => update((current) => ({ ...current, tokens: { ...current.tokens, buttonStyle: value } }))}
          />
        </Field>
        <p className="hint" style={{ marginTop: 6 }}>
          {pro.roundness}: knappar {config.shape.buttonRadius}px · kort {config.tokens.cardRadius}px · bilder {config.tokens.imageRadius}px · inputs {config.tokens.inputRadius}px
        </p>
      </div>
    </>
  );
}

export function MediaPanel({ config, update, pro, projectId }: PanelProps) {
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<ImageKind>("hero");
  const [busy, setBusy] = useState(false);
  const focalRef = useRef<HTMLDivElement>(null);

  const setMedia = (patch: Partial<ThemeConfig["media"]>) => update((current) => ({ ...current, media: { ...current.media, ...patch } }));

  const generate = async () => {
    if (prompt.trim().length < 3) return;
    setBusy(true);
    try {
      const res = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, kind, projectId }),
      });
      const json = (await res.json()) as { url?: string };
      if (!json.url) return;
      if (kind === "hero") {
        update((current) => ({
          ...current,
          media: { ...current.media, heroImage: json.url as string },
          sections: current.sections.map((section) => (section.type === "hero" ? { ...section, image: json.url as string, showImage: true } : section)),
        }));
      } else {
        update((current) => ({ ...current, media: { ...current.media, bannerImage: json.url as string } }));
      }
    } finally {
      setBusy(false);
    }
  };

  const removeBackground = async () => {
    const src = config.media.heroImage;
    if (!src) return;
    const pixels = await readPixels(src);
    if (!pixels) return;
    const keyed = chromaKey(pixels.data, pixels.width, pixels.height);
    const dataUrl = await writeCanvas(keyed, pixels.width, pixels.height);
    if (dataUrl) setMedia({ heroImage: dataUrl });
  };

  const smartCrop = async () => {
    const src = config.media.heroImage;
    if (!src) return;
    const pixels = await readPixels(src);
    if (!pixels) return;
    setMedia({ focal: subjectFocus(pixels.data, pixels.width, pixels.height), smartCrop: true });
  };

  const pickFocal = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = focalRef.current?.getBoundingClientRect();
    if (!box) return;
    const x = Math.round(Math.max(0, Math.min(100, ((event.clientX - box.left) / box.width) * 100)));
    const y = Math.round(Math.max(0, Math.min(100, ((event.clientY - box.top) / box.height) * 100)));
    setMedia({ focal: { x, y } });
  };

  return (
    <>
      <div className="panel-title">{pro.mediaTitle}</div>

      <div className="panel-section">
        <div className="panel-title">{pro.heroMedia}</div>
        <Field label={pro.imagePrompt}>
          <TextArea value={prompt} rows={3} onChange={setPrompt} />
        </Field>
        <div className="field-row">
          <select className="select" value={kind} onChange={(event) => setKind(event.target.value as ImageKind)}>
            <option value="hero">Hero</option>
            <option value="banner">Banner</option>
            <option value="lifestyle">Lifestyle</option>
            <option value="product">Produkt</option>
          </select>
          <button className="ui-btn ui-btn--accent ui-btn--sm" type="button" disabled={busy || prompt.trim().length < 3} onClick={generate}>
            {busy ? pro.aiImageBusy : pro.aiImage}
          </button>
        </div>
        <Field label="URL">
          <TextInput value={config.media.heroImage} onChange={(value) => setMedia({ heroImage: value })} placeholder="https://…" />
        </Field>
        <Field label={pro.videoUrl}>
          <TextInput value={config.media.heroVideo} onChange={(value) => setMedia({ heroVideo: value })} placeholder="https://…mp4" />
        </Field>
      </div>

      <div className="panel-section">
        <div className="panel-title">{pro.focalHint}</div>
        <div
          ref={focalRef}
          className="focal-box"
          onPointerDown={(event) => {
            (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
            pickFocal(event);
          }}
          onPointerMove={(event) => {
            if (event.buttons === 1) pickFocal(event);
          }}
          role="slider"
          aria-label={pro.focalHint}
          aria-valuenow={config.media.focal.x}
          tabIndex={0}
        >
          {config.media.heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.media.heroImage} alt="" style={{ objectPosition: `${config.media.focal.x}% ${config.media.focal.y}%` }} />
          ) : (
            <span className="focal-box__empty" />
          )}
          <i className="focal-box__dot" style={{ left: `${config.media.focal.x}%`, top: `${config.media.focal.y}%` }} />
        </div>
        <div className="field-row" style={{ marginTop: 8 }}>
          <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={smartCrop}>
            {pro.smartCrop}
          </button>
          <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={removeBackground}>
            {pro.removeBg}
          </button>
        </div>
        <Toggle label={pro.removeBg} checked={config.media.removeBackground} onChange={(value) => setMedia({ removeBackground: value })} />
        <Toggle label={pro.smartCrop} checked={config.media.smartCrop} onChange={(value) => setMedia({ smartCrop: value })} />
      </div>

      <div className="panel-section">
        <div className="panel-title">{pro.stockTitle}</div>
        <Field label={pro.stockTitle}>
          <TextInput value={config.media.stockQuery} onChange={(value) => setMedia({ stockQuery: value })} />
        </Field>
        <div className="field-row">
          <button
            className="ui-btn ui-btn--ghost ui-btn--sm"
            type="button"
            onClick={() => window.open(`https://unsplash.com/s/photos/${encodeURIComponent(config.media.stockQuery || config.shop.name)}`, "_blank", "noopener")}
          >
            Unsplash
          </button>
          <button
            className="ui-btn ui-btn--ghost ui-btn--sm"
            type="button"
            onClick={() => window.open(`https://www.pexels.com/search/${encodeURIComponent(config.media.stockQuery || config.shop.name)}/`, "_blank", "noopener")}
          >
            Pexels
          </button>
          <button
            className="ui-btn ui-btn--ghost ui-btn--sm"
            type="button"
            onClick={() => window.open("https://shopify.dev/docs/storefronts/themes/best-practices/images", "_blank", "noopener")}
          >
            {pro.stockOpen}
          </button>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>Unsplash och Pexels har fria licenser – kontrollera alltid villkoren för den bild du väljer.</p>
      </div>
    </>
  );
}

export function ConversionPanel({ config, update, pro }: PanelProps) {
  const set = <K extends keyof ThemeConfig["conversion"]>(key: K, value: ThemeConfig["conversion"][K]) =>
    update((current) => ({ ...current, conversion: { ...current.conversion, [key]: value } }));

  return (
    <>
      <div className="panel-title">{pro.convTitle}</div>
      <div className="panel-section">
        <Toggle label={pro.stickyAtc} checked={config.conversion.stickyAtc} onChange={(value) => set("stickyAtc", value)} />
        <Toggle label={pro.dynamicCheckout} checked={config.conversion.dynamicCheckout} onChange={(value) => set("dynamicCheckout", value)} />
        <Toggle label={pro.freeShipping} checked={config.conversion.freeShippingBar} onChange={(value) => set("freeShippingBar", value)} />
        <Slider
          label={pro.freeShippingThreshold}
          value={config.conversion.freeShippingThreshold}
          min={0}
          max={3000}
          step={50}
          onChange={(value) => set("freeShippingThreshold", value)}
        />
        <Toggle label={pro.trustBadges} checked={config.conversion.trustBadges} onChange={(value) => set("trustBadges", value)} />
        <Toggle label={pro.ugcBlock} checked={config.conversion.ugc} onChange={(value) => set("ugc", value)} />
        <Toggle label={pro.bundleBlock} checked={config.conversion.bundle} onChange={(value) => set("bundle", value)} />
        <Toggle label={pro.sizeGuideBlock} checked={config.conversion.sizeGuide} onChange={(value) => set("sizeGuide", value)} />
        <Toggle label={pro.completeLook} checked={config.conversion.completeTheLook} onChange={(value) => set("completeTheLook", value)} />
        <Toggle label={pro.recentlyViewed} checked={config.conversion.recentlyViewed} onChange={(value) => set("recentlyViewed", value)} />
        <Toggle label={pro.exitIntent} checked={config.conversion.exitIntent} onChange={(value) => set("exitIntent", value)} />
        <Toggle label={pro.gdpr} checked={config.conversion.gdprConsent} onChange={(value) => set("gdprConsent", value)} />
      </div>

      <div className="panel-section">
        <div className="panel-title">{pro.abTitle}</div>
        <Segmented
          value={config.conversion.abTest}
          options={[
            { value: "off" as AbTestId, label: pro.abOff },
            { value: "hero" as AbTestId, label: pro.abHero },
            { value: "cta" as AbTestId, label: pro.abCta },
            { value: "layout" as AbTestId, label: pro.abLayout },
            { value: "colors" as AbTestId, label: pro.abColors },
          ]}
          onChange={(value) => set("abTest", value)}
        />
        <Field label={pro.abHero}>
          <TextInput value={config.conversion.abHeadline} onChange={(value) => set("abHeadline", value)} />
        </Field>
        <Field label={pro.abCta}>
          <TextInput value={config.conversion.abCta} onChange={(value) => set("abCta", value)} />
        </Field>
        <p className="hint">{pro.abHint}</p>
      </div>
    </>
  );
}

const COPY_TARGETS: { id: CopyTarget; key: "targetHero" | "targetProducts" | "targetSeo" | "targetCta" | "targetCampaign" }[] = [
  { id: "hero", key: "targetHero" },
  { id: "products", key: "targetProducts" },
  { id: "seo", key: "targetSeo" },
  { id: "cta", key: "targetCta" },
  { id: "campaign", key: "targetCampaign" },
];

export function CopyPanel({ config, update, pro, projectId }: PanelProps) {
  const [target, setTarget] = useState<CopyTarget>("hero");
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<CopyItem[]>([]);
  const [source, setSource] = useState<"ai" | "local" | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/ai/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, target, keyword }),
      });
      const json = (await res.json()) as { items?: CopyItem[]; source?: "ai" | "local" };
      setItems(json.items ?? []);
      setSource(json.source ?? null);
    } finally {
      setBusy(false);
    }
  };

  const applyItem = (item: CopyItem) => {
    update((current) => {
      const patchSection = (recipe: (section: ThemeConfig["sections"][number]) => ThemeConfig["sections"][number]) => ({
        ...current,
        sections: current.sections.map((section) => (section.type === "hero" ? recipe(section) : section)),
      });
      if (item.id === "hero.title") return patchSection((section) => (section.type === "hero" ? { ...section, title: item.text } : section));
      if (item.id === "hero.subtitle") return patchSection((section) => (section.type === "hero" ? { ...section, subtitle: item.text } : section));
      if (item.id === "hero.eyebrow") return patchSection((section) => (section.type === "hero" ? { ...section, eyebrow: item.text } : section));
      if (item.id === "cta.primary") return patchSection((section) => (section.type === "hero" ? { ...section, ctaLabel: item.text } : section));
      if (item.id === "cta.secondary") return patchSection((section) => (section.type === "hero" ? { ...section, secondaryLabel: item.text } : section));
      if (item.id === "cta.newsletter")
        return { ...current, sections: current.sections.map((section) => (section.type === "newsletter" ? { ...section, text: item.text } : section)) };
      if (item.id === "seo.title") return { ...current, seo: { ...current.seo, title: item.text } };
      if (item.id === "seo.description") return { ...current, seo: { ...current.seo, description: item.text } };
      if (item.id === "seo.marquee") return { ...current, sections: current.sections.map((section) => (section.type === "marquee" ? { ...section, text: item.text } : section)) };
      const productMatch = item.id.match(/^product\.(\d+)\.description$/);
      if (productMatch) {
        const index = Number(productMatch[1]);
        return { ...current, shop: { ...current.shop, products: current.shop.products.map((product, i) => (i === index ? { ...product, description: item.text } : product)) } };
      }
      return { ...current, shop: { ...current.shop, tagline: item.text } };
    });
  };

  return (
    <>
      <div className="panel-title">{pro.copyTitle}</div>
      <div className="panel-section">
        <Segmented value={target} options={COPY_TARGETS.map((entry) => ({ value: entry.id, label: pro[entry.key] }))} onChange={setTarget} />
        <Field label={pro.copyTitle}>
          <TextInput value={keyword} onChange={setKeyword} placeholder={config.shop.tagline} />
        </Field>
        <button className="ui-btn ui-btn--accent ui-btn--block" type="button" style={{ marginTop: 8 }} disabled={busy} onClick={generate}>
          {busy ? pro.copyTitle : pro.copyGenerate}
        </button>
        {source && <p className="hint" style={{ marginTop: 8 }}>{source === "ai" ? "AI" : "ThemeFold lokal motor"}</p>}
      </div>
      {items.length > 0 && (
        <div className="panel-section">
          {items.map((item) => (
            <div key={item.id} className="copy-item">
              <div className="copy-item__head">
                <span>{item.label}</span>
                <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={() => applyItem(item)}>
                  {pro.copyApply}
                </button>
              </div>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

type VersionInfo = { id: string; label: string; createdAt: string };

export function HistoryPanel({ pro, projectId, onRestore }: { pro: ProStrings; projectId: string; onRestore: (config: ThemeConfig) => void }) {
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/versions`);
    const json = (await res.json()) as { versions?: VersionInfo[] };
    setVersions(json.versions ?? []);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      await fetch(`/api/projects/${projectId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", label: new Date().toLocaleString() }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const restore = async (versionId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", versionId }),
      });
      const json = (await res.json()) as { project?: { config?: ThemeConfig } };
      if (json.project?.config) onRestore(json.project.config);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="panel-title">{pro.historyTitle}</div>
      <div className="panel-section">
        <button className="ui-btn ui-btn--ghost ui-btn--block" type="button" disabled={busy} onClick={save}>
          {pro.historySave}
        </button>
        {versions.length === 0 && <p className="hint" style={{ marginTop: 10 }}>{pro.historyEmpty}</p>}
        <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
          {versions.map((version) => (
            <div key={version.id} className="version-row">
              <div>
                <b>{version.label}</b>
                <span className="hint">{new Date(version.createdAt).toLocaleString()}</span>
              </div>
              <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" disabled={busy} onClick={() => restore(version.id)}>
                {pro.historyRestore}
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
