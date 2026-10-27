"use client";

import { useRef, useState, type ReactNode } from "react";
import type { Dict } from "@/lib/i18n";
import type { BrandDna, BrandIndustry, BrandVoice, DnaProduct, FontKey, Locale, ThemeConfig } from "@/lib/theme/types";
import { FONTS } from "@/lib/theme/types";
import { applyDna, editDna } from "@/lib/brand/dna";
import { INDUSTRY_LABELS, dnaFieldLabel, getDnaStrings, interpolateDna } from "@/lib/i18n/dna";
import { ColorRow, Field, Segmented, Slider, TextArea, TextInput } from "./controls";
import { Icon } from "@/components/Icon";

type Update = (recipe: (config: ThemeConfig) => ThemeConfig) => void;
type Props = { config: ThemeConfig; update: Update; locale: Locale; dict: Dict };

const VOICES: BrandVoice[] = ["formal", "friendly", "luxury", "youthful", "minimal", "playful"];
const INDUSTRIES: BrandIndustry[] = ["fashion", "jewelry", "beauty", "home", "food", "kids", "electronics", "sport", "pets", "art", "flowers", "services", "other"];
const COLOR_ROLES = ["primary", "secondary", "accent", "background", "text", "button"] as const;
const HEX = /^#[0-9a-fA-F]{6}$/;

function fontOptions(kinds: ("sans" | "serif")[]) {
  return (Object.entries(FONTS) as [FontKey, (typeof FONTS)[FontKey]][])
    .filter(([, font]) => kinds.includes(font.kind))
    .map(([key, font]) => ({ key, font }));
}

