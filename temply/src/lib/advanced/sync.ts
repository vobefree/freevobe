import type {
  AdvancedCanvas,
  AdvancedNode,
  AdvancedSectionPreset,
  Section,
  SectionType,
  ThemeConfig,
} from "@/lib/theme/types";
import { emptySection } from "@/lib/theme/presets";
import {
  canvasForPage,
  growCanvasToFit,
  nextZ,
  withPageCanvas,
} from "./canvas";

/**
 * Tvåvägssynk mellan startsidans sektioner och Advanced-canvasen.
 *
 * Det temastyrda läget äger `config.sections`; Advanced äger layouten. När
 * användaren växlar läge kopieras innehållet åt båda hållen, och varje
 * sektionsnod bär ett `sectionId` så att rader, rubriker och CTA:er fortsätter
 * att vara samma innehåll i båda vyerna.
 */

const PRESET_FOR_TYPE: Record<SectionType, AdvancedSectionPreset> = {
  hero: "hero",
  productGrid: "products",
  features: "features",
  testimonials: "testimonial",
  imageText: "campaign",
  newsletter: "banner",
  countdown: "campaign",
  marquee: "banner",
  faq: "banner",
  ugc: "banner",
  trust: "features",
  bundle: "products",
  sizeGuide: "banner",
  collection: "products",
  comparison: "features",
  lookbook: "products",
  completeTheLook: "products",
  story: "campaign",
};

const TYPE_FOR_PRESET: Record<AdvancedSectionPreset, SectionType> = {
  hero: "hero",
  campaign: "imageText",
  products: "productGrid",
  features: "features",
  testimonial: "testimonials",
  banner: "newsletter",
};

const HEIGHT_FOR_TYPE: Record<SectionType, number> = {
  hero: 540,
  productGrid: 640,
  features: 390,
  testimonials: 360,
  imageText: 520,
  newsletter: 280,
  marquee: 100,
  faq: 420,
  ugc: 620,
  trust: 300,
  bundle: 380,
  sizeGuide: 420,
  countdown: 280,
  collection: 560,
  comparison: 420,
  lookbook: 620,
  completeTheLook: 560,
  story: 520,
};

function sectionTitle(section: Section): string {
  return "title" in section && typeof section.title === "string" ? section.title : "";
}

function sectionText(section: Section): string {
  if (section.type === "hero") return section.subtitle;
  if (section.type === "imageText") return section.text;
  if (section.type === "newsletter") return section.text;
  if (section.type === "countdown") return section.text;
  if (section.type === "story") return section.text;
  if (section.type === "productGrid") return section.subtitle;
  if (section.type === "features") return section.subtitle;
  if (section.type === "testimonials") return section.items[0]?.quote ?? "";
  if (section.type === "faq") return section.items[0]?.a ?? "";
  if (section.type === "trust") return section.returns;
  if (section.type === "bundle") return section.subtitle;
  if (section.type === "sizeGuide") return section.note;
  if (section.type === "collection") return section.subtitle;
  if (section.type === "comparison") return section.subtitle;
  if (section.type === "lookbook") return section.subtitle;
  if (section.type === "completeTheLook") return section.subtitle;
  if (section.type === "ugc") return section.subtitle;
  return "";
}

function sectionCta(section: Section): string {
  if (section.type === "hero") return section.ctaLabel;
  if (section.type === "imageText") return section.ctaLabel;
  if (section.type === "newsletter") return section.ctaLabel;
  if (section.type === "countdown") return section.ctaLabel;
  if (section.type === "completeTheLook") return section.ctaLabel;
  return "";
}

export function nodeContentFromSection(section: Section): Partial<AdvancedNode> {
  return {
    sectionId: section.id,
    preset: PRESET_FOR_TYPE[section.type] ?? "banner",
    title: sectionTitle(section),
    text: sectionText(section),
    ctaLabel: sectionCta(section),
    ...(section.type === "hero" || section.type === "countdown" ? { eyebrow: section.eyebrow } : {}),
  };
}

