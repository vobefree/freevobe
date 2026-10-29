# Arkitektur

Freevobe är tre lager ovanpå varandra, alla på din maskin.

```
┌──────────────────────────── apps/desktop (Tauri 2 + React) ────────────────────────────┐
│  Vänsterpanel      Mittenpanel                Högerpanel                               │
│  sessioner,        filträd, editor,           diff, terminal, loggar, tester,           │
│  projekt, läge,    sök, kontext               godkännanden, MCP                          │
│  uppgifter,        ───────────────────────    ─────────────────────────────────         │
│  subagents         chatt med Gives Back                                                  │
└────────────────────────────────────┬────────────────────────────────────────────────────┘
                                     │ HTTP + SSE på 127.0.0.1 (token i x-freevobe-token)
┌────────────────────────────────────┴─────── packages/agent-server ─────────────────────┐
│  server.ts     routing, token, origin-skydd, CORS, SSE                                  │
│  sessionHub.ts körningar, godkännanden, händelseström, persistens                        │
│  projectService.ts  projekt, index, skills, MCP, regler, minne, hooks                    │
└────────────────────────────────────┬────────────────────────────────────────────────────┘
                                     │ rena TypeScript-anrop
┌────────────────────────────────────┴─────── packages/agent-core ───────────────────────┐
│  agent/loop.ts      agent-loopen                                                         │
│  agent/runtime.ts   verktygskörning, godkännanden, systemprompt                          │
│  tools/*            filer, terminal, tester, git, web, webbläsare, ask_user              │
│  approval/          kö och hantering av godkännanden                                     │
│  security/policy.ts säkerhetsregler och farlighetsbedömning                              │
│  context/           repo map, embeddings, urval                                          │
│  skills/, rules/, memory/, hooks/, mcp/, subagents/, store/, doctor/                     │
│  verification/      typkontroll, lint och tester efter en körning                        │
│  checkpoints/       filsnapshot före varje agentändring                                  │
│  ollama/            transport mot Ollama (OpenAI-kompatibelt)                            │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

## Ett varv i agent-loopen

1. **Kontextbygge.** Repo map läses, embeddings jämförs med prompten, imports och symboler vägs in, pin:ade filer
   prioriteras och resultatet klipps mot `contextBudgetChars`. Händelsen `context` visar exakt vad som skickades.
2. **Modellanrop.** `ChatTransport` strömmar svar (text, tankegång och tool calls). Ollama-klienten är den enda
   implementationen i den här versionen, men gränssnittet är injicerat och används av testerna med en statisk transport.
3. **Verktygsanrop.** Argumenten valideras mot verktygets JSON-schema. Felaktiga argument blir ett begripligt
   verktygssvar i stället för ett krasch.
4. **Policy.** `evaluateToolCall` avgör: tillåtet, kräver godkännande eller blockerat. Blockeringar gäller i alla lägen.
5. **Körning.** Verktyget körs i projektroten. Filändringar producerar en `FileDiff` innan filen skrivs.
6. **Reflektion.** Verktygssvaret går tillbaka till modellen. Loopen fortsätter till ett slutligt svar, en avbrottsignal
   eller `maxIterations`.

Alla steg är händelser (`AgentEvent`) som strömmas till gränssnittet och sparas i SQLite.

## Var data bor

| Vad                                                                                                                   | Var                                      |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Sessioner, meddelanden, projekt, index, minne, uppgifter, godkännandelogg, planer, verifieringsrapporter, checkpoints, Gives Back-logg | `~/.freevobe/freevobe.db` (SQLite)     |
| Checkpoint-snapshot (filinnehåll före agentändringar)                                                                 | `~/.freevobe/checkpoints/<projekt-id>/` |
| Åtkomsttoken (0600)                                                                                                   | `~/.freevobe/token`                     |
| Skills, regler, minne, hooks, MCP-konfiguration                                                                       | `.freevobe/` i projektet                |
| Webbläsarskärmdumpar                                                                                                  | `.freevobe/workspace/screenshots/`      |

Databasen använder Node:s inbyggda `node:sqlite`, så inga native moduler behöver kompileras.

## Skal och säkerhet i transporten

- Servern lyssnar bara på `127.0.0.1`.
- Varje anrop utom `/api/health` och (i utvecklingsläge) `/api/dev-token` kräver token i `x-freevobe-token`. Det äldre namnet `x-freevobe-token` accepteras också, så att äldre klienter fortsätter fungera.
- Ändrande metoder från en origin som inte är loopback eller Tauri avvisas med 403.
- Alla svar får CORS-huvuden för loopback-origins, annars kan webbläsargränssnittet inte läsa dem.
- Skrivbordsappen startar agenten som en egen process, pollar `/api/health` och injicerar sedan
  `window.__FREEVOBE_BOOTSTRAP__ = { baseUrl, token }` i webbvyn.

## Gives Back utanför agenten

`GivesBackCard` ligger i `apps/desktop/src/components/gives-back/` och får bara ett tal som props. Den har ingen
`AppState`-koppling till chattinnehåll, inga verktyg och ingen väg in i systemprompten. Katalogen och typerna ligger i
`packages/protocol/src/gives-back.ts`, loggen i `gives_back_entries` (migrering 5) och HTTP-ytan i
`packages/agent-server/src/routes.ts` (`GET/POST /api/gives-back`, `DELETE /api/gives-back/:id`). Det finns ingen
betalningsväg någonstans i kedjan – se [gives-back.md](gives-back.md).

## Editorn laddas lokalt

Monaco byggs in i paketet (`monaco-editor` + egna workers för TypeScript, JSON, CSS och HTML) och `@monaco-editor/react`
pekar om sin loader till den instansen i `apps/desktop/src/lib/monaco.ts`. Utan den ompekningen hämtar
`@monaco-editor/react` Monaco från jsDelivr som standard – då slutar editorn fungera offline och temat `freevobe-dark`
appliceras inte. E2E-testet `e2e/offline-editor.ui.spec.ts` misslyckas om webbläsaren gör en enda förfrågan utanför
datorn medan en fil är öppen, så regressen kan inte smyga tillbaka.

## Att lägga till en ny modelltransport

Implementera `ChatTransport` i `packages/agent-core/src/ollama/types.ts`:

```ts
export interface ChatTransport {
  readonly label: string;
  chat(request: ChatRequest): AsyncIterable<ChatChunk>;
}
```

Loopen bryr sig inte om var svaret kommer ifrån. En molntransport ska kräva uttryckligt samtycke per projekt och får
aldrig aktiveras av misstag – se [safety.md](safety.md).
