import { Icon } from "@/components/Icon";

/**
 * Tre små levande scener – en per steg i "Så funkar det".
 * Allt ritas med CSS-variabler och animationer så att korten känns byggda
 * av samma material som resten av sidan, men varje steg har sin egen bild.
 */
export function StepArt({ step }: { step: 1 | 2 | 3 }) {
  if (step === 1) {
    return (
      <div className="step-art step-art--ask" aria-hidden="true">
        <span className="step-art__prompt">
          <i className="step-art__spark" />
          <span className="step-art__typed">Varm keramik, mjuka knappar</span>
          <b className="step-art__caret" />
          <em>↵</em>
        </span>
        <span className="step-art__blocks">
          <i className="step-art__block step-art__block--1" />
          <i className="step-art__block step-art__block--2" />
          <i className="step-art__block step-art__block--3" />
        </span>
        <span className="step-art__chip step-art__chip--a">Hero</span>
        <span className="step-art__chip step-art__chip--b">Produkter</span>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="step-art step-art--shape" aria-hidden="true">
        <span className="step-art__canvas">
          <span className="step-art__shape">
            <i className="step-art__handle" />
          </span>
          <span className="step-art__type">Aa<span>+</span></span>
          <span className="step-art__slider"><i /></span>
        </span>
        <span className="step-art__radius">22 px</span>
      </div>
    );
  }

  return (
    <div className="step-art step-art--ship" aria-hidden="true">
      <span className="step-art__browser">
        <span className="step-art__browser-bar"><i /><i /><i /></span>
        <span className="step-art__browser-body">
          <i />
          <i />
          <i />
        </span>
      </span>
      <span className="step-art__file">
        <Icon name="upload" size="xs" tone="onDark" />
        theme.zip
      </span>
      <span className="step-art__progress"><i /></span>
      <span className="step-art__done"><Icon name="check" size="sm" strokeWidth={2.4} /></span>
      <span className="step-art__spark step-art__spark--1" />
      <span className="step-art__spark step-art__spark--2" />
    </div>
  );
}
