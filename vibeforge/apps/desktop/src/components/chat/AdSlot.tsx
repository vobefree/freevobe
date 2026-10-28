import { AD_INTERVAL_PROMPTS } from '@vibeforge/protocol';
import { useAppStore } from '../../store/appStore';

export interface AdSlotProps {
  /** Antal användarprompter i samtalet så här långt. Det enda indata komponenten får. */
  promptIndex: number;
  /**
   * Tvinga fram visning i tester och i förhandsgranskningen av annonsplatsen.
   * Används aldrig av chattflödet.
   */
  forceVisible?: boolean;
}

/**
 * Annonsplatsen i chattflödet.
 *
 * Den här komponenten får medvetet **bara** ett tal: antalet användarprompter. Den har ingen
 * åtkomst till prompttext, filinnehåll, agentkontext eller svar, och den kan därför inte
 * påverka eller läsas av agenten. Den renderas som ett eget block mellan chattbubblorna,
 * aldrig inuti ett agentsvar, och är tydligt märkt.
 */
export function AdSlot({ promptIndex, forceVisible = false }: AdSlotProps) {
  const ads = useAppStore((state) => state.settings?.ads ?? null);

  if (!forceVisible) {
    if (!ads || !ads.enabled || ads.provider === 'none') return null;
    // Aldrig före första prompten och aldrig två annonser i rad.
    if (promptIndex <= 0) return null;
    const interval = Math.max(1, ads.everyNPrompts || AD_INTERVAL_PROMPTS);
    if (promptIndex % interval !== 0) return null;
  }

  const provider = forceVisible ? (ads?.provider ?? 'custom') : (ads?.provider ?? 'none');
  const custom = ads?.custom ?? {
    headline: 'Bygg snabbare med Freevobe Pro',
    body: 'Fler samtidiga agenter, delade skills mellan projekt och team-minne – fortfarande helt lokalt.',
    ctaLabel: 'Läs mer om Pro',
    ctaUrl: 'https://freevobe.dev/pro',
  };

  return (
    <aside
      data-testid="ad-slot"
      role="complementary"
      aria-label="Sponsrat innehåll"
      className="my-3 rounded-lg border border-dashed border-iron bg-forge/60 p-3"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="rounded border border-iron px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
          Sponsrat
        </span>
        <span className="text-[10px] text-slate-600">
          Annonsinnehåll – skilt från agentens svar
        </span>
      </div>

      {provider === 'custom' ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-200">{custom.headline}</p>
            <p className="mt-0.5 text-xs text-slate-500">{custom.body}</p>
          </div>
          <a
            className="vf-button shrink-0"
            href={custom.ctaUrl}
            target="_blank"
            rel="noreferrer noopener"
            data-testid="ad-cta"
          >
            {custom.ctaLabel}
          </a>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Annonser är aktiverade men ingen annons leverantör är konfigurerad. AdSense är avstängt i
          skrivbordsappen – välj providern &quot;custom&quot; i inställningarna om du vill visa en
          egen plats.
        </p>
      )}
    </aside>
  );
}

/** Visar hur många prompter som återstår innan nästa annons. Används i statusraden. */
export function adHint(promptIndex: number, everyN: number): string {
  if (everyN <= 0) return 'annonser av';
  const rest = everyN - (promptIndex % everyN);
  return `${rest} prompter till nästa annonsplats`;
}