function nodeForSection(section: Section, config: ThemeConfig, y: number, z: number): AdvancedNode {
  const height = HEIGHT_FOR_TYPE[section.type] ?? 360;
  return {
    id: `section-${section.id}`,
    type: "section",
    x: 60,
    y,
    w: 1080,
    h: height,
    z,
    rotation: 0,
    radius: config.tokens.cardRadius,
    opacity: 1,
    ...nodeContentFromSection(section),
    sectionId: section.id,
  };
}

function sameContent(node: AdvancedNode, content: Partial<AdvancedNode>): boolean {
  return (
    node.sectionId === content.sectionId &&
    node.preset === content.preset &&
    (node.title ?? "") === (content.title ?? "") &&
    (node.text ?? "") === (content.text ?? "") &&
    (node.ctaLabel ?? "") === (content.ctaLabel ?? "") &&
    (node.eyebrow ?? "") === (content.eyebrow ?? "")
  );
}

/**
 * Theme -> Advanced. Uppdaterar länkade noder, lägger till noder för nya
 * sektioner och tar bort noder vars sektion tagits bort eller dolts. Fri
 * grafik (text, bilder, former, ritningar) lämnas orörd.
 */
export function syncThemeToAdvanced(config: ThemeConfig): ThemeConfig {
  const canvas = canvasForPage(config, "home");
  const visible = config.sections.filter((section) => section.visible);
  const bySection = new Map<string, AdvancedNode>();
  for (const node of canvas.nodes) {
    if (node.sectionId) bySection.set(node.sectionId, node);
  }

  let changed = false;
  let nodes = canvas.nodes.filter((node) => {
    if (!node.sectionId) return true;
    const keep = visible.some((section) => section.id === node.sectionId);
    if (!keep) changed = true;
    return keep;
  });

  let bottom = nodes.reduce((max, node) => Math.max(max, node.y + node.h), 0);
  for (const section of visible) {
    const current = bySection.get(section.id);
    const content = nodeContentFromSection(section);
    if (current) {
      if (sameContent(current, content)) continue;
      nodes = nodes.map((node) => (node.id === current.id ? { ...node, ...content, sectionId: section.id } : node));
      changed = true;
      continue;
    }
    bottom += 40;
    nodes = [...nodes, nodeForSection(section, config, bottom, nextZ(nodes))];
    bottom += HEIGHT_FOR_TYPE[section.type] ?? 360;
    changed = true;
  }

  if (!changed) return config;
  return withPageCanvas(config, "home", growCanvasToFit({ ...canvas, nodes }));
}

function applyNodeToSection(section: Section, node: AdvancedNode): Section {
  switch (section.type) {
    case "hero":
      return {
        ...section,
        title: node.title ?? section.title,
        subtitle: node.text ?? section.subtitle,
        ctaLabel: node.ctaLabel ?? section.ctaLabel,
        eyebrow: node.eyebrow ?? section.eyebrow,
      };
    case "productGrid":
      return { ...section, title: node.title ?? section.title, subtitle: node.text ?? section.subtitle };
    case "features":
      return { ...section, title: node.title ?? section.title, subtitle: node.text ?? section.subtitle };
    case "imageText":
      return { ...section, title: node.title ?? section.title, text: node.text ?? section.text, ctaLabel: node.ctaLabel ?? section.ctaLabel };
    case "newsletter":
      return { ...section, title: node.title ?? section.title, text: node.text ?? section.text, ctaLabel: node.ctaLabel ?? section.ctaLabel };
    case "countdown":
      return {
        ...section,
        title: node.title ?? section.title,
        text: node.text ?? section.text,
        ctaLabel: node.ctaLabel ?? section.ctaLabel,
        eyebrow: node.eyebrow ?? section.eyebrow,
      };
    case "story":
      return { ...section, title: node.title ?? section.title, text: node.text ?? section.text };
    case "testimonials":
      return { ...section, title: node.title ?? section.title };
    default:
      return { ...section, title: node.title ?? sectionTitle(section) } as Section;
  }
}

