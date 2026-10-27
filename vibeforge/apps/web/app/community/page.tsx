import type { Metadata } from 'next';
import { AdSlot } from '@/components/AdSlot';
import { COMMUNITY_LINKS } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Community',
  description: 'Delta i VibeForge-communityt: frågor, buggar, skills och bidrag.',
};

export default function CommunityPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold">Community</h1>
        <p className="max-w-2xl text-slate-400">
          VibeForge utvecklas öppet. Buggar, idéer och nya skills är lika välkomna – allt går via
          GitHub.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {COMMUNITY_LINKS.map((link) => (
          <a key={link.label} href={link.href} className="vf-card block p-5 hover:border-iron">
            <h2 className="text-sm font-semibold text-slate-100">{link.label}</h2>
            <p className="mt-1 text-[13px] text-slate-500">{link.note}</p>
          </a>
        ))}
      </div>

      <section className="vf-card space-y-3 p-6">
        <h2 className="text-lg font-semibold">Bidra med kod</h2>
        <ul className="space-y-1.5 text-[13.5px] text-slate-400">
          <li>
            • Kör <code className="font-mono text-slate-300">npm run verify</code> innan du öppnar
            en pull request.
          </li>
          <li>• Håll ändringar små och beskriv varför, inte bara vad.</li>
          <li>• Nya verktyg och skills ska ha tester.</li>
          <li>
            • Rapportera säkerhetsproblem via GitHub Security Advisories i stället för i en öppen
            issue.
          </li>
        </ul>
      </section>

      <AdSlot label="Sponsrat" />
    </div>
  );
}
