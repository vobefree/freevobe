# Freevobe – Design

**Datum:** 2026-10-27
**Status:** Godkänd av beställaren via detaljerad spec (se nedan)
**Målgrupp för detta dokument:** en duktig byggare som ska kunna planera och bygga vidare utan att gå tillbaka till beställaren.

## 1. Intent och varför

Freevobe är en **lokal-first vibecoding-desktopapp**: användaren ansluter Ollama, väljer modell och
bygger mjukvara genom naturligt språk. Koden lämnar aldrig datorn om användaren inte uttryckligen
aktiverar en molntjänst.

Problemet som löses: dagens AI-kodverktyg är antingen molnbundna (koden skickas till en leverantör),
eller så är de tunna chattar utan agent-loop, säkerhetsmodell eller kontextmotor. Freevobe ger
Claude-Code-liknande arbetsyta (planera → utforska → skriva → köra → granska diff → committa) med
lokal modell, lokal sessionshistorik, lokal projektminne och explicit samtycke per sidoeffekt.

**Eget varumärke:** Freevobe är inte en kopia av Claude Code, Cursor, Freebuff eller något annat
märke. Egen logotyp (Tändstål/hammare-„V" – se `apps/web/public/logo.svg` och
`apps/desktop/public/logo.svg`), egen copy, egen design, egna modulnamn och egna koncept
(_Forge, Anvil, Ember, Sparks, Blueprint_ – se ordlistan i `README.md`).

## 2. Mål, icke-mål, anti-mål

**Mål**

1. Första start: anslut Ollama, välj modell, kom igång på under en minut.
2. Funktionell vertikal slice dag 1: Ollama → chatt → läs fil → föreslå ändring → diff → godkänn → skriv fil.
3. Fullständig agent-loop med tool calling och verktyg enligt spec.
4. Säkerhetsmodell med fyra behörighetslägen, projektrots-jail och blocklista.
5. Kontextmotor som klarar stora repon utan att skicka hela repot.
6. Utbyggbarhet: skills, regler, minne, MCP, subagents, hooks.
7. Distribution: `.exe` (NSIS), `.dmg`, `.AppImage`, `.deb` + publik Next.js-webbplats.
8. Fungerande dev-miljö och tester utan att hela kedjan kräver molntjänster.

**Icke-mål**

- Ingen hostad multi-tenant-backend i denna version. Agenten körs lokalt.
- Ingen egen modellträning, ingen GPU-kö.
- Ingen telemetri.
- Ingen AdSense i chattgränssnittet (reserverat på den publika sajten).
- Inga Pro-funktioner implementerade (endast tydliga TODO:er, se `docs/TODO.md`).

**Anti-mål** (skulle göra projektet misslyckat även om det "fungerar")

- Att koden, prompts eller filinnehåll skickas någonstans utan uttryckligt samtycke.
- Att en annons kan påverka agentsvar, kontext eller beslut.
- Att en filändring appliceras utan att användaren sett en diff.
- Att "Full auto" tillåter `rm -rf /`, `sudo`, diskradering eller skrivning utanför projektroten.
- Att UI:t fryser under en lång agentkörning.

## 3. Beslut (tagna av beställaren, ur specen)

| Beslut        | Värde                                                                          |
| ------------- | ------------------------------------------------------------------------------ |
| Stack         | Tauri 2 + React + TypeScript + Tailwind CSS                                    |
| Agent-backend | Node.js/TypeScript, lokal, OpenAI-kompatibelt Ollama-API                       |
| Modell-API    | `http://localhost:11434/v1/chat/completions`, streaming + tool calling         |
| Persistens    | SQLite (sessioner, minne, inställningar, projektindex)                         |
| Editor        | Monaco                                                                         |
| Terminal      | xterm.js                                                                       |
| State         | Zustand                                                                        |
| Tester        | Vitest (enhet) + Playwright (E2E/browser)                                      |
| Kvalitet      | ESLint, Prettier, TypeScript strict                                            |
| Standardtema  | Mörkt                                                                          |
| Annonsplats   | Standard `none`, får vara `custom`; AdSense avstängt och endast på webbplatsen |
| MCP-exempel   | filesystem, GitHub, Postgres, Playwright, web search                           |

## 4. Arkitektur

```
apps/desktop (Vite + React + Monaco + xterm)
   │  HTTP + SSE mot 127.0.0.1
   ▼
apps/desktop/src-tauri  ──spawnar──▶  packages/agent-server (Node, binär sidecar)
                                          │
                                          ▼
                                   packages/agent-core
   ollama · agent loop · tools · context · skills · rules ·
   memory · mcp · subagents · hooks · policy · diff · store
                                          │
                                          ▼
                              packages/protocol (delade typer)
```

**Varför en lokal HTTP-server och inte rena Tauri-kommandon?** Det ger (a) en testbar
agent-backend som körs i Node utan Rust, (b) att webbläsarautomation och MCP-servrar kan vara
långlivade processer utanför UI-tråden, (c) att UI:t kan utvecklas mot en riktig server i Vite
med hot reload, och (d) att samma backend kan paketeras som Tauri-sidecar i produktion
(`src-tauri/binaries/vibeforge-agent-<target-triple>`). Servern binder alltid till `127.0.0.1`
och kräver en token som skrivs till en fil i användarens Freevobe-home (aldrig i git).

**Dataflöde för en tur**

