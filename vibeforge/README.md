# VibeForge

**Lokal-first vibecoding för skrivbordet.** Anslut Ollama, välj modell och bygg mjukvara genom att beskriva vad du
vill ha. VibeForge planerar, utforskar kodbasen, skriver kod, kör kommandon, testar, granskar diffar, committar och kan
styra en webbläsare – allt på din egen dator.

> **Koden lämnar inte datorn.** Modellen körs via Ollama på `localhost`. Ingen telemetri, ingen inloggning, inget
> molnkonto. Det enda som går över nätet är det du själv uttryckligen godkänner.

[English README](README.en.md) · [Arkitektur](docs/architecture.md) · [Säkerhet](docs/safety.md) ·
[Skills](docs/skills.md) · [MCP](docs/mcp.md) · [Release](docs/releasing.md) · [TODO](TODO.md)

---

## Innehåll

1. [Vad systemet kan](#vad-systemet-kan)
2. [Kom igång](#kom-igång)
3. [Så ser en körning ut](#så-ser-en-körning-ut)
4. [Säkerhetsmodell](#säkerhetsmodell)
5. [Arkitektur](#arkitektur)
6. [Skills, regler och minne](#skills-regler-och-minne)
7. [MCP, subagents och hooks](#mcp-subagents-och-hooks)
8. [Sponsorplats i chatten](#sponsorplats-i-chatten)
9. [Projektstruktur](#projektstruktur)
10. [Kommandon](#kommandon)
11. [Testning](#testning)
12. [Bygga appen](#bygga-appen)
13. [Begränsningar och TODO](#begränsningar-och-todo)

---

## Vad systemet kan

| Område           | Funktion                                                                                                                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Modell**       | Ollama över OpenAI-kompatibelt API (`/v1/chat/completions`), streaming, tool calling och detektering av modeller som saknar verktygsstöd.                                                                                                                                                  |
| **Agent-loop**   | Kontextbygge → modellsvar → verktygsanrop → körning → verktygssvar → reflektion → nytt varv eller slutligt svar.                                                                                                                                                                           |
| **Verktyg**      | `list_files`, `read_file`, `search_files`, `create_file`, `write_file`, `edit_file`, `delete_file`, `run_terminal_command`, `run_tests`, `git_status`, `git_diff`, `git_commit`, `git_branch`, `web_fetch`, `browser_open/read/screenshot/click/fill`, `ask_user` – plus alla MCP-verktyg. |
| **Kontext**      | Repo map, lokala embeddings, import- och symbolanalys, importgrannar, pin:ade filer och en hård kontextbudget. Bara det som behövs skickas till modellen.                                                                                                                                  |
| **Granskning**   | Varje filändring visas som en diff (både som förslag i godkännandet och som historik i högerpanelen).                                                                                                                                                                                      |
| **Utbyggnad**    | Skills (Markdown i `.vibeforge/skills/`), projektregler (`AGENTS.md`, `.vibeforge/rules.md`), projektminne (`.vibeforge/memory.md`), hooks och MCP (stdio, HTTP, SSE).                                                                                                                     |
| **Subagents**    | Explorer, Implementer, Tester, Reviewer och Documenter med isolerad kontext och korta sammanfattningar tillbaka.                                                                                                                                                                           |
| **Git**          | Status, branch, diff, commit med AI-genererat meddelande och ett code review-läge.                                                                                                                                                                                                         |
| **Distribution** | Windows `.exe` (NSIS), macOS `.dmg`, Linux `.AppImage`/`.deb`, Doctor-läge, onboarding och en publik webbplats.                                                                                                                                                                            |

## Kom igång

**Krav:** Node 22.5+, [Ollama](https://ollama.com) och en modell med tool calling. För att bygga skrivbordsappen krävs
även Rust och Tauri-beroendena.

```bash
# 1. Hämta en modell som klarar verktygsanrop
ollama pull qwen2.5-coder:7b

# 2. Klona och installera
git clone https://github.com/vibeforge/vibeforge.git
cd vibeforge
npm install

# 3. Kör agenten och skrivbordsgränssnittet
npm run dev
```

`npm run dev` startar agenten på `127.0.0.1:4319` (token krävs i `x-vibeforge-token`) och gränssnittet på
`http://127.0.0.1:1420`. Första gången får du ett onboardingflöde: samtycke för lokal databehandling, Ollama-anslutning,
projektmapp och ett **valfritt** val om sponsorplatsen i chatten.

Kontrollera miljön när som helst:

```bash
npm run doctor
```

```
✓ Node.js: v24.19.0
✓ Lokal datamapp: C:\Users\du\.vibeforge är skrivbar
✓ Projektmapp: … (14 poster)
✓ Ledigt diskutrymme: 483845 MB ledigt
✓ Git: git version 2.54.0.windows.1
✓ Testkommando: vitest run
✓ Ollama: http://localhost:11434 (v0.40.5), 2 modeller
```

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

- **Skills** ligger som Markdown med YAML-frontmatter i `.vibeforge/skills/`. Tio färdiga skills följer med
  (React-komponent, Next.js-sida, API-endpoint, Python-skript, buggfix, tester, kodgranskning, refaktorering,
  dokumentation, databasmigrering). Aktiveras via triggers eller `@skillnamn`.
- **Regler** läses automatiskt från `AGENTS.md`, `.vibeforge/rules.md` och `.vibeforge/preferences.json` och injiceras i
  systemprompten.
- **Minne** ligger i `.vibeforge/memory.md` – lokalt, läsbart och versionshanterat tillsammans med koden.

Redigera allt i appen (Skills-, Minne- och Inställningsdialogerna) eller direkt i filerna. Mer i [Skills](docs/skills.md).

## MCP, subagents och hooks

- **MCP**: lägg till servrar per projekt över stdio, HTTP eller SSE. Verktyg, resurser och prompts från servern dyker upp
  som vanliga agentverktyg. Exempelkonfiguration för filesystem, GitHub, Postgres, Playwright och webbsökning finns i
  MCP-dialogen. Mer i [MCP](docs/mcp.md).
- **Subagents**: `explorer`, `implementer`, `tester`, `reviewer`, `documenter`. De körs med isolerad kontext och lämnar
  korta sammanfattningar; statusen visas i vänsterpanelen.
- **Hooks**: kör kommandon vid `on_session_start`, `before/after_file_edit`, `before/after_terminal_command`,
  `before/after_test_run` och `before/after_commit` – t.ex. ESLint efter varje ändring eller tester före commit.

## Sponsorplats i chatten

Annonsplatsen är en egen komponent med ett medvetet minimalt API: den tar **bara emot ett tal** (antal användarprompter)
och har ingen åtkomst till prompter, filer, kontext eller svar.

- Visas som standard efter var 10:e prompt – och bara om du samtyckt vid installationen.
- Alltid märkt **Sponsrat** och visuellt avgränsad från AI-svaren, aldrig inuti ett svar.
- Kan stängas av i inställningarna (och via kommandopaletten).
- Leverantörer: `none`, `custom` (standard i appen) och `adsense` (avstängt i skrivbordsappen).
- Inga prompts, filer eller projektuppgifter skickas till något annonsnätverk, och klick loggas inte mot identitet.
- Webbplatsen har reserverade annonsplatser som bara aktiveras om `NEXT_PUBLIC_ADSENSE_CLIENT` sätts vid bygget.

## Projektstruktur

```
vibeforge/
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
└─ docs/                  Arkitektur, säkerhet, skills, MCP, release
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
```

- **Enhetstester** (Vitest) täcker verktygen, godkännandepolicyn, kontextmotorn, skills, regler, minne, MCP-klienten
  (mot en riktig process över stdio), subagents, hooks, SQLite-lagret, HTTP-ytan och React-komponenterna.
- **E2E** (Playwright) kör den vertikala skivan mot den riktiga agenten med en fejkad Ollama: prompt → läs fil →
  förslag → godkännande → diff → skriven fil → svar, både över HTTP och genom gränssnittet. Inget nätverk och ingen riktig
  modell behövs.

## Bygga appen

```bash
npm run icons        # appikoner
npm run tauri build  # bygger installeraren för din plattform
```

Automatisk uppdatering är förberedd men **avstängd** (`plugins.updater.active = false`) tills en release-server och
signeringsnycklar finns. Se [Release](docs/releasing.md).

## Begränsningar och TODO

- [ ] **Signering**: workflowen signerar, notariserar och verifierar filerna när certifikaten finns som hemligheter (`WINDOWS_CERTIFICATE`, `APPLE_*`, `ANDROID_KEYSTORE_BASE64`). Utan dem varnar operativsystemet vid installation. Se [Release](docs/releasing.md#signering).
- [ ] **Auto-uppdate**: sätt `plugins.updater.active = true`, lägg in `pubkey` och en riktig `endpoints`-URL.
- [ ] **Release-server**: GitHub Releases används som standard; egen server om du vill ha kanaler (beta/stable).
- [ ] **Telemetri**: medvetet avstängt (`telemetry: false`) och kan inte slås på från gränssnittet.
- [ ] **Pro-funktioner**: delade skills mellan projekt, team-minne och fjärrstyrda agenter bakom en betald licens.
- [ ] **Fler modeller**: en molntransport (OpenAI/Anthropic) bakom samma `ChatTransport`-gränssnitt – kräver uttryckligt
      samtycke per projekt.
- [ ] **Embeddings**: en riktig vektormodell i stället för den lokala hash-baserade vektorn.
- [ ] **Rust-skalet**: `apps/desktop/src-tauri` är skrivet men inte kompilerat i den här miljön (ingen Rust-toolchain).
      Kör `npm run tauri build` på en maskin med Rust för att verifiera.

Full lista i [TODO.md](TODO.md).

## Licens

MIT.
