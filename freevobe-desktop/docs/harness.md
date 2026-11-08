# Agent harness

Freevobe är byggt som en harness: en kedja med fyra faser som gör en beställning till en
leverans. Alla delar – verktyg, skills, router, verifiering, preview och checkpoints – sitter i
samma kedja. Ingen av dem är en sidofunktion.

```
gather  →  act  →  verify  →  deliver
kontext     verktyg   kontroller   preview + checkpoint
```

Motorn bor i `packages/agent-core/src/harness/harness.ts` och äger ordningen. Verktygen,
verifieringen och dev-servern injiceras, så samma motor körs i appen och i testerna.

## Fas 1 – gather

`AgentLoop` bygger kontexten: repo map, indexerade filer, pin:ade filer, projektregler,
`AGENTS.md`, minne, skills som matchar uppgiften och en budget i tecken. Kontexten skickas som
en `context`-händelse till gränssnittet, så du ser exakt vad modellen fick.

Skills läggs in som **data** i en `<skill-data>`-ram med en regel om att de aldrig får ändra
grundprinciper, behörighetsläge eller användarens instruktioner. Varje aktivering loggas i
`.freevobe/audit/skills.jsonl` med källa och anledning.

## Fas 2 – act

Modellen väljer verktyg. Varje anrop går genom policyn och behörighetsläget innan det körs.
Verktygen är desamma som i Claude Code:s modell:

| Uppgift                      | Verktyg                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| Läsa, skriva, ändra, ta bort | `read_file`, `write_file`, `create_file`, `edit_file`, `delete_file`                   |
| Söka                         | `search_files`, `list_files`, grep-semantik                                            |
| Köra                         | `run_terminal_command`, `run_tests`                                                    |
| Git                          | `git_status`, `git_diff`, `git_branch`, `git_commit`                                   |
| Webben                       | `web_fetch`, webbläsarverktygen                                                        |
| Plan och frågor              | `propose_plan`, `ask_user`                                                             |
| Verifiering                  | `run_verification`                                                                     |
| Media                        | `generate_image`, `generate_video`, `generate_audio`, `analyze_image`, `analyze_video` |
| Uppgifter                    | `todo_write` – hela listan, status per punkt                                           |
| Subagenter                   | `run_subagent` i loopen, `POST /api/subagents/run` med fem roller                      |

## Fas 3 – verify

När filer ändrats kör harness `runVerification` med projektets egna kommandon: typkontroll,
lint och tester. Rapporten sparas i databasen och visas i panelen. Är något rött startas ingen
preview – felet ska synas först, inte döljas bakom en vacker sida.

## Fas 4 – deliver

Harness startar projektets dev-server och visar resultatet i previewpanelen:

- `package.json` med `scripts.dev` → `npm run dev`, med rätt förväntad port för Next (3000) och
  Vite (5173).
- Annars `index.html` → en inbyggd statisk server.
- Servern binder alltid till `127.0.0.1`, med explicita flaggor per ramverk. Vite 7 binder annars
  till `localhost` (IPv6 på många maskiner), vilket gjorde att previewn aldrig svarade på
  `127.0.0.1`. Ingen port exponeras mot nätverket.
- Porten väljs av operativsystemet för statiska filer, så en upptagen port aldrig krockar.
- Servern stängs när projektet stängs.
- Vid start skrivs `.freevobe/launch.json` med kommando, port och adress.
- Tauris CSP har `frame-src` mot `http://127.0.0.1:*` och `http://localhost:*`. Utan den föll ramen
  tillbaka på `default-src 'self'` och previewn blev tom i skrivbordsappen.
- `preview_check` låter agenten öppna previewn, läsa sidan, ta en skärmbild och få konsolfelen –
  bara mot loopback och bara efter ett personligt godkännande.

## Modellrouter

`packages/agent-core/src/models/router.ts` väljer modell per uppgift:

1. Lokal modell först – helst den minsta som har verktygsstöd, och den största som får plats för
   en komplex uppgift.
2. Därefter en påslagen molnprovider, men bara om projektet tillåter molntjänster.
3. Annars en rekommendation om att hämta en modell. En rekommendation hämtar aldrig något själv.

Hårdvaruprofilen (`hardware.ts`) läser RAM och jämför med modellens faktiska storlek, med marginal
för kontext och KV-cache. VRAM kan inte läsas portabelt och lämnas som okänt – då utesluts
ingenting, och hämtningen kräver ändå ett uttryckligt ja.

`GET /api/router?prompt=…` returnerar beslutet: vald modell, orsak och eventuell rekommendation.

## Modellhämtning

`POST /api/models/pull` kräver `approved: true`, strömmar framstegen som SSE och kontrollerar
checksumman efteråt:

| Utfall       | Betydelse                                      |
| ------------ | ---------------------------------------------- |
| `verified`   | Förväntad och faktisk digest finns och är lika |
| `mismatch`   | De skiljer sig – modellen ska inte användas    |
| `unverified` | Ingen förväntad checksumma fanns               |
| `unknown`    | Modellen kunde inte läsas av efter hämtningen  |

Officiella modeller i Ollamas bibliotek märks som officiella, allt under en egen namespace som
tredjepart. En hämtning utan godkännande avvisas innan något nätverk rörs.

## Control Room

Panelen **Control Room** (höger sida) visar en enda tidslinje för körningen: start, fasbyten,
modellval, verktygsanrop och deras resultat, godkännanden, diffar, verifiering, preview,
checkpoints, hämtningar och fel. Varje rad byggs från en händelse som redan gick genom agenten –
vyn lägger inget till och döljer inget. Tidslinjen hålls på 400 rader och kan rensas.

Saknar den valda modellen verktygsstöd frågar chatten routern direkt och visar ett
rekommendationskort: namn, storlek, källa (officiell eller tredjepart), checksumma och om modellen
får plats i minnet. Ingenting hämtas förrän du trycker på **Ladda ner & använd**; sedan strömmar
framstegen in och slutresultatet visar om checksumman stämde. Stämmer den inte väljs modellen inte.

## Kontroll och ångra

- Varje ändring ger en diff, ett checkpoint och en rad i loggen.
- Checkpoints kan återställas med konfliktskydd eller committas till Git.
- Skill-anrop, godkännanden och verifieringar sparas lokalt.
- Allt går att radera: `.freevobe/` i projektet och Freevobe-home i hemkatalogen.

## Så granskar du själv

```bash
# faserna och deras ordning
sed -n '1,160p' packages/agent-core/src/harness/harness.ts

# routerns regler
sed -n '1,220p' packages/agent-core/src/models/router.ts

# testerna som låser beteendet
npx vitest run packages/agent-core/src/harness packages/agent-core/src/models packages/agent-core/src/preview

# hela kedjan mot riktig Ollama och ett riktigt projekt
cat docs/harness-checklist.md
```
