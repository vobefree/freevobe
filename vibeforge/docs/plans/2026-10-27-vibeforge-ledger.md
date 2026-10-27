# SDD ledger — plan: docs/plans/2026-10-27-vibeforge-mvp.md

Spec: docs/design/2026-10-27-vibeforge-design.md (läst).
Worktree: byggs i `vibeforge/` under workspace-roten (roten är ett annat, orelaterat projekt).

Pre-flight: interfaces mellan tasks — protocol (T2) producerar typer som T3–T12 konsumerar;
agent-core (T3–T10) producerar `AgentLoop.run` som server (T11) och UI (T12) konsumerar.
Inga namnkonflikter hittade vid skanning; kontrolleras igen vid varje task.

Miljö: Node v24.19.0, npm 11.17.0, git 2.54.0.windows.1, Ollama igång (deepseek-r1:8b m.fl.).
Saknas: Rust/cargo (Tauri kan alltså inte kompileras här — T13 levereras som konfiguration +
genererade ikoner, kompilering rapporteras som ej körbar i denna miljö).
Saknas initialt: Playwright-webbläsare (installeras i T12/T15).

Ruling: projektet byggs i `vibeforge/` i stället för i workspace-roten, eftersom roten innehåller
ett orelaterat Next.js-projekt. — Kostnad om fel: en flytt av katalogen.

Ruling: agent-backenden körs som egen Node-process (HTTP+SSE på 127.0.0.1) i stället för enbart
Tauri-kommandon, så att kärnan kan testas och utvecklas utan Rust. — Kostnad om fel: en extra
process att paketera som sidecar.

Ruling: SQLite via Node:s inbyggda `node:sqlite` i stället för better-sqlite3. — Inga native
moduler att kompilera, vilket krävs för att dev-miljön ska fungera utan byggverktyg.
Kostnad om fel: `node:sqlite` är märkt experimentellt och API:t kan ändras; allt går genom en
tunn adapter i `store/db.ts`.

Ruling: embeddings är en inbyggd deterministisk hash-embedding (256 dim) i stället för en
modell. — Fungerar utan nätverk och utan extra modell. Kostnad om fel: svagare semantisk
sökning än en riktig embedding-modell; kan bytas ut bakom `context/embedding.ts`.

Task 1–7: complete.

- T1 (scaffold): `npm install` grönt; vitest/eslint/prettier körbara.
- T2 (protocol): typer + JSON-schema-validering. tests: events.test-d.ts.
- T3 (ollama): client + OpenAI-SSE + fake-server. tests: ollama.test.ts → 8/8.
- T4 (tools/policy/diff): diff-motor med round-trip, paths-jail, sekretesskanner, policy.
  tests: engine.test.ts 9/9, security.test.ts 21/21.
- T7 (skills/rules/memory): 10 inbyggda skills validerade av test; skills.test.ts 11/11,
  rules.test.ts 8/8.
- T6 (kontext): embedding, indexer, repo map, selektor. context.test.ts 16/16.
- T5 (agent-loop): prompt, runtime (exec/proposeChange/hooks), loop.
  tests: loop.test.ts 9/9 — den vertikala slicen Ollama → chatt → läs fil → ändra → diff →
  godkänn → skriv fil är verifierad mot disk (filinnehållet kontrolleras efter körning), plus
  avvisad ändring, avbrott, iterationsgräns, blockerat `rm -rf /` i Full auto, Plan-läge,
  terminalströmning, terminalgodkännande och textuella verktygsanrop.

Ruling: Tauri-kompilering kan inte verifieras i denna miljö (ingen Rust). Konfigurationen
valideras mot Tauri 2-dokumentationens schema och mot `tauri-build`-fältnamn; allt som kan
köras utan Rust (ikoner, frontendbygge, tester) körs. — Kostnad om fel: första `cargo tauri
build` på en maskin med Rust kan kräva en rättelse av namnet på sidecar-binären.
