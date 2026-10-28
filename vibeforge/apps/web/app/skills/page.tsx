import type { Metadata } from 'next';
import { AdSlot } from '@/components/AdSlot';
import { GALLERY_SKILLS } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Skills-galleri',
  description:
    'Färdiga Freevobe-skills för React, Next.js, API:er, tester, granskning, refaktorering och dokumentation.',
};

const EXAMPLE = `---
name: react-component
description: Skapar React-komponenter enligt projektets konventioner
tools:
  - read_file
  - write_file
  - run_tests
triggers:
  - react
  - component
  - ui
---

# React-komponent

1. Läs två befintliga komponenter och följ deras mönster.
2. Skriv komponenten med tydliga typer och tillgängliga roller.
3. Lägg till ett test som beskriver beteendet.
4. Kör testerna och visa diffen.`;

export default function SkillsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold">Skills-galleri</h1>
        <p className="max-w-2xl text-slate-400">
          Tio färdiga skills följer med Freevobe. De är vanliga Markdown-filer i{' '}
          <code className="font-mono">.vibeforge/skills/</code> som du kan granska, kopiera och
          versionshantera.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {GALLERY_SKILLS.map((skill) => (
          <article key={skill.name} className="vf-card space-y-2 p-5">
            <h2 className="font-mono text-sm text-ember">{skill.name}</h2>
            <p className="text-[13px] text-slate-400">{skill.description}</p>
            <p className="text-[11px] text-slate-600">triggers: {skill.triggers.join(', ')}</p>
            <p className="text-[11px] text-slate-600">verktyg: {skill.tools.join(', ')}</p>
          </article>
        ))}
      </div>

      <AdSlot label="Sponsrat" />

      <section className="vf-card space-y-3 p-6">
        <h2 className="text-lg font-semibold">Så ser en skill ut</h2>
        <pre className="overflow-x-auto rounded-md border border-steel bg-anvil p-3 font-mono text-[11.5px] text-slate-300">
          {EXAMPLE}
        </pre>
        <p className="text-[13px] text-slate-400">
          Vill du bidra med en skill? Skicka en pull request med filen i{' '}
          <code className="font-mono">builtin-skills/</code> och en rad i det här galleriet.
        </p>
      </section>
    </div>
  );
}
