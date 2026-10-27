# VibeForge MVP – Implementation Plan

> **For agentic workers:** Execute task-by-task, inline. Steps use checkbox (`- [ ]`) syntax.
> Nothing is "done" until `npm run verify` (typecheck + lint + vitest) is green and the task's
> own tests were seen failing first.

**Goal:** En lokal-first vibecoding-desktopapp som ansluter Ollama, kör en säker agent-loop med
tool calling, visar diff före applicering, och kan paketeras för Windows/macOS/Linux – plus en
publik Next.js-webbplats.

**Architecture:** npm workspaces-monorepo. `packages/agent-core` är ren Node/TS utan
runtime-beroenden (testbart utan Rust och utan Ollama, tack vare en injicerbar
`ChatTransport`). `packages/agent-server` exponerar core över HTTP+SSE på `127.0.0.1`.
`apps/desktop` är Tauri 2 + Vite/React som pratar med servern. `apps/web` är marknadssajten.

**Tech Stack:** Tauri 2, React 18, TypeScript strict, Tailwind, Zustand, Monaco, xterm.js,
Node 22+, `node:sqlite`, Vitest, Playwright, ESLint, Prettier, Next.js.

**Spec:** `docs/design/2026-10-27-vibeforge-design.md`

## Global Constraints

- Node `>=22.5.0` (krav för `node:sqlite`). Ingen native modul får kompileras.
- `packages/agent-core` har **noll** runtime-beroenden.
- TypeScript strict + `noUncheckedIndexedAccess`.
- All UI-text svensk, all kod engelsk.
- Ingen telemetri. Inget nätverk utanför: Ollama, av användaren tillagda MCP-servrar,
  godkänd `web_fetch`/browser, samt aktiverad molntjänst.
- Standardbehörighet är `ask`. Alla fil- och terminalverktyg går via godkännande.
- Servern binder till `127.0.0.1` med token-krav; token ligger utanför git.

## Review Focus

Följande är inte täckt av tasks om inte test läggs till där: (1) sökväg som tar sig ur
projektroten via `..` eller absolut sökväg; (2) prompt injection innehållande "godkänn allt" –
får inte kringgå policy; (3) tom/obefintlig fil som redigeras; (4) terminalkommando som hänger
sig – måste time-outa; (5) annonskomponenten får inte läsa kontext (testas med tom provider).

---

### Task 1: Monorepo-grund

**Files:** `package.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`,
`vitest.config.ts`, `playwright.config.ts`, `.gitignore`, `packages/*/package.json`.

