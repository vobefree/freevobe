/**
 * Allt innehåll på den publika sajten ligger som lokala data. Det gör sajten statisk,
 * snabb och enkel att granska i git. Byt gärna ut det mot en CMS-lösning senare – formerna
 * nedan är medvetet enkla att mappa mot ett API.
 */

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  summary: string;
  body: string[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'varfor-lokal-first',
    title: 'Varför Freevobe är lokal-first',
    date: '2026-10-20',
    summary:
      'Koden är ofta det mest känsliga du äger. Vi byggde Freevobe så att den aldrig behöver lämna datorn.',
    body: [
      'Molntjänster är bekväma, men de kräver att du skickar din kod, dina prompter och ibland dina kunders uppgifter till någon annans server. För många team är det inte ett alternativ.',
      'Freevobe kör modellen via Ollama på din egen maskin. Agent-loopen, filverktygen, testkörningen och git-integrationen körs lokalt i en Node-process som bara lyssnar på 127.0.0.1 och kräver en token i varje anrop.',
      'Ingen telemetri. Ingen inloggning. Ingen molnkonto. Det enda som lämnar datorn är det du själv uttryckligen aktiverar – till exempel ett webbläsaranrop som du godkänt.',
    ],
  },
  {
    slug: 'diffar-fore-sparning',
    title: 'Därför visas varje ändring som en diff först',
    date: '2026-10-24',
    summary: 'En agent som får skriva fritt är snabb men obegriplig. Vi valde begripligheten.',
    body: [
      'När agenten vill skriva en fil skickar den en godkännandeförfrågan med det fullständiga diff-förslaget. Filen skrivs först när du sagt ja – i auto-lägena efter att diffen registrerats och loggats.',
      'Diffen ligger kvar i högerpanelen efter körningen, med radnummer för både gammalt och nytt innehåll. Du kan alltid gå tillbaka och se exakt vad som hände i en session.',
      'Samma sak gäller kommandon: varje terminalkommando syns i terminalpanelen med utdata och exitkod, och farliga kommandon blockeras även i full auto.',
    ],
  },
  {
    slug: 'skills-som-filer',
    title: 'Skills är bara Markdown-filer',
    date: '2026-10-26',
    summary: 'Ett skill är en fil i ditt repo, inte en inställning i en molntjänst.',
    body: [
      'Ett skill är en Markdown-fil med YAML-frontmatter i .freevobe/skills/. Den beskriver vilka verktyg som får användas, vilka triggers som aktiverar den och hur arbetet ska gå till.',
      'Eftersom skillen ligger i repot kan hela teamet granska den i en pull request, och den följer med när projektet flyttas. Du kan importera och exportera skills som text.',
      'Triggers gör att rätt skill aktiveras automatiskt när du skriver om React, databasmigreringar eller buggfixar. Du kan också peka ut en skill direkt med @skillnamn.',
    ],
  },
];

export interface ChangelogEntry {
  version: string;
  date: string;
  highlights: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.1.0',
    date: '2026-10-27',
    highlights: [
      'Första MVP: Tauri-skal, agent-loop med tool calling mot Ollama, diff-granskning och godkännanden.',
      'Filverktyg, terminal, tester och git-status/diff/commit med AI-genererat commit-meddelande.',
      'Skills, projektregler, minne, MCP-klient (stdio/HTTP/SSE), subagents och hooks.',
      'Sponsorplats i chatten (avstängd som standard), Doctor-läge och publik webbplats.',
    ],
  },
];

export interface GallerySkill {
  name: string;
  description: string;
  triggers: string[];
  tools: string[];
}

