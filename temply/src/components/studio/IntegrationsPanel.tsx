"use client";

import { useState } from "react";
import type { CanvaDesign, CanvaFormat, CanvaUse, IntegrationConnection, Locale, ThemeConfig } from "@/lib/theme/types";
import {
  CANVA_FORMATS,
  INTEGRATION_BLOCKS,
  canvaBrief,
  integrationLabel,
  isIntegrationLive,
  providerName,
  type IntegrationBlockDefinition,
} from "@/lib/integrations/catalog";
import { getIntegrationStrings } from "@/lib/i18n/integrations";
import { Icon } from "@/components/Icon";
import { Field, TextInput } from "./controls";

type Update = (recipe: (config: ThemeConfig) => ThemeConfig) => void;
type Versioned = (recipe: (config: ThemeConfig) => ThemeConfig, label: string) => void;

type Props = {
  config: ThemeConfig;
  update: Update;
  versioned: Versioned;
  locale: Locale;
  shopifyShop: string | null;
  onToast?: (message: string) => void;
};

function connectionFor(config: ThemeConfig, block: IntegrationBlockDefinition): IntegrationConnection {
  return config.integrations.blocks?.[block.id] ?? {
    enabled: false,
    providers: [],
    account: "",
    slot: block.slot,
    connectedAt: null,
  };
}

function BlockCard({
  block,
  connection,
  dict,
  shopifyShop,
  onConnect,
  onDisconnect,
  onToggle,
  onAccount,
}: {
  block: IntegrationBlockDefinition;
  connection: IntegrationConnection;
  dict: ReturnType<typeof getIntegrationStrings>;
  shopifyShop: string | null;
  onConnect: (providers: string[], account: string) => void;
  onDisconnect: () => void;
  onToggle: (value: boolean) => void;
  onAccount: (value: string) => void;
}) {
  const [picked, setPicked] = useState<string[]>(connection.providers);
  const [account, setAccount] = useState(connection.account);
  const [confirming, setConfirming] = useState(false);
  const live = isIntegrationLive(connection);
  const pickedNames = picked.map((id) => providerName(block.id, id)).join(" · ");

  const pick = (id: string) => {
    setPicked((current) => {
      if (block.multi) return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      return [id];
    });
  };

  return (
    <article className={`int-card${live ? " is-live" : ""}`}>
      <div className="int-card__head">
        <span className="int-card__icon" aria-hidden="true">
          <Icon name={block.icon} size="sm" />
        </span>
        <div className="int-card__title">
          <b>{dict.blocks[block.id]}</b>
          <small>{dict.slots[connection.slot]}</small>
        </div>
        <span className={`int-status${live ? " is-live" : ""}`}>{live ? dict.active : connection.connectedAt ? dict.inactive : dict.notConnected}</span>
      </div>

      {connection.connectedAt ? (
        <>
          <div className="int-card__linked">
            <span className="int-dot" />
            <span>{dict.connected} · {integrationLabel(connection, block.id)}</span>
            <button
              type="button"
              className={`toggle${connection.enabled ? " is-on" : ""}`}
              aria-pressed={connection.enabled}
              aria-label={connection.enabled ? dict.active : dict.inactive}
              onClick={() => onToggle(!connection.enabled)}
            >
              <i />
            </button>
          </div>
          <Field label={dict.accountLabel}>
            <TextInput value={account} onChange={(value) => { setAccount(value); onAccount(value); }} placeholder={shopifyShop ?? dict.accountPlaceholder} />
          </Field>
          <div className="int-card__actions">
            <span className="int-kind">{block.kind === "app-block" ? dict.appBlock : dict.appEmbed}</span>
            <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {block.providers.find((provider) => connection.providers.includes(provider.id))?.setupUrl ? (
                <a
                  className="int-link"
                  href={block.providers.find((provider) => connection.providers.includes(provider.id))?.setupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {dict.installApp}
                </a>
              ) : null}
              <button className="int-link" type="button" onClick={onDisconnect}>
                {dict.disconnect}
              </button>
            </span>
          </div>
        </>
      ) : (
        <>
          <p className="int-card__label">{dict.chooseProvider}</p>
          <div className="int-providers">
            {block.providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                className={`int-provider${picked.includes(provider.id) ? " is-picked" : ""}`}
                onClick={() => pick(provider.id)}
                aria-pressed={picked.includes(provider.id)}
              >
                <b>{provider.name}</b>
                {provider.note && <small>{provider.note}</small>}
              </button>
            ))}
          </div>
          {confirming ? (
            <div className="int-consent" role="group" aria-label={dict.consentTitle}>
              <b>{dict.consentTitle}</b>
              <p>
                {dict.consentBody
                  .replace("{name}", pickedNames)
                  .replace("{slot}", dict.slots[block.slot])}
              </p>
              <small>{dict.consentNote}</small>
              <div className="int-consent__actions">
                <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={() => setConfirming(false)}>
                  {dict.consentCancel}
                </button>
                <button
                  className="ui-btn ui-btn--accent ui-btn--sm"
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    onConnect(picked, account);
                  }}
                >
                  {dict.consentAccept}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                className="ui-btn ui-btn--accent ui-btn--block ui-btn--sm"
                type="button"
                disabled={picked.length === 0}
                onClick={() => setConfirming(true)}
              >
                {dict.connect}
                <Icon name="arrowRight" size="xs" strokeWidth={2.2} />
              </button>
              <p className="hint">{dict.connectHint}</p>
            </>
          )}
        </>
      )}
    </article>
  );
}