- [ ] Workspaces definierade, `npm install` grönt, `node:sqlite` verifierat manuellt.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` körbara (även med 0 tester).

### Task 2: `@vibeforge/protocol`

**Files:** `packages/protocol/src/{index,tools,events,ipc}.ts`
**Produces:** `ToolName`, `ToolCall`, `ToolResult`, `AgentEvent` (11 varianter),
`PermissionMode`, `ChatMessage`, `ApprovalRequest`, `ApiEnvelope<T>`.

- [ ] Test: `AgentEvent`-typer kan smalnas av på `type` (typnivå-test via `expectTypeOf`).

### Task 3: Ollama-klient

**Files:** `packages/agent-core/src/ollama/{client,transport,openai}.ts`
**Interfaces:** `ChatTransport.chat(req: ChatRequest): AsyncIterable<ChatChunk>`,
`OllamaClient.listModels(): Promise<OllamaModel[]>` (`/api/tags` + `/api/show` för
`capabilities` och `context_length`), `probe(): Promise<ProbeResult>` mot `/api/version`.

- [ ] Test: modellista parsas med namn, storlek, parameterstorlek, kontextlängd, `supportsTools`.
- [ ] Test: SSE-ström med `delta.tool_calls` i fragment ackumuleras till komplett anrop.
- [ ] Test: Ollama nere → `OllamaUnavailableError` med `helpUrl`.

### Task 4: Verktygsregister + policy + diff

**Files:** `packages/agent-core/src/tools/{registry,fs,terminal,git,tests,web}.ts`,
`security/{policy,secrets,paths}.ts`, `diff/engine.ts`, `approval/manager.ts`
**Produces:** `ToolRegistry.execute(name, args, ctx): Promise<ToolResult>`,
`UnifiedDiff`/`applyPatch`, `PolicyDecision`.

- [ ] Test: `..`-utbrytning avvisas; absolut sökväg utanför rot avvisas.
- [ ] Test: `rm -rf /` blockeras även i `full-auto`.
- [ ] Test: unified diff genereras och kan appliceras tillbaka (round-trip).
- [ ] Test: terminalverktyg respekterar timeout och rapporterar `timedOut: true`.
- [ ] Test: hemlighet (OpenAI-nyckel) hittas av sekretesskannern.

### Task 5: Agent-loop (vertikal slice)

**Files:** `packages/agent-core/src/agent/{loop,prompt,contextBuilder}.ts`
**Interfaces:** `AgentLoop.run(input: RunInput): AsyncIterable<AgentEvent>`.

- [ ] Test (slice): fake transport föreslår `read_file` → `edit_file`; loop emitterar
      `tool_call` → `approval_request` → efter godkännande `diff` → `file_changed` → `final`.
- [ ] Test: loop stannar vid `maxIterations` och emitterar `error` med kod `loop_limit`.
- [ ] Test: avbrott (`AbortSignal`) emitterar `aborted` och ingen fil skrivs.

### Task 6: Kontextmotor

**Files:** `context/{repoMap,indexer,selector,embedding}.ts`

- [ ] Test: repo map respekterar ignorerregler och utesluter `node_modules`.
- [ ] Test: embedding är deterministisk och normaliserad till längd 1.
- [ ] Test: selektor håller sig inom teckenbudget och inkluderar pinnade filer först.

### Task 7: Skills, regler, minne

**Files:** `skills/{loader,store,builtin/*.md}`, `rules/loader.ts`, `memory/store.ts`

- [ ] Test: YAML-frontmatter parsas (name, description, tools, triggers).
- [ ] Test: trigger matchar prompt → skill aktiveras; `@namn` tvingar fram skill.
- [ ] Test: `rules.md` + `AGENTS.md` + `preferences.json` injiceras i systemprompten.

### Task 8: MCP-klient

**Files:** `mcp/{client,transports,config}.ts`

- [ ] Test: stdio-transport mot en fake-server (Node-script) ger `tools/list` och `tools/call`.
- [ ] Test: MCP-verktyg registreras som `mcp__<server>__<tool>` och kräver godkännande.
- [ ] Test: inaktiverad server ger inga verktyg.

### Task 9: Subagents + hooks

**Files:** `subagents/{definitions,runner}.ts`, `hooks/{hooks,builtin}.ts`

- [ ] Test: explorer-subagent får isolerad kontext (ingen huvudkontext) och returnerar sammanfattning.
- [ ] Test: `before_file_edit`-hook som returnerar blockering hindrar skrivning.
- [ ] Test: `before_commit`-hook hittar nyckel i staged diff och blockerar commit.

### Task 10: Sessionsstore (SQLite)

**Files:** `packages/agent-core/src/store/{db,repositories}.ts`, `bin/vibeforge-doctor.mjs`

- [ ] Test: session + meddelanden sparas/läses; inställning per projekt persisteras.
- [ ] Test: doctor rapporterar node/git/ollama/modell/disk/mcp utan att kasta.

### Task 11: Agent-server (HTTP + SSE)

**Files:** `packages/agent-server/src/{server,routes,events,auth}.ts`

- [ ] Test: utan token → 401. Med token → 200.
- [ ] Test: `POST /api/chat` strömmar SSE-händelser i ordning.
- [ ] Test: annan `Origin` avvisas (CSRF-skydd på localhost-servern).

### Task 12: Desktop-UI

**Files:** `apps/desktop/src/**` (layout, chat, editor, diff, terminal, paneler, kommandopalett,
genvägar, onboarding, doctor, inställningar, skills, MCP, annonsplats).

- [ ] Test: annons visas efter 10:e prompten, aldrig inuti ett agentsvar, och renderar inget
      när provider är `none`.
- [ ] Test: kommandopalett öppnas med Ctrl/Cmd+K, skicka-genväg är Ctrl/Cmd+Enter.
- [ ] Test: avbryt-knapp sätter agentstatus till `aborted`.

### Task 13: Tauri-skal

**Files:** `apps/desktop/src-tauri/{Cargo.toml,tauri.conf.json,build.rs,src/main.rs,
src/lib.rs,capabilities/default.json,icons/*}`, `scripts/generate-icons.mjs`.

- [ ] `tauri.conf.json` validerar mot Tauri 2-schemat (fält kontrollerade mot dokumentationen).
- [ ] Sidecar-konfiguration och updater-pluginen är konfigurerade men **autoupdate avstängt**.
- [ ] Ikoner genereras av scriptet (PNG/ICO/ICNS) – körbart utan Rust.

### Task 14: Publik webbplats (Next.js)

**Files:** `apps/web/src/app/**` (startsida, download, docs, skills, blogg, community,
changelog, privacy). AdSense-platshållare reserverade, aldrig i chatten.

- [ ] `npm run build --workspace @vibeforge/web` grönt.

### Task 15: Release, dokumentation, TODOs

**Files:** `.github/workflows/{ci,release}.yml`, `README.md` (sv+en), `docs/TODO.md`,
`docs/mcp-examples.json`.

- [ ] README täcker: kom igång, arkitektur, verktyg, säkerhet, varumärke, begränsningar.
- [ ] TODO täcker: signering, auto-update, telemetri, Pro.
