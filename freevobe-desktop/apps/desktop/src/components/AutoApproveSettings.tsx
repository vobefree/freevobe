import { AUTO_APPROVE_CATEGORIES, type AppSettings } from '@freevobe/protocol';
import { AUTO_APPROVE_DESCRIPTIONS, AUTO_APPROVE_LABELS } from '../lib/format';

export interface AutoApproveSettingsProps {
  autoApprove: AppSettings['autoApprove'];
  onToggle: (category: (typeof AUTO_APPROVE_CATEGORIES)[number], enabled: boolean) => void;
  disabled?: boolean;
}

/**
 * Auto-godkännande per kategori. Varje ruta gäller bara den kategorin, och hårda block
 * (farliga kommandon, webbläsarautomation, icke-godkända MCP-servrar) gäller fortfarande.
 */
export function AutoApproveSettings({ autoApprove, onToggle, disabled }: AutoApproveSettingsProps) {
  const enabledCount = AUTO_APPROVE_CATEGORIES.filter((category) => autoApprove[category]).length;

  return (
    <div className="space-y-1.5" data-testid="auto-approve-settings">
      <div className="flex items-center gap-2">
        <h4 className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
          Auto-godkänn per kategori
        </h4>
        <span className="text-[10.5px] text-slate-600">
          {enabledCount === 0
            ? 'Inget auto-godkänns'
            : `${enabledCount} av ${AUTO_APPROVE_CATEGORIES.length} kategorier`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {AUTO_APPROVE_CATEGORIES.map((category) => (
          <label
            key={category}
            title={AUTO_APPROVE_DESCRIPTIONS[category]}
            className="flex cursor-pointer items-start gap-2 rounded border border-steel bg-anvil/40 px-2 py-1.5"
          >
            <input
              type="checkbox"
              checked={autoApprove[category] === true}
              disabled={disabled}
              onChange={(event) => onToggle(category, event.target.checked)}
              data-testid={`auto-approve-${category}`}
              className="mt-0.5 accent-ember"
            />
            <span className="min-w-0">
              <span className="block text-[11.5px] text-slate-200">
                {AUTO_APPROVE_LABELS[category]}
              </span>
              <span className="block text-[10px] leading-snug text-slate-500">
                {AUTO_APPROVE_DESCRIPTIONS[category]}
              </span>
            </span>
          </label>
        ))}
      </div>

      <p className="text-[10.5px] text-slate-500">
        Farliga kommandon, skrivningar utanför projektet och icke-godkända MCP-servrar kräver alltid
        din bekräftelse, oavsett vad som är ikryssat här.
      </p>
    </div>
  );
}

/** Kort sammanfattning för vänsterpanelen: vilka kategorier som är på. */
export function AutoApproveChips({ autoApprove }: { autoApprove: AppSettings['autoApprove'] }) {
  const enabled = AUTO_APPROVE_CATEGORIES.filter((category) => autoApprove[category]);
  if (enabled.length === 0) return null;

  return (
    <p
      className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-slate-500"
      data-testid="auto-approve-chips"
    >
      <span className="text-slate-600">Auto:</span>
      {enabled.map((category) => (
        <span
          key={category}
          className="rounded-full border border-mint/40 px-1.5 text-mint"
          title={AUTO_APPROVE_DESCRIPTIONS[category]}
        >
          {AUTO_APPROVE_LABELS[category]}
        </span>
      ))}
    </p>
  );
}