export function IntegrationsPanel({ config, update, versioned, locale, shopifyShop, onToast }: Props) {
  const dict = getIntegrationStrings(locale);
  const blocks = config.integrations.blocks ?? {};
  const linked = INTEGRATION_BLOCKS.filter((block) => blocks[block.id]?.connectedAt).length;
  const live = INTEGRATION_BLOCKS.filter((block) => isIntegrationLive(blocks[block.id])).length;

  const connect = (block: IntegrationBlockDefinition, providers: string[], account: string) => {
    const label = providers.map((id) => providerName(block.id, id)).join(" · ");
    versioned(
      (current) => ({
        ...current,
        integrations: {
          ...current.integrations,
          ...(block.id === "reviews" ? { reviews: (providers[0] as ThemeConfig["integrations"]["reviews"]) ?? "none" } : {}),
          ...(block.id === "newsletter" && providers.includes("klaviyo") ? { klaviyo: true } : {}),
          blocks: {
            ...current.integrations.blocks,
            [block.id]: {
              ...(current.integrations.blocks?.[block.id] ?? connectionFor(current, block)),
              enabled: true,
              providers,
              account: account || shopifyShop || "",
              slot: block.slot,
              connectedAt: new Date().toISOString(),
              consentAt: new Date().toISOString(),
            },
          },
        },
      }),
      dict.versionConnect.replace("{name}", label),
    );
    onToast?.(dict.versionConnect.replace("{name}", label));
  };

  const disconnect = (block: IntegrationBlockDefinition) => {
    const current = connectionFor(config, block);
    versioned(
      (config) => ({
        ...config,
        integrations: {
          ...config.integrations,
          ...(block.id === "reviews" ? { reviews: "none" as const } : {}),
          blocks: {
            ...config.integrations.blocks,
            [block.id]: { ...current, enabled: false, providers: [], connectedAt: null },
          },
        },
      }),
      dict.versionDisconnect.replace("{name}", integrationLabel(current, block.id)),
    );
  };

  const patch = (block: IntegrationBlockDefinition, value: Partial<IntegrationConnection>) => {
    update((current) => ({
      ...current,
      integrations: {
        ...current.integrations,
        blocks: {
          ...current.integrations.blocks,
          [block.id]: { ...(current.integrations.blocks?.[block.id] ?? connectionFor(current, block)), ...value },
        },
      },
    }));
  };

  return (
    <>
      <div className="panel-title">
        {dict.title}
        <span className="int-count">{live}/{INTEGRATION_BLOCKS.length}</span>
      </div>
      <p className="hint" style={{ marginBottom: 12 }}>{dict.sub}</p>
      <div className="int-summary">
        <span><b>{INTEGRATION_BLOCKS.length}</b>{dict.slotsLabel}</span>
        <span><b>{linked}</b>{dict.linkedLabel}</span>
        <span><b>{live}</b>{dict.liveLabel}</span>
      </div>
      <div className="int-list">
        {INTEGRATION_BLOCKS.map((block) => {
          const connection = connectionFor(config, block);
          return (
            <BlockCard
              key={`${block.id}-${connection.connectedAt ?? "new"}-${connection.providers.join("-")}`}
              block={block}
              connection={connection}
              dict={dict}
              shopifyShop={shopifyShop}
              onConnect={(providers, account) => connect(block, providers, account)}
              onDisconnect={() => disconnect(block)}
              onToggle={(value) => patch(block, { enabled: value })}
              onAccount={(value) => patch(block, { account: value })}
            />
          );
        })}
      </div>
      <p className="hint" style={{ marginTop: 10 }}>{dict.autoNote}</p>
    </>
  );
}