export function BrandDnaEditor({ config, update, locale, dict }: Props) {
  const t = getDnaStrings(locale);
  const dna = config.brand.dna ?? null;
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const patch = (recipe: (current: BrandDna) => BrandDna) =>
    update((current) => (current.brand.dna ? { ...current, brand: { ...current.brand, dna: recipe(current.brand.dna) } } : current));

  const setValue = (path: string, value: unknown) => patch((current) => editDna(current, path, value));

  const importDna = async () => {
    if (!url.trim()) {
      setError(t.errUrl);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/brand/dna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, locale }),
      });
      const json = (await res.json()) as { dna?: BrandDna; error?: string };
      if (!res.ok || !json.dna) {
        setError(json.error === "robots_blocked" ? t.errRobots : json.error === "invalid_url" || json.error === "blocked_host" ? t.errUrl : t.errFetch);
        return;
      }
      const imported = json.dna;
      update((current) => ({ ...current, brand: { ...current.brand, dna: imported } }));
    } catch {
      setError(t.errFetch);
    } finally {
      setBusy(false);
    }
  };

  const applyToTheme = () => {
    if (!dna) return;
    update((current) => (current.brand.dna ? applyDna(current, current.brand.dna) : current));
    setApplied(true);
    setTimeout(() => setApplied(false), 3000);
  };

  const onLogo = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
    update((current) => {
      if (!current.brand.dna) return current;
      const next = editDna(current.brand.dna, "logo.url", dataUrl);
      next.logo = { url: dataUrl, source: "manual" };
      return { ...current, brand: { ...current.brand, logoUrl: dataUrl, dna: next }, media: { ...current.media, logo: dataUrl } };
    });
  };

  const badge = (path: string) => {
    if (!dna) return null;
    if (dna.missing.includes(path)) return <i className="dna-badge is-missing">{t.missingTag}</i>;
    if (dna.suggested.includes(path)) return <i className="dna-badge is-suggested">{t.suggestedTag}</i>;
    return null;
  };

  const field = (label: string, path: string, children: ReactNode) => (
    <div className="field">
      <div className="field__label">
        <span className="dna-label">
          {label}
          {badge(path)}
        </span>
      </div>
      {children}
    </div>
  );

  const textField = (label: string, path: string, value: string, area = false) =>
    field(
      label,
      path,
      area ? (
        <TextArea value={value} rows={2} onChange={(next) => setValue(path, next)} />
      ) : (
        <TextInput value={value} onChange={(next) => setValue(path, next)} />
      ),
    );

  const colorField = (label: string, role: (typeof COLOR_ROLES)[number]) => {
    const path = `palette.${role}`;
    const value = dna?.palette[role] ?? "#000000";
    return (
      <div className="dna-color" key={role}>
        <ColorRow label={label} value={value} onChange={(next) => setValue(path, next)} />
        <input
          className="input dna-color__hex"
          value={value}
          aria-label={`${label} hex`}
          onChange={(event) => {
            const next = event.target.value.trim();
            if (HEX.test(next)) setValue(path, next.toUpperCase());
          }}
        />
      </div>
    );
  };

  if (!dna) {
    return (
      <div className="panel-section">
        <div className="panel-title">{t.title}</div>
        <p className="hint" style={{ marginBottom: 10 }}>{t.sub}</p>
        <Field label={t.urlLabel}>
          <TextInput value={url} onChange={setUrl} placeholder={t.urlPlaceholder} />
        </Field>
        <button className="ui-btn ui-btn--accent ui-btn--block" type="button" disabled={busy || !url.trim()} onClick={() => void importDna()}>
          {busy ? t.importing : t.importBtn}
        </button>
        {error && <p className="hint" style={{ marginTop: 8, color: "#8a2a12" }}>{error}</p>}
        <p className="hint" style={{ marginTop: 10 }}>{t.sourceNote}</p>
      </div>
    );
  }

  // Fält som är ifyllda med ett förslag visas en gång: under "saknas" om inget
  // hittades på sajten, annars under "förslag" (t.ex. ifyllt av AI).
  const suggestedCount = dna.suggested.length;
  const suggestedOnly = dna.suggested.filter((path) => !dna.missing.includes(path));
  const products = dna.products;

  return (
    <div className="dna">
      <div className="panel-title">
        {t.title}
        <span className="pill" style={{ fontSize: 9.5 }}>{dna.domain}</span>
      </div>

      <div className="dna-import">
        <TextInput value={url} onChange={setUrl} placeholder={t.urlPlaceholder} />
        <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" disabled={busy || !url.trim()} onClick={() => void importDna()}>
          {busy ? t.importing : t.reimport}
        </button>
      </div>
      {error && <p className="hint" style={{ color: "#8a2a12" }}>{error}</p>}

      <div className="dna-summary">
        <span>{interpolateDna(t.summary, { pages: dna.pagesCrawled, suggested: suggestedCount })}</span>
        {dna.missing.length > 0 && (
          <div className="dna-missing">
            <b>{t.missingTitle}</b>
            <span>{t.missingHint}</span>
            <div className="dna-chips">
              {dna.missing.map((path) => (
                <span className="dna-chip is-off" key={path}>
                  {dnaFieldLabel(path, t)}
                </span>
              ))}
            </div>
          </div>
        )}
        {suggestedOnly.length > 0 && (
          <div className="dna-missing">
            <b>{t.suggestedTag}</b>
            <span>{t.suggestedHint}</span>
            <div className="dna-chips">
              {suggestedOnly.map((path) => (
                <span className="dna-chip" key={path}>
                  {dnaFieldLabel(path, t)}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="field-row" style={{ marginTop: 10 }}>
          <button className="ui-btn ui-btn--accent ui-btn--sm" type="button" onClick={applyToTheme}>
            {applied ? t.applied : t.applyTheme}
          </button>
          <button
            className="ui-btn ui-btn--ghost ui-btn--sm"
            type="button"
            onClick={() => update((current) => ({ ...current, brand: { ...current.brand, dna: null } }))}
          >
            {t.clear}
          </button>
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-title">{t.identity}</div>
        {textField(t.brandName, "brandName", dna.brandName)}
        {textField(t.slogan, "slogan", dna.slogan)}
        <div className="dna-assets">
          {[
            { label: t.logo, path: "logo", src: dna.logo.url },
            { label: t.favicon, path: "favicon", src: dna.favicon.url },
            { label: t.appIcon, path: "appIcon", src: dna.appIcon.url },
            { label: t.socialImage, path: "socialImage", src: dna.socialImage.url },
          ].map((asset) => (
            <div className="dna-asset" key={asset.path}>
              <span className="dna-asset__preview">
                {asset.src ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={asset.src} alt="" />
                ) : (
                  <Icon name="image" size="sm" />
                )}
              </span>
              <span className="dna-asset__label">
                {asset.label}
                {badge(asset.path)}
              </span>
            </div>
          ))}
        </div>
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
        <button className="ui-btn ui-btn--ghost ui-btn--block" type="button" style={{ marginTop: 10 }} onClick={() => fileRef.current?.click()}>
          {t.uploadLogo}
        </button>
      </div>

      <div className="panel-section">
        <div className="panel-title">{t.colors}</div>
        {COLOR_ROLES.map((role) =>
          colorField(
            {
              primary: t.colPrimary,
              secondary: t.colSecondary,
              accent: t.colAccent,
              background: t.colBackground,
              text: t.colText,
              button: t.colButton,
            }[role],
            role,
          ),
        )}
        <div className="dna-swatches">
          {dna.palette.swatches.map((hex) => (
            <button
              key={hex}
              type="button"
              title={hex}
              aria-label={`${t.colPrimary}: ${hex}`}
              style={{ background: hex }}
              onClick={() => setValue("palette.primary", hex)}
            />
          ))}
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-title">{t.typography}</div>
        {field(
          t.headingFont,
          "typography.heading",
          <select className="select" value={dna.typography.heading} onChange={(event) => setValue("typography.heading", event.target.value as FontKey)}>
            {fontOptions(["serif", "sans"]).map(({ key, font }) => (
              <option key={key} value={key}>{font.label}</option>
            ))}
          </select>,
        )}
        {field(
          t.bodyFont,
          "typography.body",
          <select className="select" value={dna.typography.body} onChange={(event) => setValue("typography.body", event.target.value as FontKey)}>
            {fontOptions(["sans", "serif"]).map(({ key, font }) => (
              <option key={key} value={key}>{font.label}</option>
            ))}
          </select>,
        )}
        <p className="hint">{t.detected}: {dna.typography.headingFamily} / {dna.typography.bodyFamily}</p>
        <Slider label={t.baseSize} value={dna.typography.baseSize} min={13} max={22} step={1} onChange={(value) => setValue("typography.baseSize", value)} />
        <Slider label={t.headingSize} value={dna.typography.headingSize} min={26} max={84} step={1} onChange={(value) => setValue("typography.headingSize", value)} />
        <Slider label={t.lineHeight} value={dna.typography.lineHeight} min={1.2} max={1.9} step={0.05} unit="" onChange={(value) => setValue("typography.lineHeight", value)} />
        <Slider label={t.headingWeight} value={dna.typography.headingWeight} min={300} max={900} step={100} unit="" onChange={(value) => setValue("typography.headingWeight", value)} />
      </div>

      <div className="panel-section">
        <div className="panel-title">{t.design}</div>
        <Slider label={t.radius} value={dna.design.radius} min={0} max={40} step={1} onChange={(value) => setValue("design.radius", value)} />
        <Slider label={t.buttonRadius} value={dna.design.buttonRadius} min={0} max={999} step={1} onChange={(value) => setValue("design.buttonRadius", value)} />
        <Slider label={t.cardRadius} value={dna.design.cardRadius} min={0} max={48} step={1} onChange={(value) => setValue("design.cardRadius", value)} />
        <Slider label={t.imageRadius} value={dna.design.imageRadius} min={0} max={999} step={1} onChange={(value) => setValue("design.imageRadius", value)} />
        <Slider label={t.spacing} value={dna.design.sectionSpacing} min={48} max={136} step={4} onChange={(value) => setValue("design.sectionSpacing", value)} />
        <Slider label={t.shadow} value={dna.design.shadow} min={0} max={40} step={1} onChange={(value) => setValue("design.shadow", value)} />
        <Field label={t.buttonStyle}>
          <Segmented
            value={dna.design.buttonStyle}
            options={[
              { value: "solid", label: t.btnSolid },
              { value: "outline", label: t.btnOutline },
              { value: "soft", label: t.btnSoft },
            ]}
            onChange={(value) => setValue("design.buttonStyle", value)}
          />
        </Field>
        <Field label={t.density}>
          <Segmented
            value={dna.design.density}
            options={[
              { value: "compact", label: t.densCompact },
              { value: "cozy", label: t.densCozy },
              { value: "airy", label: t.densAiry },
            ]}
            onChange={(value) => setValue("design.density", value)}
          />
        </Field>
      </div>

      <div className="panel-section">
        <div className="panel-title">{t.imagery}</div>
        {field(
          t.imageStyle,
          "imagery.style",
          <Segmented
            value={dna.imagery.style}
            options={[
              { value: "photography", label: t.imgPhotography },
              { value: "illustration", label: t.imgIllustration },
              { value: "3d", label: t.img3d },
              { value: "mixed", label: t.imgMixed },
            ]}
            onChange={(value) => setValue("imagery.style", value)}
          />,
        )}
        <div className="toggle-row">
          <span>{t.productPhotos}</span>
          <button
            type="button"
            className={`toggle${dna.imagery.productPhotos ? " is-on" : ""}`}
            aria-pressed={dna.imagery.productPhotos}
            aria-label={t.productPhotos}
            onClick={() => setValue("imagery.productPhotos", !dna.imagery.productPhotos)}
          >
            <i />
          </button>
        </div>
        <div className="toggle-row">
          <span>{t.lifestyle}</span>
          <button
            type="button"
            className={`toggle${dna.imagery.lifestyle ? " is-on" : ""}`}
            aria-pressed={dna.imagery.lifestyle}
            aria-label={t.lifestyle}
            onClick={() => setValue("imagery.lifestyle", !dna.imagery.lifestyle)}
          >
            <i />
          </button>
        </div>
        <div className="dna-chips">
          {dna.imagery.keywords.map((keyword) => (
            <span className="dna-chip" key={keyword}>{keyword}</span>
          ))}
        </div>
      </div>

      <div className="panel-section">
        {field(
          t.voice,
          "voice.primary",
          <Segmented
            value={dna.voice.primary}
            options={[
              { value: "formal", label: t.voiceFormal },
              { value: "friendly", label: t.voiceFriendly },
              { value: "luxury", label: t.voiceLuxury },
              { value: "youthful", label: t.voiceYouthful },
              { value: "minimal", label: t.voiceMinimal },
              { value: "playful", label: t.voicePlayful },
            ]}
            onChange={(value) => {
              setValue("voice.primary", value);
              setValue("voice.tone", value === "friendly" ? "warm" : value === "youthful" ? "bold" : value === "minimal" ? "calm" : value === "playful" ? "playful" : "premium");
            }}
          />,
        )}
        {field(
          t.formality,
          "voice.formality",
          <Segmented
            value={dna.voice.formality}
            options={[
              { value: "formal", label: t.formalityFormal },
              { value: "neutral", label: t.formalityNeutral },
              { value: "casual", label: t.formalityCasual },
            ]}
            onChange={(value) => setValue("voice.formality", value)}
          />,
        )}
        <div className="dna-chips">
          {VOICES.map((voice) => (
            <span className="dna-chip" key={voice}>{t[`voice${voice.charAt(0).toUpperCase()}${voice.slice(1)}` as "voiceFormal"]}: {dna.voice.scores[voice]}</span>
          ))}
        </div>
        {textField(t.language, "voice.language", dna.voice.language)}
      </div>

      <div className="panel-section">
        <div className="panel-title">{t.audience}</div>
        {field(
          t.industry,
          "audience.industry",
          <select className="select" value={dna.audience.industry} onChange={(event) => setValue("audience.industry", event.target.value)}>
            {INDUSTRIES.map((industry) => (
              <option key={industry} value={industry}>{INDUSTRY_LABELS[locale][industry]}</option>
            ))}
          </select>,
        )}
        {textField(t.segment, "audience.segment", dna.audience.segment, true)}
      </div>

      <div className="panel-section">
        <div className="panel-title">
          {t.products}
          {badge("products")}
        </div>
        {products.map((product, index) => (
          <div className="dna-product" key={product.id}>
            <div className="field-row">
              <TextInput value={product.name} onChange={(next) => setValue(`products.${index}.name`, next)} placeholder={t.productName} />
              <TextInput value={product.price} onChange={(next) => setValue(`products.${index}.price`, next)} placeholder={t.productPrice} />
            </div>
            <div className="dna-product__row">
              <TextInput value={product.category} onChange={(next) => setValue(`products.${index}.category`, next)} placeholder="—" />
              <button
                className="icon-btn"
                type="button"
                aria-label={t.productRemove}
                title={t.productRemove}
                onClick={() => patch((current) => ({ ...current, products: current.products.filter((_, position) => position !== index) }))}
              >
                <Icon name="close" size="sm" />
              </button>
            </div>
          </div>
        ))}
        <button
          className="ui-btn ui-btn--ghost ui-btn--sm"
          type="button"
          onClick={() =>
            patch((current) => ({
              ...current,
              products: [
                ...current.products,
                { id: `dna-manual-${current.products.length + 1}`, name: "", price: "", category: "", image: "", url: "", source: "manual" as DnaProduct["source"] },
              ],
            }))
          }
        >
          {t.productAdd}
        </button>
      </div>

      <div className="panel-section">
        <div className="panel-title">{t.copy}</div>
        {textField(t.copySlogan, "copy.slogan", dna.copy.slogan)}
        {textField(t.copyHero, "copy.heroTitle", dna.copy.heroTitle)}
        {textField(t.copyHeroSub, "copy.heroSubtitle", dna.copy.heroSubtitle, true)}
        {textField(t.copyCta, "copy.heroCta", dna.copy.heroCta)}
        {textField(t.copySecondary, "copy.heroSecondary", dna.copy.heroSecondary)}
        {textField(t.copyAnnouncement, "copy.announcement", dna.copy.announcement)}
        {textField(t.copyCollection, "copy.collectionTitle", dna.copy.collectionTitle)}
        {textField(t.copyCollectionText, "copy.collectionText", dna.copy.collectionText, true)}
        {textField(t.copyProduct, "copy.productIntro", dna.copy.productIntro, true)}
        {textField(t.copyNewsletter, "copy.newsletterTitle", dna.copy.newsletterTitle)}
        {textField(t.copyNewsletterText, "copy.newsletterText", dna.copy.newsletterText, true)}
        {textField(t.copySeoTitle, "copy.seoTitle", dna.copy.seoTitle)}
        {textField(t.copySeoDesc, "copy.seoDescription", dna.copy.seoDescription, true)}
      </div>

      <div className="panel-section">
        <div className="panel-title">{t.extra}</div>
        <div className="dna-chips">
          {dna.pages.map((page) => (
            <span className={`dna-chip${page.found ? "" : " is-off"}`} key={page.key}>
              {{
                home: t.pageHome,
                about: t.pageAbout,
                product: t.pageProduct,
                collection: t.pageCollection,
                contact: t.pageContact,
                footer: t.pageFooter,
              }[page.key]}
            </span>
          ))}
        </div>
        <div className="dna-chips">
          {dna.socials.map((social) => (
            <a className="dna-chip" key={social.platform} href={social.url} target="_blank" rel="noreferrer noopener">
              {social.platform}
            </a>
          ))}
          {!dna.socials.length && <span className="dna-chip is-off">{t.socials}</span>}
        </div>
        <div className="field-row" style={{ marginTop: 10 }}>
          {textField(t.email, "contact.email", dna.contact.email)}
          {textField(t.phone, "contact.phone", dna.contact.phone)}
        </div>
        {textField(t.address, "contact.address", dna.contact.address)}
        {textField(t.returns, "policies.returns", dna.policies.returns, true)}
        {textField(t.shipping, "policies.shipping", dna.policies.shipping, true)}
        <div className="dna-chips">
          {dna.headings.slice(0, 8).map((heading) => (
            <span className="dna-chip" key={heading}>{heading.slice(0, 40)}</span>
          ))}
        </div>
        <p className="hint">{t.sourceNote}</p>
      </div>
    </div>
  );
}
