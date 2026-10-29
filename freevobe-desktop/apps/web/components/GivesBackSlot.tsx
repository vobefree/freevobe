import { GIVES_BACK_CAUSES } from '@freevobe/protocol';

/**
 * Gives Back på den publika sajten – ersätter den gamla annonsplatsen.
 *
 * Ingen annonskod, inga cookies och ingen tredje part. Bara en kort påminnelse och länkar till
 * organisationernas egna sidor. Katalogen kommer från `@freevobe/protocol`, samma lista som
 * skrivbordsappen använder.
 */
export function GivesBackSlot({ label = 'Freevobe Gives Back' }: { label?: string }) {
  return (
    <aside aria-label={label} className="vf-panel my-6 p-4">
      <p className="text-[10px] font-semibold tracking-wide text-teal uppercase">{label}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
        Inga annonser. Vill du ge något tillbaka går du direkt till organisationen – Freevobe tar
        inte emot pengar och förmedlar inga bidrag.
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        {GIVES_BACK_CAUSES.map((cause) => (
          <li key={cause.id}>
            <a
              className="text-slate-400 underline decoration-slate-600 underline-offset-2 hover:text-slate-200"
              href={cause.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              {cause.name}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