const USE_FOR_FORMAT: Record<CanvaFormat, CanvaUse> = {
  hero: "hero",
  campaign: "campaign",
  product: "product",
  og: "og",
  social: "",
  email: "",
};

export function CanvaPanel({ config, update, versioned, locale, onToast }: Omit<Props, "shopifyShop">) {
  const dict = getIntegrationStrings(locale);
  const canva = config.integrations.canva;
  const [format, setFormat] = useState<CanvaFormat>("hero");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [briefCopied, setBriefCopied] = useState(false);
  const approved = Boolean(canva.approvedAt) || canva.designs.length > 0;

  const meta = CANVA_FORMATS.find((item) => item.id === format) ?? CANVA_FORMATS[0];

  const activate = () => {
    versioned(
      (current) => ({
        ...current,
        integrations: {
          ...current.integrations,
          canva: {
            ...current.integrations.canva,
            approvedAt: new Date().toISOString(),
          },
        },
      }),
      dict.canvaApproved,
    );
    onToast?.(dict.canvaApproved);
  };

  const copyBrief = async () => {
    try {
      await navigator.clipboard.writeText(canvaBrief(config, format));
      setBriefCopied(true);
      window.setTimeout(() => setBriefCopied(false), 2200);
    } catch {
      onToast?.(canvaBrief(config, format));
    }
  };

  const saveDesign = () => {
    if (!/^https:\/\/.+/i.test(url.trim())) {
      setError(dict.canvaInvalid);
      return;
    }
    const design: CanvaDesign = {
      id: crypto.randomUUID(),
      name: name.trim() || `${dict.formats[format]} · ${config.shop.name}`,
      url: url.trim(),
      format,
      use: USE_FOR_FORMAT[format],
      createdAt: new Date().toISOString(),
    };
    versioned(
      (current) => {
        const designs = [...(current.integrations.canva?.designs ?? []), design];
        const use = design.use;
        return {
          ...current,
          sections:
            use === "hero"
              ? current.sections.map((section) => (section.type === "hero" ? { ...section, image: design.url, showImage: true } : section))
              : current.sections,
          integrations: {
            ...current.integrations,
            canva: {
              ...current.integrations.canva,
              connected: true,
              approvedAt: current.integrations.canva.approvedAt ?? new Date().toISOString(),
              lastExportAt: new Date().toISOString(),
              designs,
            },
          },
        };
      },
      `${dict.canvaSave}: ${design.name}`,
    );
    setUrl("");
    setName("");
    setError(null);
    onToast?.(dict.canvaConnected);
  };

  const setUse = (id: string, use: CanvaUse) => {
    update((current) => {
      const design = current.integrations.canva?.designs.find((item) => item.id === id);
      const wasHero = design?.use === "hero";
      return {
        ...current,
        sections:
          use === "hero" && design
            ? current.sections.map((section) => (section.type === "hero" ? { ...section, image: design.url, showImage: true } : section))
            : wasHero && use !== "hero"
              ? current.sections.map((section) => (section.type === "hero" && section.image === design?.url ? { ...section, image: "" } : section))
              : current.sections,
        integrations: {
          ...current.integrations,
          canva: {
            ...current.integrations.canva,
            designs: current.integrations.canva.designs.map((item) => (item.id === id ? { ...item, use } : item)),
          },
        },
      };
    });
  };

  const removeDesign = (id: string) => {
    update((current) => {
      const design = current.integrations.canva.designs.find((item) => item.id === id);
      const remaining = current.integrations.canva.designs.filter((item) => item.id !== id);
      return {
        ...current,
        sections:
          design?.use === "hero"
            ? current.sections.map((section) => (section.type === "hero" && section.image === design.url ? { ...section, image: "" } : section))
            : current.sections,
        integrations: {
          ...current.integrations,
          canva: { ...current.integrations.canva, designs: remaining, connected: remaining.length > 0 },
        },
      };
    });
  };

  return (
    <>
      <div className="panel-section" style={{ marginTop: 18 }}>
        <div className="panel-title">
          {dict.canvaTitle}
          <span className={`int-status${canva.designs.length ? " is-live" : ""}`}>{canva.designs.length ? dict.connected : dict.notConnected}</span>
        </div>
        <p className="hint" style={{ marginBottom: 12 }}>{dict.canvaSub}</p>

        {!approved && (
          <div className="int-consent">
            <b>{dict.canvaConsentTitle}</b>
            <p>{dict.canvaConsent}</p>
            <small>{dict.consentNote}</small>
            <div className="int-consent__actions">
              <button className="ui-btn ui-btn--accent ui-btn--sm" type="button" onClick={activate}>
                {dict.canvaActivate}
                <Icon name="arrowRight" size="xs" strokeWidth={2.2} />
              </button>
            </div>
          </div>
        )}

        {approved ? (
        <>
        <Field label={dict.canvaFormat} value={`${meta.width} × ${meta.height}`}>
          <select className="select" value={format} onChange={(event) => setFormat(event.target.value as CanvaFormat)}>
            {CANVA_FORMATS.map((item) => (
              <option key={item.id} value={item.id}>
                {dict.formats[item.id]} · {item.width}×{item.height}
              </option>
            ))}
          </select>
        </Field>

        <div className="canva-brand">
          <span className="canva-brand__swatches">
            {config.brand.colors.slice(0, 5).map((color) => (
              <i key={color} style={{ background: color }} />
            ))}
          </span>
          <span className="canva-brand__type">
            <b>Aa</b> {config.typography.heading} · {config.typography.body}
          </span>
        </div>

        <div className="canva-actions">
          <a className="ui-btn ui-btn--accent ui-btn--sm" href={meta.createUrl} target="_blank" rel="noopener noreferrer">
            {dict.canvaOpen}
            <Icon name="external" size="xs" />
          </a>
          <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={() => void copyBrief()}>
            {briefCopied ? dict.canvaBriefCopied : dict.canvaBrief}
          </button>
        </div>

        <div className="canva-form">
          <Field label={dict.canvaName}>
            <TextInput value={name} onChange={setName} placeholder={dict.canvaNamePlaceholder} />
          </Field>
          <Field label={dict.canvaUrl}>
            <TextInput value={url} onChange={(value) => { setUrl(value); setError(null); }} placeholder={dict.canvaUrlPlaceholder} />
          </Field>
          {error && <p className="hint" style={{ color: "#a33a1c", marginBottom: 8 }}>{error}</p>}
          <button className="ui-btn ui-btn--block ui-btn--sm" type="button" onClick={saveDesign} disabled={!url.trim()}>
            {dict.canvaSave}
          </button>
        </div>

        <div className="canva-designs">
          <p className="panel-title" style={{ marginTop: 14 }}>{dict.canvaUse}</p>
          {canva.designs.length === 0 && <p className="hint">{dict.canvaEmpty}</p>}
          {canva.designs.map((design) => (
            <div className="canva-design" key={design.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={design.url} alt={design.name} />
              <div className="canva-design__body">
                <b>{design.name}</b>
                <small>{dict.formats[design.format]}</small>
                <select className="select" value={design.use} onChange={(event) => setUse(design.id, event.target.value as CanvaUse)}>
                  <option value="">{dict.canvaNone}</option>
                  <option value="hero">{dict.uses.hero}</option>
                  <option value="campaign">{dict.uses.campaign}</option>
                  <option value="product">{dict.uses.product}</option>
                  <option value="og">{dict.uses.og}</option>
                </select>
              </div>
              <button className="int-link" type="button" onClick={() => removeDesign(design.id)} aria-label={dict.canvaRemove}>
                <Icon name="trash" size="xs" />
              </button>
            </div>
          ))}
        </div>

        <p className="hint" style={{ marginTop: 10 }}>{dict.canvaNote}</p>
        </>
        ) : null}
      </div>
    </>
  );
}
