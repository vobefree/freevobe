import type { Metadata } from 'next';
import { AdSlot } from '@/components/AdSlot';
import { DOC_SECTIONS } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Dokumentation',
  description:
    'Kom igång med Freevobe: installation, arkitektur, verktyg, säkerhet, skills och MCP.',
};

export default function DocsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold">Dokumentation</h1>
        <p className="max-w-2xl text-slate-400">
          Fyra delar: kom igång, arkitektur, verktyg och säkerhet samt utbyggnad med skills, regler,
          minne och MCP.
        </p>
      </header>

      <nav className="vf-card flex flex-wrap gap-x-4 gap-y-1 p-4 text-sm">
        {DOC_SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="text-slate-400 hover:text-slate-100"
          >
            {section.title}
          </a>
        ))}
      </nav>

      {DOC_SECTIONS.map((section, index) => (
        <section key={section.id} id={section.id} className="vf-card scroll-mt-20 space-y-3 p-6">
          <h2 className="text-xl font-semibold">{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-[13.5px] leading-relaxed text-slate-400">
              {paragraph}
            </p>
          ))}
          {section.commands ? (
            <ul className="space-y-1.5">
              {section.commands.map((command) => (
                <li
                  key={command.value}
                  className="flex flex-col gap-1 rounded border border-steel bg-anvil p-2.5"
                >
                  <span className="text-[11px] tracking-wide text-slate-500 uppercase">
                    {command.label}
                  </span>
                  <code className="font-mono text-[12px] text-slate-200">{command.value}</code>
                </li>
              ))}
            </ul>
          ) : null}
          {index === 1 ? <AdSlot label="Sponsrat" /> : null}
        </section>
      ))}
    </div>
  );
}