/** Används av Advanced-panelen när en länkad nod redigeras. */
export function updateSectionFromNode(config: ThemeConfig, node: AdvancedNode): ThemeConfig {
  if (!node.sectionId) return config;
  const index = config.sections.findIndex((section) => section.id === node.sectionId);
  if (index < 0) return config;
  const next = applyNodeToSection(config.sections[index], node);
  if (next === config.sections[index]) return config;
  const sections = [...config.sections];
  sections[index] = next;
  return { ...config, sections };
}

function sectionFromNode(node: AdvancedNode): Section {
  const type = TYPE_FOR_PRESET[node.preset ?? "hero"] ?? "imageText";
  const section = emptySection(type);
  return applyNodeToSection(section, node);
}

/**
 * Advanced -> Theme. Skriver nodernas innehåll till riktiga sektioner, skapar
 * sektioner för nya sektionsnoder och sorterar sektionerna efter nodernas
 * vertikala ordning. Endast sektionsnoder påverkar temat; fri grafik stannar i
 * canvasen.
 */
export function syncAdvancedToTheme(config: ThemeConfig): ThemeConfig {
  const canvas = canvasForPage(config, "home");
  const sectionNodes = canvas.nodes.filter((node) => node.type === "section");
  if (sectionNodes.length === 0) return config;

  const sections = [...config.sections];
  const byId = new Map(sections.map((section) => [section.id, section]));
  const ordered: Section[] = [];
  const used = new Set<string>();
  let nodesChanged = false;

  const nodes = canvas.nodes.map((node) => {
    if (node.type !== "section") return node;
    let section = node.sectionId ? byId.get(node.sectionId) : undefined;
    if (!section) {
      section = sectionFromNode(node);
      byId.set(section.id, section);
      if (node.sectionId !== section.id) {
        nodesChanged = true;
        node = { ...node, sectionId: section.id };
      }
    }
    const updated = applyNodeToSection(section, node);
    byId.set(updated.id, updated);
    if (!used.has(updated.id)) {
      ordered.push(updated);
      used.add(updated.id);
    }
    return node;
  });

  // Sektioner som ännu inte har en nod (t.ex. nyss tillagda i proffsläget)
  // behåller sin inbördes ordning efter de nodstyrda sektionerna.
  for (const section of sections) {
    if (!used.has(section.id)) {
      ordered.push(byId.get(section.id) ?? section);
      used.add(section.id);
    }
  }

  // Sektionsnoder sorteras på y, men behåller fri grafik orörd.
  const orderY = new Map<string, number>();
  for (const node of sectionNodes) {
    if (node.sectionId) orderY.set(node.sectionId, node.y);
  }
  const nextSections = [...ordered].sort((a, b) => {
    const ay = orderY.get(a.id);
    const by = orderY.get(b.id);
    if (ay === undefined && by === undefined) return 0;
    if (ay === undefined) return 1;
    if (by === undefined) return -1;
    return ay - by;
  });
  const sectionsChanged =
    nextSections.length !== config.sections.length ||
    nextSections.some((section, index) => section !== config.sections[index]);
  if (!sectionsChanged && !nodesChanged) return config;

  const next = { ...config, sections: nextSections };
  return nodesChanged ? withPageCanvas(next, "home", { ...canvas, nodes }) : next;
}

/**
 * Tar bort sektionen som en nod pekar på. Används när användaren raderar en
 * sektionsnod i Advanced, så att synken inte lägger tillbaka den.
 */
export function removeLinkedSection(config: ThemeConfig, node: AdvancedNode): ThemeConfig {
  if (!node.sectionId) return config;
  return { ...config, sections: config.sections.filter((section) => section.id !== node.sectionId) };
}
