# Freevobe

**Lokal-first vibecoding för skrivbordet.** Anslut Ollama, välj modell och bygg mjukvara genom att beskriva vad du
vill ha. Freevobe planerar, utforskar kodbasen, skriver kod, kör kommandon, testar, granskar diffar, committar och kan
styra en webbläsare – allt på din egen dator.

> **Koden lämnar inte datorn.** Modellen körs via Ollama på `localhost`. Ingen telemetri, ingen inloggning, inget
> molnkonto. Det enda som går över nätet är det du själv uttryckligen godkänner.

[English README](README.en.md) · [Arkitektur](docs/architecture.md) · [Säkerhet](docs/safety.md) ·
[Behörigheter](docs/permissions.md) · [Plan/Act](docs/plan-act.md) · [Skills](docs/skills.md) ·
[MCP](docs/mcp.md) · [Checkpoints](docs/checkpoints.md) · [Verifiering](docs/verification.md) ·
[Release](docs/releasing.md) · [TODO](TODO.md)

---

## Innehåll

1. [Vad systemet kan](#vad-systemet-kan)
2. [Kom igång](#kom-igång)
3. [Så ser en körning ut](#så-ser-en-körning-ut)
4. [Säkerhetsmodell](#säkerhetsmodell)
5. [Arkitektur](#arkitektur)
6. [Skills, regler och minne](#skills-regler-och-minne)
7. [MCP, subagents och hooks](#mcp-subagents-och-hooks)
8. [Connectors (opt-in)](#connectors-opt-in)
9. [Checkpoints och ångra](#checkpoints-och-ångra)
10. [Gives Back i stället för annonser](#gives-back-i-stället-för-annonser)
11. [Projektstruktur](#projektstruktur)
12. [Kommandon](#kommandon)
13. [Testning](#testning)
14. [Bygga appen](#bygga-appen)
15. [Begränsningar och TODO](#begränsningar-och-todo)

---

## Vad systemet kan

| Område           | Funktion                                                                                                                                                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Modell**       | Ollama över OpenAI-kompatibelt API (`/v1/chat/completions`), streaming, tool calling och detektering av modeller som saknar verktygsstöd.                                                                                                                                                                                      |
| **Agent-loop**   | Kontextbygge → modellsvar → verktygsanrop → körning → verktygssvar → reflektion → nytt varv eller slutligt svar.                                                                                                                                                                                                               |
| **Verktyg**      | `list_files`, `read_file`, `search_files`, `create_file`, `write_file`, `edit_file`, `delete_file`, `run_terminal_command`, `run_tests`, `git_status`, `git_diff`, `git_commit`, `git_branch`, `web_fetch`, `browser_open/read/screenshot/click/fill`, `propose_plan`, `run_verification`, `ask_user` – plus alla MCP-verktyg. |
| **Kontext**      | Repo map, lokala embeddings, import- och symbolanalys, importgrannar, pin:ade filer och en hård kontextbudget. Bara det som behövs skickas till modellen.                                                                                                                                                                      |
| **Granskning**   | Varje filändring visas som en diff (både som förslag i godkännandet och som historik i högerpanelen).                                                                                                                                                                                                                          |
| **Behörigheter** | Fyra behörighetslägen plus **auto-godkännande per kategori** (filer, kommandon, tester, git, nätverk, MCP). Hårda block – farliga kommandon, webbläsare och icke-godkända MCP-servrar – frågar alltid. Mer i [Behörigheter](docs/permissions.md).                                                                              |
| **Plan/Act**     | En plan läggs fram i Plan-läget, godkänns av dig och blir ett kontrakt: filer utanför planen kräver alltid ett personligt ja. Mer i [Plan/Act](docs/plan-act.md).                                                                                                                                                              |
| **Checkpoints**  | Filens tidigare innehåll sparas före varje ändring. Backa till valfri punkt i tidslinjen, eller committa checkpointen till Git – helt utanför Git-historiken. Mer i [Checkpoints](docs/checkpoints.md).                                                                                                                        |
| **Verifiering**  | Efter en körning som ändrat filer körs projektets egna typkontroll, lint och tester – med en rapport per steg i stället för ett påstående om att allt fungerar. Mer i [Verifiering](docs/verification.md).                                                                                                                     |
| **Utbyggnad**    | Skills (Markdown i `.freevobe/skills/`), projektregler (`AGENTS.md`, `.freevobe/rules.md`), projektminne (`.freevobe/memory.md`), hooks och MCP (stdio, HTTP, SSE).                                                                                                                                                            |
| **Subagents**    | Explorer, Implementer, Tester, Reviewer och Documenter med isolerad kontext och korta sammanfattningar tillbaka.                                                                                                                                                                                                               |
| **Git**          | Status, branch, diff, commit med AI-genererat meddelande och ett code review-läge.                                                                                                                                                                                                                                             |
| **Distribution** | Windows `.exe` (NSIS), macOS `.dmg`, Linux `.AppImage`/`.deb`, Doctor-läge, onboarding och en publik webbplats.                                                                                                                                                                                                                |

## Kom igång

**Krav:** Node 22.5+, [Ollama](https://ollama.com) och en modell med tool calling. För att bygga skrivbordsappen krävs
även Rust och Tauri-beroendena.

```bash
# 1. Hämta en modell som klarar verktygsanrop
ollama pull qwen2.5-coder:7b

# 2. Klona och installera
git clone https://github.com/vobefree/freevobe.git
cd freevobe
npm install

# 3. Kör agenten och skrivbordsgränssnittet
npm run dev
```

`npm run dev` startar agenten på `127.0.0.1:4319` (token krävs i `x-freevobe-token`) och gränssnittet på
`http://127.0.0.1:1420`. Första gången får du ett onboardingflöde: samtycke för lokal databehandling, Ollama-anslutning,
projektmapp och ett **valfritt** val om Gives Back i chatten.

Kontrollera miljön när som helst:

```bash
npm run doctor
```

```
✓ Node.js: v24.19.0
✓ Lokal datamapp: C:\Users\du\.freevobe är skrivbar
✓ Projektmapp: … (14 poster)
✓ Ledigt diskutrymme: 483845 MB ledigt
✓ Git: git version 2.54.0.windows.1
✓ Testkommando: vitest run
✓ Ollama: http://localhost:11434 (v0.40.5), 2 modeller
```

Första svaret från en modell kan dröja: Ollama laddar in hela modellen innan första token kommer, vilket tar
15–90 sekunder för en 7B-modell på en vanlig laptop. Hälso- och modellfrågorna ger upp efter 15 sekunder, men ett
chattsvar får upp till 20 minuter – annars skulle en kall modell se ut som en frånkopplad Ollama. Om gränsen ändå
nås står det i felet att tiden tog slut, inte att servern är onåbar.

## Så ser en körning ut

Den vertikala skivan som allt annat bygger på:

```
du: "Läs package.json och skapa src/hello.ts"
  → kontext byggd (2 filer, 24 tecken)
  → tool_call read_file { path: "package.json" }
  → tool_result  (3 rader)
  → tool_call write_file { path: "src/hello.ts", content: … }
  → diff         src/hello.ts  +1 −0   (väntar på dig)
  → godkännande  → filen skrivs
  → assistant_message "Klart. Jag skapade src/hello.ts …"
```

Stegen syns i gränssnittet: kontext i mittenpanelen, diff och godkännanden till höger, allt i loggen och varje
terminalutdata i terminalpanelen.

## Säkerhetsmodell

Fyra behörighetslägen:

| Läge                        | Filändringar                               | Kommandon          |
| --------------------------- | ------------------------------------------ | ------------------ |
| **Fråga alltid** (standard) | Kräver godkännande                         | Kräver godkännande |
| **Auto-redigera**           | Skrivs efter att diffen visats och loggats | Kräver godkännande |
| **Auto-kör**                | Skrivs direkt                              | Körs direkt        |
| **Full auto**               | Skrivs direkt                              | Körs direkt        |

**I alla lägen, även full auto, blockeras:**

- `rm -rf`, `sudo`, `format` och andra destruktiva kommandon,
- skrivningar och borttagningar utanför projektroten,
- att exponera portar och att skicka hemligheter till externa tjänster.

Dessutom: varje filändring producerar en diff, varje kommando syns i terminalen, approve/reject loggas i sessionen,
webbläsarautomation kräver eget godkännande och MCP-servrar är avstängda tills du aktiverar dem per projekt. Se
[Säkerhet](docs/safety.md) för detaljerna.

## Arkitektur

```
apps/desktop      Tauri 2 + React + Tailwind. Startar agenten, injicerar adress + token i webbvyn.
apps/web          Publik webbplats (Next.js, statiskt exporterad).
packages/protocol Delade typer, verktygsscheman, händelser och IPC-kontrakt.
packages/agent-core  Agent-loop, verktyg, kontextmotor, skills, minne, MCP, subagents, hooks, SQLite.
packages/agent-server HTTP + SSE på 127.0.0.1 med token och origin-skydd.
```

Allt körs i en Node-process på din maskin. Skrivbordsappen startar agenten, väntar tills `/api/health` svarar och
injicerar sedan bas-URL och token i webbvyn. Mer i [Arkitektur](docs/architecture.md).

## Skills, regler och minne

- **Skills** ligger som Markdown med YAML-frontmatter i `.freevobe/skills/`. Tio färdiga skills följer med
  (React-komponent, Next.js-sida, API-endpoint, Python-skript, buggfix, tester, kodgranskning, refaktorering,
  dokumentation, databasmigrering). Aktiveras via triggers eller `@skillnamn`.
- **Regler** läses automatiskt från `AGENTS.md`, `.freevobe/rules.md` och `.freevobe/preferences.json` och injiceras i
  systemprompten.
- **Minne** ligger i `.freevobe/memory.md` – lokalt, läsbart och versionshanterat tillsammans med koden.

Redigera allt i appen (Skills-, Minne- och Inställningsdialogerna) eller direkt i filerna. Mer i [Skills](docs/skills.md).

## MCP, subagents och hooks

- **MCP**: lägg till servrar per projekt över stdio, HTTP eller SSE. Verktyg, resurser och prompts från servern dyker upp
  som vanliga agentverktyg. Exempelkonfiguration för filesystem, GitHub, Postgres, Playwright och webbsökning finns i
  MCP-dialogen. Mer i [MCP](docs/mcp.md).
- **Subagents**: `explorer`, `implementer`, `tester`, `reviewer`, `documenter`. De körs med isolerad kontext och lämnar
  korta sammanfattningar; statusen visas i vänsterpanelen.
- **Hooks**: kör kommandon vid `on_session_start`, `before/after_file_edit`, `before/after_terminal_command`,
  `before/after_test_run` och `before/after_commit` – t.ex. ESLint efter varje ändring eller tester före commit.

## Connectors (opt-in)

Freevobe kan kopplas till tjänsterna du redan använder – GitHub, Vercel, Supabase och några till – men bara när du
själv ansluter dem. Katalogen ligger i **Inställningar → Connectors**: ett kort per tjänst med status, antal verktyg och
en knapp som visar **exakt vilka behörigheter** som begärs innan du klistrar in något.

- Token sparas **krypterat** (AES-256-GCM) i din Freevobe-home med rättigheten 0600 – aldrig i databasen, aldrig i
  projektet och aldrig i modellens kontext. Servern lämnar bara ut en maskerad ledtråd.
- Token är global för maskinen, men **valet att använda connectorn är per projekt**. Ett projekt kan köra helt lokalt
  medan ett annat deployar.
- **Koppla bort** raderar token lokalt och visar vilka behörigheter som därmed inte längre används. Vill du
  ogiltigförklara den helt återkallar du den även hos leverantören.
- `git` är inbyggd och kräver ingen nyckel. Tjänster som ännu inte är klara (Netlify, Railway, Stripe, Resend,
  Cloudflare, Neon) syns som **kommer snart** – de går inte att ansluta av misstag.
- **Vercel har verktyg**: projekt, preview-deploy, byggloggar, miljövariabler och domäner. Deploy går till preview
  först; **produktion kräver ett extra ja** utöver det vanliga godkännandet, och env-värden kan läsas från en fil i
  projektet så att hemligheter aldrig hamnar i chatten.
- Saknas din tjänst? Koppla in vilken MCP-server som helst i stället.

Mer i [Connectors](docs/connectors.md).

## Checkpoints och ångra

Varje filagenten ändrar får en checkpoint med innehållet den hade innan. Tidslinjen i högerpanelen visar tid,
filer, teststatus och en knapp för att återställa, kassera eller committa. Återställningen vägrar skriva över
filer som ändrats sedan checkpointen utan att du bekräftar det. Mer i [Checkpoints](docs/checkpoints.md).

## Plan/Act

Växla chatten till **Plan-läget** och beskriv uppgiften. Agenten läser koden men får inte skriva: den lägger i
stället fram en plan med `propose_plan` – rubrik, steg och vilka filer som berörs. Planen sparas, visas som ett kort i
chatten och avslutar körningen (`plan-ready`).

När du klickar **Godkänn & utför** blir planen ett kontrakt: sessionen växlar till Execute, planen skickas in i
systemprompten och varje filändring prövas mot planens filista. En fil utanför planen kräver ett personligt ja,
oavsett behörighetsläge – och en ny godkänd plan ersätter den gamla, så det finns alltid exakt ett kontrakt. Mer i
[Plan/Act](docs/plan-act.md).

## Verifiering

En agent som säger "klart" är inte samma sak som kod som fungerar. När en körning ändrat filer kör Freevobe
projektets **egna** kontroller – typkontroll, lint och tester – och visar en rapport per steg med kommando, exit-kod,
tid och utdata. Inget hittas på: bara kommandon som faktiskt finns i `package.json` (eller `pyproject.toml`,
`Cargo.toml`, `go.mod`) körs, och rapporten skickas innan körningen avslutas så att den hinner synas.

Rapporten ligger kvar i högerpanelen under **Verifiering**, även efter en omstart. Du kan också köra den själv när
som helst, från panelen eller kommandopaletten, och agenten har samma motor som verktyget `run_verification`. Mer i
[Verifiering](docs/verification.md).

## Gives Back i stället för annonser

Freevobe har inga annonsplatser, inga annonsskript och inga annonsnätverk. I stället kan appen – om du själv slår på
det – visa en frivillig påminnelse om ett välgörenhetsändamål. Den är en egen komponent med ett medvetet minimalt API:
den tar **bara emot ett tal** (antal användarprompter) och har ingen åtkomst till prompter, filer, kontext eller svar.

- Av som standard. Slås på i onboarding eller i inställningarna, och visas då efter var 10:e prompt.
- Alltid märkt **Gives Back**, i eget block mellan chattbubblorna – aldrig inuti ett svar.
- **Inga pengar går genom Freevobe.** Ingen kassa, inget konto, ingen betalningsleverantör. Länken öppnar
  organisationens egen sida.
- Du kan anteckna att du gett något. Posten sparas bara lokalt, märks som **egen rapportering** och kan raderas.
- Katalogen (Läkare Utan Gränser, Rädda Barnen, UNICEF, WWF, Wikimedia Foundation, Kiva) är redaktionell och har
  ingen koppling till provision eller spårning.
- Webbplatsen visar samma princip i sektionen **Gives Back** och har ingen annonskod kvar.

Mer i [Gives Back](docs/gives-back.md).

## Projektstruktur

```
freevobe-desktop/
├─ apps/
│  ├─ desktop/            Tauri-skal + React-gränssnitt
│  │  ├─ src/             Paneler, chatt, editor, diff, terminal, dialoger
│  │  └─ src-tauri/       Rust-skal, capabilities, ikoner
│  └─ web/                Publik webbplats (Next.js)
├─ packages/
│  ├─ protocol/           Delade typer och kontrakt
│  ├─ agent-core/         Agent-loop, verktyg, kontext, skills, minne, MCP, subagents, store
│  │  └─ builtin-skills/  Tio färdiga skills
│  └─ agent-server/       HTTP + SSE på 127.0.0.1
├─ e2e/                   Playwright: vertikal skiva över HTTP och i gränssnittet
├─ scripts/               Ikoner, sidecar-bygge, TypeScript-hook
└─ docs/                  Arkitektur, säkerhet, skills, MCP, connectors, checkpoints, verifiering, release
```

## Kommandon

```bash
npm run dev            # agent + skrivbordsgränssnitt
npm run dev:server     # bara agenten (127.0.0.1:4319)
npm run dev:web        # publika webbplatsen (127.0.0.1:4320)
npm run doctor         # miljökontroll (Node, Git, Ollama, modell, disk, datamapp)
npm run typecheck      # tsc --noEmit i alla paket
npm run lint           # ESLint
npm run format         # Prettier
npm test               # Vitest (enhetstester + API/UI-tester i jsdom)
npm run test:watch     # Vitest i watch-läge
npm run test:e2e       # Playwright (startar agent, fejkad Ollama och vite)
npm run icons          # genererar appikoner (PNG/ICO/ICNS)
npm run sidecar:build  # paketerar agenten som fristående binär (Node SEA)
npm run tauri build    # bygger .exe/.dmg/.AppImage/.deb
npm run verify         # typecheck + lint + tester
```

## Testning

```bash
npm run verify      # allt som CI kör, förutom E2E
npm run test:e2e    # end-to-end i webbläsare och över HTTP

# Kör sviten vid sidan av en installerad Freevobe-app som redan äger standardportarna:
FREEVOBE_E2E_AGENT_PORT=4339 FREEVOBE_E2E_OLLAMA_PORT=4398 FREEVOBE_E2E_WEB_PORT=1423 \
  npm run test:e2e
```

- **Enhetstester** (Vitest) täcker verktygen, godkännandepolicyn, kontextmotorn, skills, regler, minne, MCP-klienten
  (mot en riktig process över stdio), subagents, hooks, SQLite-lagret, HTTP-ytan och React-komponenterna.
- **E2E** (Playwright) kör den vertikala skivan mot den riktiga agenten med en fejkad Ollama: prompt → läs fil →
  förslag → godkännande → diff → skriven fil → svar, både över HTTP och genom gränssnittet. Checkpoint-flödet har ett eget
  scenario (`e2e/checkpoints.ui.spec.ts`) som går från agentkörning till tidslinje, diff, konfliktvarning och tvingad
  återställning. Plan/Act har ett eget scenario (`e2e/plan-mode.ui.spec.ts`) som visar att planen läggs fram utan att
  något skrivs och att godkännandet startar körningen. Verifieringen har ett eget scenario
  (`e2e/verification.ui.spec.ts`) där en körning ändrar en fil och de tre stegen körs automatiskt med rapport i
  panelen och statusraden. Inget nätverk och ingen riktig modell behövs.

## Bygga appen

```bash
npm run icons        # appikoner
npm run tauri build  # bygger installeraren för din plattform
```

Appen uppdaterar sig själv: den frågar `latest.json` i den senaste releasen, verifierar signaturen och startar om i
den nya versionen. Det börjar gälla från 0.2.6 – 0.2.5 och äldre saknar kontrollen och måste installeras om en
sista gång för hand. Uppdateringsnyckeln måste finnas som hemlighet i CI (`TAURI_SIGNING_PRIVATE_KEY`) – se
[Release](docs/releasing.md#automatisk-uppdatering).

## Begränsningar och TODO

- [ ] **Signering**: workflowen signerar, notariserar och verifierar filerna när certifikaten finns som hemligheter (`WINDOWS_CERTIFICATE`, `APPLE_*`, `ANDROID_KEYSTORE_BASE64`). Utan dem varnar operativsystemet vid installation. Se [Release](docs/releasing.md#signering).
- [x] **Auto-uppdatering**: på från 0.2.6 – nyckeln ligger som hemlighet i CI, `latest.json` skrivs av workflowen och appen verifierar signaturen innan den installerar.
- [ ] **Release-server**: GitHub Releases används som standard; egen server om du vill ha kanaler (beta/stable).
- [ ] **Telemetri**: medvetet avstängt (`telemetry: false`) och kan inte slås på från gränssnittet.
- [ ] **Pro-funktioner**: delade skills mellan projekt, team-minne och fjärrstyrda agenter bakom en betald licens.
- [ ] **Connectors – OS-keychain**: token krypteras i dag med en lokal 0600-nyckel. Att binda nyckeln till macOS
      Keychain / Windows Credential Manager / libsecret är nästa härdning (samma gränssnitt: `get`/`set`/`delete`/`hint`).
- [ ] **Connectors – API-verifiering**: anslutningen sparas utan att token prövas direkt. Först när ett
      connectorverktyg körs (t.ex. `vercel_list_projects`) märks en ogiltig token, och felet visas då på kortet.
      Nästa steg är att verifiera vid anslutning; Supabase och GitHub får verktyg i steg 3–4.
- [ ] **Fler modeller**: en molntransport (OpenAI/Anthropic) bakom samma `ChatTransport`-gränssnitt – kräver uttryckligt
      samtycke per projekt.
- [ ] **Embeddings**: en riktig vektormodell i stället för den lokala hash-baserade vektorn.
- [ ] **Rust-skalet**: `apps/desktop/src-tauri` är skrivet men inte kompilerat i den här miljön (ingen Rust-toolchain).
      Kör `npm run tauri build` på en maskin med Rust för att verifiera.

Full lista i [TODO.md](TODO.md).

## Licens

MIT.
