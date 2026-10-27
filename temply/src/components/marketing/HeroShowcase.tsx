"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import StorefrontPreview, { type PreviewPage } from "@/components/StorefrontPreview";
import { applyMood } from "@/lib/theme/presets";
import { FONTS, type Locale, type MoodId, type ThemeConfig } from "@/lib/theme/types";
import { HERO_DEMO } from "@/lib/i18n/hero-demo";
import { Icon } from "@/components/Icon";

type Step = {
  mood: MoodId;
  radius: number;
  page: PreviewPage;
  path: string;
  /** Element i förhandsvisningen som ska synas, null = toppen. */
  focus: string | null;
  /** Hur långt ned i sidan vi tittar, som andel av förhandsvisningens höjd. */
  pan: number;
};

/**
 * Manuset följer temabyggarens sex steg: känsla, form, typografi, sektioner,
 * sidor och publicering. Varje steg vilar tillräckligt länge för att hinna
 * läsas, och rutan scrollar bara inom sin egen höjd så att inget hamnar utanför.
 */
const SCRIPT: Step[] = [
  { mood: "warm", radius: 22, page: "home", path: "nordform.se", focus: null, pan: 0 },
  { mood: "warm", radius: 32, page: "home", path: "nordform.se", focus: ".section-head", pan: 0.9 },
  { mood: "minimal", radius: 10, page: "product", path: "nordform.se/products/morning-mug", focus: ".product-info", pan: 0.6 },
  { mood: "luxe", radius: 4, page: "home", path: "nordform.se", focus: ".features", pan: 0.8 },
  { mood: "nature", radius: 26, page: "about", path: "nordform.se/pages/om-oss", focus: ".about-grid", pan: 0.7 },
  { mood: "playful", radius: 34, page: "home", path: "nordform.se", focus: ".testimonials", pan: 0.9 },
];

const DWELL = 9_000;

export function HeroShowcase({
  demo,
  locale,
  labels,
}: {
  demo: ThemeConfig;
  locale: Locale;
  labels: { saved: string };
}) {
  const [index, setIndex] = useState(0);
  const [reduce, setReduce] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const step = SCRIPT[index % SCRIPT.length];
  const phase = index % SCRIPT.length;
  const copy = HERO_DEMO[locale];
  const publishing = phase === SCRIPT.length - 1;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduce) return;
    const timer = window.setInterval(() => setIndex((value) => value + 1), DWELL);
    return () => window.clearInterval(timer);
  }, [reduce]);

  const config = useMemo(() => {
    const next = applyMood(demo, step.mood);
    return {
      ...next,
      shape: { ...next.shape, radius: step.radius, buttonRadius: Math.min(999, step.radius + 10) },
      motion: { enabled: !reduce, speed: 480 },
    };
  }, [demo, step.mood, step.radius, reduce]);

  const palette = useMemo(() => SCRIPT.map((item) => applyMood(demo, item.mood).palette.accent), [demo]);

  // Bläddra fram till rätt avsnitt – men aldrig längre än rutan räcker till.
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    // Nollställ direkt (CSS sätter annars mjuk scrollning även för detta hopp).
    node.style.scrollBehavior = "auto";
    node.scrollTop = 0;
    node.style.scrollBehavior = "";
    if (reduce) return;

    const inner = window.setTimeout(() => {
      const anchor = step.focus ? node.querySelector(step.focus) : null;
      const max = Math.max(0, node.scrollHeight - node.clientHeight);
      const anchorTop = anchor
        ? anchor.getBoundingClientRect().top - node.getBoundingClientRect().top + node.scrollTop - 24
        : 0;
      const comfort = max * step.pan;
      const target = Math.min(max, anchor ? Math.min(anchorTop, comfort * 1.6 + node.clientHeight) : comfort);
      node.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    }, 2600);

    // Långsam drift resten av steget så att rutan aldrig står stilla.
    const drift = window.setTimeout(() => {
      const max = Math.max(0, node.scrollHeight - node.clientHeight);
      node.scrollBy({ top: Math.min(node.clientHeight * 0.28, max - node.scrollTop), behavior: "smooth" });
    }, 6200);

    return () => {
      window.clearTimeout(inner);
      window.clearTimeout(drift);
    };
  }, [index, step.focus, step.pan, reduce]);

  const font = FONTS[config.typography.heading];

  return (
    <div className={`browser-card browser-card--live${reduce ? " is-static" : ""}`}>
      <div className="browser-card__bar">
        <span className="browser-card__dots"><i /><i /><i /></span>
        <span className="browser-card__url">
          <Icon name="lock" size="xs" strokeWidth={2} /> {step.path}
        </span>
        <span className="browser-card__live"><i /> Live</span>
      </div>

      <div className="browser-card__view" ref={scroller} aria-hidden="true">
        <StorefrontPreview key={`${step.mood}-${step.page}`} config={config} locale={locale} page={step.page} />
      </div>

      <div className="hero-studio" aria-hidden="true">
        <div className="hero-studio__head">
          <span className="hero-studio__dot" />
          <b>{copy.building}</b>
          <span className="hero-studio__count">{phase + 1}/{SCRIPT.length}</span>
        </div>

        <ol className="hero-studio__steps">
          {copy.phases.map((label, i) => (
            <li key={label} className={i === phase ? "is-active" : i < phase ? "is-done" : ""}>
              <i className="hero-studio__step-dot">
                {i < phase ? <Icon name="check" size="xs" strokeWidth={3} /> : null}
              </i>
              <span>{label}</span>
            </li>
          ))}
        </ol>

        <div className="hero-studio__meta">
          <span className="hero-studio__swatches">
            {palette.map((color, i) => (
              <i key={i} style={{ background: color }} className={i === phase ? "is-active" : ""} />
            ))}
          </span>
          <span className="hero-studio__value">{step.radius}px</span>
          <span className="hero-studio__value" style={{ fontFamily: font.stack }}>{font.label}</span>
        </div>

        <span className="hero-studio__progress">
          <i key={index} style={{ animationDuration: `${DWELL}ms` } as CSSProperties} />
        </span>
      </div>

      {publishing && !reduce && (
        <div className="hero-publish">
          <Icon name="check" size="sm" strokeWidth={2.6} />
          {copy.published}
        </div>
      )}

      <div className="hero-saved"><Icon name="check" size="xs" strokeWidth={2.4} /> {labels.saved}</div>
    </div>
  );
}
