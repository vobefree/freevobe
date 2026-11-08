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
    slug: 'fran-prompt-till-klart',
    title: 'Från prompt till klart – utan mellansteg',
    date: '2026-11-08',
    summary:
      'Du skriver vad du vill ha. Freevobe skapar projektet, väljer modell, bygger, verifierar och öppnar resultatet.',
    body: [
      'De flesta agentverktyg ber dig godkänna varje steg: skapa filen, kör kommandot, öppna previewn. Det är tryggt men långsamt, och för en enkel beställning som "gör en hemsida till en frisör" blir klickandet mer arbete än att skriva koden själv.',
      'Freevobe kör därför prompt → klart som standard. En beställning skapar projektet i ~/Freevobe, väljer en modell med verktygsstöd, skriver filerna, kör kommandon och tester, verifierar och öppnar förhandsvisningen. Chatten visar "Bygger…" och sedan "Klart" – inga mellansteg.',
      'Säkerheten är inte bortkopplad, bara flyttad dit den hör hemma. Farliga kommandon, skrivningar utanför projektet, portexponering, media, webbläsarautomation, connector-ändringar och okända MCP-servrar kräver fortfarande ett personligt ja. Vill du hellre godkänna varje steg stänger du av läget i Inställningar → Agent och säkerhet.',
    ],
  },
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
    version: '0.5.0',
    date: '2026-11-08',
    highlights: [
      'Prompt → klart: en beställning skapar projektet, väljer en verktygsduglig modell, skriver koden, kör kommandon och tester, verifierar och öppnar förhandsvisningen – utan mellansteg eller godkännandekort. Farliga kommandon, media, webbläsarautomation, connector-ändringar och okända MCP-servrar kräver fortfarande ett personligt ja.',
      'Mörk, varumärkt installationsprofil: sidopanel och rubrikbild på Windows-installeraren och en egen bakgrund till macOS-diskbilden. Bilderna genereras i kod så att de kan återskapas.',
      'Signeringsverktyg för Windows: scripts/windows-sign.ps1 och scripts/new-windows-cert.ps1, plus dokumentation om SmartScreen och vad ett eget certifikat inte löser.',
      'Allt finns på tolv språk (829 nycklar), och releaseanteckningarna för 0.5.0 ligger i docs/releases/0.5.0.md.',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-11-07',
    highlights: [
      'Claude-likt gränssnitt: centrerad läskolumn, tre vylägen (Verbose, Normal, Summary) som filtrerar verktygsanrop och resonemang, och en sidchatt i en egen session vid sidan av huvudtråden.',
      'Ljust, mörkt och systemtema över hela appen – inklusive kodeditorn, som byter Monaco-tema direkt när du växlar. Alla val sparas mellan omstarterna.',
      'Qoder-läge: monospace-yta, dolda extraknappar och kolonkommandon i paletten (:w, :q, :run, :test, :verify, :theme, :qoder, :side).',
      'Dragbara paneler: byt plats på chatt och editor genom att dra i rubriken och dra i avdelaren för höjden. Ordningen och delningen sparas mellan omstarterna.',
      'Allt finns på tolv språk, och landningssidan visar de nya lägena.',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-11-02',
    highlights: [
      'Fler providers vid sidan av Ollama: Claude (text och vision), Gemini (text, vision, bild, video och ljud) och Grok (bild och video). Egna nycklar som sparas krypterat på datorn, plus en katalog som visar förmågor, modeller och pris per anrop.',
      'Multimodal agent: fem nya verktyg – generate_image, generate_video, generate_audio, analyze_image och analyze_video. Varje anrop kräver ett eget godkännande med prompt, provider, modell och beräknat pris.',
      'Media i chatten och i en egen Media-flik: genererade filer sparas i projektets .freevobe/media/ med metadata och kan användas direkt i koden.',
      'Kostnad och säkerhet: daglig budget i USD, kostnadsöversikt per provider och hårda promptregler mot hemligheter, filterkringgående och minderåriga.',
      'Medieflöden som inbyggd skill och dokumentation: hela kedjan från prompt till färdig, verifierad fil – plus en lokal-only-banner som förklarar vad som krävs.',
    ],
  },
  {
    version: '0.2.6',
    date: '2026-10-30',
    highlights: [
      'Appen uppdaterar sig själv: fyra sekunder efter start frågar den efter en nyare version, laddar ner den signerade filen och startar om. Nedladdningssidan behövs bara för den första installationen.',
      'Signaturen kontrolleras innan något installeras. En fil som inte är signerad med appens egen nyckel avvisas, och ett misslyckat försök syns i stället för att bannern tyst försvinner.',
      'Alla installerade 0.2.6 och senare uppdateras automatiskt; 0.2.5 och äldre måste installeras om för hand en sista gång.',
    ],
  },
  {
    version: '0.2.5',
    date: '2026-10-30',
    highlights: [
      'Standardmodellen är nu qwen2.5-coder:7b. Den tidigare standardmodellen är en resonemangsmodell som inte klarar verktygsanrop – den svarade med en beskrivning i stället för att skriva filen.',
      'Modeller som hittar på egna JSON-format (files, actions, command) får dem tolkade som riktiga verktygsanrop, så ändringen utförs i stället för att stanna som text i chatten.',
      'Instruktionen för hur en ändring utförs ligger sist i prompten, närmast samtalet – och en befintlig installation flyttas automatiskt till den nya standardmodellen.',
    ],
  },
  {
    version: '0.2.4',
    date: '2026-10-30',
    highlights: [
      'Chatten visar aldrig rå JSON: text som kan visa sig vara ett verktygsanrop hålls tillbaka medan den strömmar och släpps först när den är färdig.',
      'Prosa strömmar som vanligt – färdiga JSON-block som inte är anrop släpps igenom direkt, och hela svaret kommer ändå som ett vanligt meddelande.',
      'Gäller naken JSON, ```json-staket och <tool_call>, även när modellen uppger att den har verktygsstöd.',
    ],
  },
  {
    version: '0.2.3',
    date: '2026-10-30',
    highlights: [
      'Verktygsanrop som modellen skriver som JSON i texten tolkas nu även när modellen uppger att den har verktygsstöd – tidigare stannade Plan-läget på rå JSON och inget hände.',
      'Naken JSON, ```json-staket, <tool_call>-block och JSON som klippts av mitt i ett svar känns igen; anropet tas bort ur chatten och körs som vanligt.',
      'En plan som lagts fram i texten blir ett riktigt planförslag som går att godkänna i stället för ett dött svar.',
    ],
  },
  {
    version: '0.2.2',
    date: '2026-10-29',
    highlights: [
      'Chatten står inte längre tom medan Ollama läser in modellen: en väntebubbla visar fasen och, om första token dröjer, att just din modell laddas.',
      'Förklaringen talar om att en kall modell kan ta upp till en minut – så väntetiden ser aldrig ut som en hängning.',
      'Språkväljaren på webbplatsen visar vilket språk som är aktivt och behåller sidan du står på när du byter.',
    ],
  },
  {
    version: '0.2.1',
    date: '2026-10-29',
    highlights: [
      'Långsam modellinläsning räknas inte längre som att Ollama är frånkopplad: ett chattsvar får upp till 20 minuter på sig, medan hälsofrågorna fortsätter svara snabbt.',
      'När tidsgränsen ändå nås står det att tiden tog slut och att modellen kan laddas – inte att servern är onåbar.',
      'Ett avbrott du själv gör rapporteras som avbruten körning i stället för ett nätverksfel.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-10-29',
    highlights: [
      'Connectors: koppla in Vercel, GitHub och fler tjänster med token i det lokala valvet – verktygen syns bara när connectorn är påslagen i projektet.',
      'Vercel-connectorn: projekt, preview-deploy, byggloggar, env-variabler och domäner. Produktion kräver alltid ett extra godkännande.',
      'Gränssnittet finns på tolv språk med språkvalsmeny i inställningarna; svenska och engelska är översatta för hand.',
      'Säkrare godkännanden: connectorverktyg är fail-closed och hemliga värden maskeras i godkännandekortet.',
    ],
  },
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
  {
    name: 'media-flows',
    description:
      'Hela kedjan från prompt till färdig bild, video eller ljud: välj provider, beskriv, godkänn kostnaden och använd filen i koden.',
    triggers: ['bild', 'video', 'ljud', 'media', 'image'],
    tools: ['generate_image', 'generate_video', 'generate_audio', 'analyze_image', 'read_file'],
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
    id: 'providers',
    title: 'Providers och media',
    paragraphs: [
      'Ollama är standard och kräver ingen nyckel. Utöver den kan du lägga till Claude (text och vision), Gemini (text, vision, bild, video och ljud) och Grok (bild och video) i Inställningar → Providers. Nycklarna sparas krypterat i det lokala valvet och skickas bara till den provider du själv valt.',
      'Molntjänster är avstängda tills du slår på Tillåt molntjänster och providerns egen strömbrytare. Utan det stannar en medieuppgift med ett tydligt besked i stället för att skickas iväg.',
      'Fem verktyg hanterar media: generate_image, generate_video, generate_audio, analyze_image och analyze_video. Varje anrop kräver ett eget godkännande som visar prompt, provider, modell och beräknat pris, och en daglig budget i USD stoppar anrop innan de skickas.',
      'Filerna sparas i projektets .freevobe/media/ tillsammans med en metadatafil – provider, modell, prompt, storlek och kostnad, aldrig nycklar. De syns i chatten och i Media-fliken i högerpanelen.',
    ],
    commands: [
      { label: 'Se metadata för sparad media', value: 'cat .freevobe/media/*.json' },
      { label: 'Rensa media i ett projekt', value: 'rm -r .freevobe/media' },
    ],
  },
  {
    id: 'media-flows',
    title: 'Från prompt till färdig fil',
    paragraphs: [
      'Skillen media-flows beskriver tre flöden: en hero-bild till en sida, en kort video som bakgrund och ett ljudintro med spelare. I alla tre letar agenten efter en befintlig fil först, skriver en beskrivande prompt, säger vad den tänker göra innan anropet och läser sökvägen ur verktygssvaret i stället för att hitta på den.',
      'Efter godkännandet hamnar filen i .freevobe/media/, visas i chatten och kan användas direkt i koden. Sedan körs projektets egna kontroller som vanligt, så att en bild eller video inte räknas som klar förrän sidan faktiskt fungerar.',
      'Avvisar du ett godkännande föreslår agenten ett billigare alternativ – en mindre bild, färre sekunder eller en lokal fil du redan har – i stället för att försöka igen med samma anrop.',
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