```
user prompt
  → agent-server skickar prompt till agent-core
  → context engine bygger repo map + pinnade filer + regler + minne + skills
  → Ollama /v1/chat/completions (stream)
  → tool_calls → policy/approval → verktygskörning → tool-resultat
  → reflektion/ny runda (max N) → finalt svar OCH/ELLER diff-förslag
  → godkännande → applicera på disk → hook (lint/test/formatter)
```

Allt ovan emitteras som `AgentEvent` (protocol-paketet) över SSE så UI:t kan rita live.

## 5. Säkerhetsmodell

- **Behörighetsläge** (`ask`, `auto-edit`, `auto-run`, `full-auto`) lagras per projekt.
- `write_file`, `edit_file`, `create_file`, `delete_file`, `run_terminal_command` kräver
  som standard godkännande. Ändringen presenteras alltid som diff först.
- **Blocklista** (även i `full-auto`): `rm -rf` mot rot/home, `sudo`/`doas`/`pkexec`, `format`,
  `diskpart`, `mkfs`, `dd of=/dev/*`, `shutdown`/`reboot`, pakethantering globalt,
  skrivning utanför projektroten, `--expose`/portvidarebefordran, utskick av hemligheter
  till externa tjänster (detekteras av sekretesskanner).
- **Sekretesskanner** (`security/secrets.ts`): känner igen OpenAI-/Anthropic-/GitHub-/AWS-/
  Google-nycklar, JWT, PEM-block och `.env`-mönster. Används både för att blockera commits och
  för att avbryta innan innehåll skickas till en molntjänst.
- **Ingen telemetri.** Inga nätverksanrop förutom: Ollama (`127.0.0.1`), uttryckligen tillagda
  MCP-servrar, `web_fetch`/browser (kräver godkännande) och en aktiverad molntjänst.

## 6. Kontextmotor

1. **Repo map** – filsökning med ignorerregler (`.gitignore`, standardundantag), språkdetektion,
   storlek, radantal.
2. **Symbolindex** – regexbaserad symbolutvinning (export/import/class/function/route) per fil,
   ingen tung parser. Bygger importgraf.
3. **Vektorindex** – lokala embeddings hashas deterministiskt (bag-of-words-SimHash i 256 dim,
   normaliserad) och lagras i SQLite. Modell för embeddings är valfri; default är den inbyggda
   `local-hash-embedding` som inte kräver någon tjänst. Det gör sökning användbar utan nätverk.
4. **Selektion** – pinnade filer + filer från senaste diff/terminalfel + BM25-liknande nyckelord +
   vektorsimilaritet + import-grannar av valda filer, budget i tecken (standard 24 000).
5. **Synlighet** – UI:t visar exakt vilka filer som ligger i kontexten och varför.

## 7. Annonsplats (separat komponent)

- Egen komponent `<AdSlot />` i chatflödet, renderad **mellan** chattbubblor, aldrig inuti ett
  agentsvar, med egen ram, egen rubrik och tydlig märkning "Sponsrat".
- Visas var 10:e användarprompt, aldrig två gånger i rad efter ett misslyckat försök.
- Providern `none` (default) renderar ingenting. `custom` renderar en lokal/konfigurerad enhet
  via `providerUrl` + `providerHtml`. `adsense` är avstängd i desktopappen.
- Komponenten läser **bara** annonskonfigurationen. Den får ingen åtkomst till prompttext,
  filinnehåll, kontext eller agentstate. Ingen identitetskoppling, ingen klickspårning.
- Användaren godkänner vid onboarding och kan stänga av i inställningar; valet sparas lokalt.

## 8. Konstanter och gränsvärden (bindande)

| Konstant                      | Värde                                   |
| ----------------------------- | --------------------------------------- |
| Ollama base URL               | `http://localhost:11434`                |
| Default modell                | `deepseek-r1:8b`                        |
| Agent-server port             | `4319` (fallback 4320… om upptagen)     |
| Max agent-iterationer per tur | `12`                                    |
| Kontextbudget                 | `24000` tecken                          |
| Terminal-timeout              | `120000` ms, max utdata `131072` tecken |
| Godkännandetimeout            | ingen (väntar på användaren)            |
| Diff-kontextrader             | `3`                                     |
| Annonsintervall               | var 10:e användarprompt                 |
| Embedding-dimension           | `256`                                   |
| DB-fil                        | `<VIBEFORGE_HOME>/vibeforge.db`         |
| Skills-katalog                | `<projektrot>/.vibeforge/skills/*.md`   |

## 9. Varumärke och copy

- **Namn:** Freevobe
- **Tagline (sv):** _Smida mjukvara i din egen smedja._
- **Tagline (en):** _Forge software in your own workshop._
- **Röst:** kort, konkret, ingen hype, inga utropstecken i UI-text.
- **Logotyp:** `apps/web/public/logo.svg` (städ + gnista i en hexagon), ordmärke i
  `wordmark.svg`. Färger: `ember #ff7a3d`, `anvil #14161c`, `steel #2a2f3a`, `spark #ffd166`.

## 10. Vad som lämnas till byggaren

- Exakta filnamn, signaturer och tester: se `docs/plans/2026-10-27-vibeforge-mvp.md`.
- Signering, auto-update-server, telemetri och Pro: se `docs/TODO.md`.
- Språkval i enskilda filer följer projektet; kommentarer och UI-text är på svenska där
  användaren möter dem, kod på engelska.
