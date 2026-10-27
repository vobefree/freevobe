import type { DesignTokens, ThemeConfig } from "./types";

export const DEFAULT_TOKENS: DesignTokens = {
  roundness: 24,
  shadowLevel: 20,
  spaceScale: 1,
  typeScale: 1,
  buttonStyle: "solid",
  inputRadius: 12,
  imageRadius: 34,
  cardRadius: 22,
};

/**
 * Rundhet är en enda källa: knappar, kort, bilder och inputs får alla sin radie
 * härifrån, så att en enda dragning känns konsekvent i hela temat.
 */
export function tokensToShape(tokens: Pick<DesignTokens, "roundness">): {
  radius: number;
  buttonRadius: number;
  inputRadius: number;
  imageRadius: number;
  cardRadius: number;
} {
  const r = Math.max(0, Math.min(100, tokens.roundness));
  const radius = Math.round(r * 0.3);
  return {
    radius,
    buttonRadius: r >= 70 ? 999 : radius,
    inputRadius: Math.round(radius * 0.6),
    imageRadius: Math.round(radius * 1.5),
    cardRadius: radius,
  };
}

/** Applicerar tokenvärden på temat så att shape, layout och typografi följer med. */
export function applyTokens(config: ThemeConfig, patch: Partial<DesignTokens>): ThemeConfig {
  const tokens: DesignTokens = { ...DEFAULT_TOKENS, ...config.tokens, ...patch };
  const shape = tokensToShape(tokens);
  return {
    ...config,
    tokens: {
      ...tokens,
      inputRadius: shape.inputRadius,
      imageRadius: shape.imageRadius,
      cardRadius: shape.cardRadius,
    },
    shape: {
      ...config.shape,
      radius: shape.radius,
      buttonRadius: shape.buttonRadius,
      shadow: Math.round((tokens.shadowLevel / 100) * 32),
    },
    layout: {
      ...config.layout,
      sectionSpacing: Math.round(88 * tokens.spaceScale),
      gridGap: Math.round(24 * tokens.spaceScale),
    },
    typography: { ...config.typography, baseSize: Math.round(16 * tokens.typeScale) },
  };
}

export function shadowCss(level: number): string {
  const blur = Math.round((level / 100) * 60);
  const y = Math.round((level / 100) * 24);
  return `0 ${y}px ${blur}px -${Math.round(blur * 0.6)}px rgba(0,0,0,${(level / 100) * 0.45})`;
}
