import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Integritetspolicy',
  description: 'Freevobe behandlar allt lokalt. Här är exakt vad som sparas, var och varför.',
};

const SECTIONS = [
  {
    title: 'Kortversionen',
    items: [
      'Freevobe körs lokalt och kräver inget konto.',
      'Din kod, dina prompter och dina filer lämnar inte datorn om du inte själv aktiverar en molntjänst.',
      'Ingen telemetri och ingen analys skickas från skrivbordsappen.',
      'Sponsorplatsen i chatten är avstängd tills du säger ja vid första starten, och kan stängas av när som helst.',
    ],
  },
  {
    title: 'Vad sparas lokalt',
    items: [
      'En SQLite-databas i ~/.freevobe med sessioner, meddelanden, projekt, projektminne, uppgifter och filindex.',
      'En åtkomsttoken i ~/.freevobe/token (rättigheter 0600). Den används bara mellan gränssnittet och agenten på 127.0.0.1.',
      'Skills, regler och minne i ditt projekt: .freevobe/skills/, .freevobe/rules.md, .freevobe/preferences.json och .freevobe/memory.md.',
    ],
  },
  {
    title: 'Vad som kan lämna datorn – och när',
    items: [
      'Ollama körs på localhost:11434. Modellanropet sker mot din egen maskin.',
      'Om du använder ett Ollama-bygge som pekar mot en fjärrserver, eller aktiverar molntjänster i inställningarna, går den trafiken dit du själv pekat ut.',
      'Webbläsarautomation och web_fetch gör nätverksanrop till de adresser du godkänt – varje anrop visas som ett godkännande.',
      'Github-integrationen anropar GitHub API först när du kopplat ett konto och begärt en pull request.',
    ],
  },
  {
    title: 'Annonser och Gives Back',
    items: [
      'Freevobe har inga annonser: ingen annonsnätverks-SDK, inga annonscookies och ingen tredje part för marknadsföring.',
      'I stället kan appen visa en frivillig påminnelse om ett välgörenhetsändamål. Den är av tills du slår på den.',
      'Platsen tar bara emot ett tal (antal prompter). Den har ingen åtkomst till prompter, filer eller svar.',
      'Freevobe tar inte emot pengar och har ingen betalningsfunktion – länken öppnar organisationens egen sida.',
      'Om du själv registrerar ett stöd sparas det bara lokalt, märkt som egen rapportering, och kan raderas.',
    ],
  },
  {
    title: 'Dina rättigheter',
    items: [
      'Du kan radera databasen, tokenfilen och .freevobe-mapparna när som helst – de är vanliga filer i din hemmapp.',
      'Ingen data finns hos oss, så det finns inget konto att avsluta.',
      'Frågor om integritet: privacy@freevobe.dev.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold">Integritetspolicy</h1>
        <p className="text-slate-400">
          Senast uppdaterad 2026-10-27. Principen är enkel: allt körs lokalt.
        </p>
      </header>

      {SECTIONS.map((section) => (
        <section key={section.title} className="vf-card space-y-2 p-6">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <ul className="space-y-1.5">
            {section.items.map((item) => (
              <li key={item} className="text-[13.5px] text-slate-400">
                • {item}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