export const GALLERY_SKILLS: GallerySkill[] = [
  {
    name: 'react-component',
    description:
      'Skapar React-komponenter enligt projektets konventioner, med tester och tillgänglighet.',
    triggers: ['react', 'component', 'ui'],
    tools: ['read_file', 'write_file', 'run_tests'],
  },
  {
    name: 'nextjs-page',
    description:
      'Lägger till en sida i en Next.js-app med rätt routing, metadata och datahämtning.',
    triggers: ['next', 'page', 'route'],
    tools: ['read_file', 'write_file', 'run_tests'],
  },
  {
    name: 'api-endpoint',
    description: 'Bygger en HTTP-endpoint med validering, felhantering och tester.',
    triggers: ['api', 'endpoint', 'rest'],
    tools: ['read_file', 'write_file', 'run_tests'],
  },
  {
    name: 'python-script',
    description: 'Skriver små Python-skript med argparse, tydliga fel och en enkel testfil.',
    triggers: ['python', 'script'],
    tools: ['write_file', 'run_terminal_command'],
  },
  {
    name: 'bug-fix',
    description:
      'Felsöker systematiskt: reproducera, läs felutdatan, rätta orsaken och lås med ett test.',
    triggers: ['bug', 'bugg', 'fel', 'krasch', 'regression'],
    tools: ['read_file', 'search_files', 'edit_file', 'run_tests'],
  },
  {
    name: 'test-writing',
    description: 'Skriver tester som beskriver beteende och som misslyckas innan fixen.',
    triggers: ['test', 'tester', 'coverage'],
    tools: ['read_file', 'write_file', 'run_tests'],
  },
  {
    name: 'code-review',
    description: 'Granskar en diff efter buggar, säkerhetsproblem, prestandarisker och läsbarhet.',
    triggers: ['review', 'granska', 'kodgranskning'],
    tools: ['read_file', 'git_diff', 'search_files'],
  },
  {
    name: 'refactoring',
    description: 'Refaktorerar utan att ändra beteende, i små verifierbara steg.',
    triggers: ['refactor', 'refaktorera', 'städa'],
    tools: ['read_file', 'edit_file', 'run_tests'],
  },
  {
    name: 'documentation',
    description:
      'Skriver och uppdaterar dokumentation enligt Diátaxis: tutorial, how-to, referens och förklaring.',
    triggers: ['docs', 'dokumentation', 'readme'],
    tools: ['read_file', 'write_file'],
  },
  {
    name: 'database-migration',
    description: 'Skriver migreringar som är bakåtkompatibla, med backfill och återställningsplan.',
    triggers: ['migration', 'databas', 'schema'],
    tools: ['read_file', 'write_file', 'run_terminal_command', 'run_tests'],
  },
];

export interface DocSection {
  id: string;
  title: string;
  paragraphs: string[];
  commands?: { label: string; value: string }[];
}

export const DOC_SECTIONS: DocSection[] = [
  {
    id: 'kom-igang',
    title: 'Kom igång',
    paragraphs: [
      'Installera Ollama och hämta en modell med tool calling, till exempel qwen2.5-coder eller llama3.1. Starta sedan agenten och skrivbordsappen från källkoden.',
      'Första starten guidar dig genom lokal databehandling, Ollama-anslutning och ett valfritt samtycke för sponsorplatsen i chatten.',
    ],
    commands: [
      { label: 'Hämta en modell', value: 'ollama pull qwen2.5-coder:7b' },
      { label: 'Installera beroenden', value: 'npm install' },
      { label: 'Starta agent + app', value: 'npm run dev' },
      { label: 'Kontrollera miljön', value: 'npm run doctor' },
    ],
  },
  {
    id: 'arkitektur',
    title: 'Arkitektur',
    paragraphs: [
      'Freevobe består av tre delar: agent-core (agent-loop, verktyg, kontext, skills, minne, MCP), agent-server (HTTP/SSE på 127.0.0.1 med token) och skrivbordsappen (Tauri 2 + React).',
      'Skrivbordsappen startar agenten som en sidecar, väntar tills /api/health svarar och injicerar sedan adress och token i webbvyn. Ingen trafik går utanför loopback.',
    ],
  },
  {
    id: 'verktyg',
    title: 'Verktyg och säkerhet',
    paragraphs: [
      'Agenten har verktyg för att lista, läsa, söka, skriva, redigera och radera filer, köra kommandon och tester, hantera git och styra en webbläsare via Playwright.',
      'I standardläget kräver varje skrivning och varje kommando ditt godkännande. I full auto blockeras ändå farliga kommandon och skrivningar utanför projektroten. Varje filändring producerar en diff.',
    ],
  },
  {
    id: 'skills',
    title: 'Skills, regler och minne',
    paragraphs: [
      'Skills ligger i .freevobe/skills/ och aktiveras via triggers eller @namn. Regler läses från AGENTS.md och .freevobe/rules.md, och projektminnet från .freevobe/memory.md – allt lokalt och versionshanterat.',
    ],
  },
  {
    id: 'mcp',
    title: 'MCP och subagents',
    paragraphs: [
      'MCP-servrar läggs till per projekt och kan köras över stdio, HTTP eller SSE. Deras verktyg, resurser och prompts dyker upp som vanliga agentverktyg efter att du godkänt servern.',
      'Subagents (Explorer, Implementer, Tester, Reviewer, Documenter) körs med isolerad kontext och returnerar korta sammanfattningar till huvudagenten.',
    ],
  },
];

export const COMMUNITY_LINKS = [
  {
    label: 'GitHub Discussions',
    href: 'https://github.com/vobefree/freevobe/discussions',
    note: 'Frågor, idéer och felsökning.',
  },
  {
    label: 'GitHub Issues',
    href: 'https://github.com/vobefree/freevobe/issues',
    note: 'Buggrapporter och funktionsförslag.',
  },
  {
    label: 'Skills-registret',
    href: '/skills/',
    note: 'Skicka in ditt skill som en pull request.',
  },
  { label: 'Release-flödet', href: '/changelog/', note: 'Se vad som ändrats mellan versioner.' },
];
