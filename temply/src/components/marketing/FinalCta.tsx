import Link from "next/link";
import { Icon } from "@/components/Icon";
import type { Dict } from "@/lib/i18n";

/**
 * Avslutande CTA. Underlaget är levande: aurora-gradienter, svävande
 * färgprover och en långsam glans som rör sig över ytan – allt i CSS så att
 * sektionen känns byggd av material och inte av en platt ruta.
 */
export function FinalCta({ dict, href }: { dict: Dict; href: string }) {
  const swatches = ["#dcf56b", "#ff5a2a", "#fdfaf2", "#9ed3bc", "#f6e6b8", "#c9c2ff"];

  return (
    <div className="final-cta final-cta--living">
      <div className="final-cta__aurora" aria-hidden="true">
        <i className="final-cta__blob final-cta__blob--a" />
        <i className="final-cta__blob final-cta__blob--b" />
        <i className="final-cta__blob final-cta__blob--c" />
      </div>
      <div className="final-cta__grain" aria-hidden="true" />

      <div className="final-cta__content">
        <span className="final-cta__eyebrow">
          <i className="dot" /> {dict.landing.badge}
        </span>
        <h2>{dict.landing.finalTitle}</h2>
        <p>{dict.landing.finalSub}</p>

        <div className="final-cta__actions">
          <Link className="ui-btn ui-btn--lg final-cta__btn" href={href}>
            {dict.landing.finalCta}
            <Icon name="arrowRight" size="sm" strokeWidth={2.2} />
          </Link>
          <span className="final-cta__fine">{dict.landing.trust}</span>
        </div>
      </div>

      <div className="final-cta__material" aria-hidden="true">
        <div className="final-cta__swatches">
          {swatches.map((color, index) => (
            <i key={color} style={{ background: color, animationDelay: `${index * -0.9}s` }} />
          ))}
        </div>
        <div className="final-cta__sheet">
          <span className="final-cta__sheet-line" />
          <span className="final-cta__sheet-line final-cta__sheet-line--short" />
          <span className="final-cta__sheet-pill" />
        </div>
        <div className="final-cta__typeset">
          <b>Aa</b>
          <span>Inter Tight · 22 px</span>
          <i>+</i>
        </div>
      </div>
    </div>
  );
}
