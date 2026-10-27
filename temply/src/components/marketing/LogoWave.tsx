import type { CSSProperties } from "react";
import { INTEGRATION_LOGOS, type IntegrationLogo } from "@/lib/brand/logos";

/**
 * Vågformad logotyp-marquee för startsidan.
 *
 * Två identiska halvor i en spår som glider -50 % ger en sömlös horisontell loop.
 * Varje logotyp ligger i en egen cell vars vertikala svävning fasförskjuts med
 * `--i`, så rörelsen blir en mjuk våg. Allt sker med CSS-transform (ingen JS),
 * pausar vid hover och blir en statisk rad/grid vid prefers-reduced-motion.
 */

/** Antal upprepningar per halva – håller spåret bredare än viewporten. */
const REPEATS = 2;
const SET = INTEGRATION_LOGOS.length;

/** Optisk höjd per logotyp: ordbilder mindre, fyrkantiga märken större. */
function logoHeight({ viewBox, trailing }: IntegrationLogo): number {
  const parts = viewBox.split(/\s+/).map(Number);
  const aspect = (parts[2] || 1) / (parts[3] || 1);
  if (trailing) return 26;
  if (aspect > 2.5) return 21;
  if (aspect > 1.2) return 24;
  return 28;
}

function Logo({ logo, index, decorative }: { logo: IntegrationLogo; index: number; decorative: boolean }) {
  return (
    <span
      className="wm-item"
      style={{ "--i": index, "--brand": logo.brand } as CSSProperties}
    >
      <span className="wm-logo">
        <svg
          className="wm-logo__svg"
          viewBox={logo.viewBox}
          style={{ height: logoHeight(logo) }}
          role={decorative ? "presentation" : "img"}
          aria-label={decorative ? undefined : logo.name}
          aria-hidden={decorative || undefined}
          focusable="false"
        >
          {logo.paths.map((d, pathIndex) => (
            <path key={pathIndex} d={d} fill="currentColor" />
          ))}
        </svg>
        {logo.trailing && <span className="wm-logo__word">{logo.trailing}</span>}
      </span>
    </span>
  );
}

function Set({ decorative }: { decorative: boolean }) {
  return (
    <>
      {Array.from({ length: REPEATS }).map((_, repeat) => (
        <div
          className={`wm-set${repeat > 0 ? " wm-set--dup" : ""}`}
          key={repeat}
          aria-hidden={decorative || repeat > 0 || undefined}
        >
          {INTEGRATION_LOGOS.map((logo, index) => (
            <Logo
              key={logo.id}
              logo={logo}
              index={repeat * SET + index}
              decorative={decorative || repeat > 0}
            />
          ))}
        </div>
      ))}
    </>
  );
}

export function LogoWave({ note }: { note: string }) {
  return (
    <section className="logo-wave">
      <div className="wrap">
        <div className="logo-wave__viewport">
          <div className="logo-wave__track">
            <div className="wm-half">
              <Set decorative={false} />
            </div>
            <div className="wm-half" aria-hidden="true">
              <Set decorative />
            </div>
          </div>
        </div>
        <p className="logo-wave__note">{note}</p>
      </div>
    </section>
  );
}
