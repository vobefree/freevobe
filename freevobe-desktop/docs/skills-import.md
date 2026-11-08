# Importera skills från andra agenter

Freevobe ska kunna ta över det arbete du redan lagt ner i en annan agent. Det här dokumentet
beskriver formatdetekteringen – det första steget i importen. Normalisering, importvy,
konflikthantering och modellrekommendation byggs ovanpå den och dokumenteras här vartefter.

## Format som känns igen

| Källa | Sökväg | Typ | Namnförslag |
| --- | --- | --- | --- |
| Claude | `.claude/skills/<namn>/SKILL.md`, `skills/<namn>/SKILL.md` | enskild skill | mappnamnet |
| Cursor | `.cursor/rules/<namn>.mdc` | enskild skill | filnamnet |
| AGENTS.md | `AGENTS.md`, `.github/AGENTS.md` | regeldokument | `agents` |
| Copilot | `.github/copilot-instructions.md` | regeldokument | `copilot-instructions` |
| Codex | `.codex/**/*.md` | enskild skill | mappnamnet |
| OpenCode | `.opencode/**/*.md` | enskild skill | mappnamnet |
| Windsurf | `.windsurf/rules/**/*.md` | enskild skill | mappnamnet |
| Cline | `.clinerules/**/*.md`, `.clinerules` | enskild skill | mappnamnet |

Flera format i samma repo importeras tillsammans. Markdown som inte matchar någon rad hamnar i
`unknownMarkdown` i stället för att tystas bort – importvyn kan då erbjuda
*Importera som generisk skill*, så att en fil aldrig försvinner utan att du ser den.

Ett `AGENTS.md` som ligger djupare än roten (till exempel `packages/app/AGENTS.md`) behandlas som
generisk markdown. Det är medvetet: de filerna beskriver oftast en delmapp, inte hela projektet,
och ska därför väljas aktivt.

## Normalisering

Varje träff blir en Freevobe-skill med samma frontmatter som agenten redan läser. Skillnaden mellan
källorna hanteras utifrån vad de faktiskt styr:

| Källa | `name` | `description` | `triggers` | `globs` | `alwaysApply` |
| --- | --- | --- | --- | --- | --- |
| Claude | `name`, annars mappnamnet | `description`, annars `when_to_use`, annars första stycket | `triggers`, annars `when_to_use` delat på komma/semikolon, annars namnet | om filen har det | om filen har det |
| Cursor | `name`, annars filnamnet | `description`, annars första stycket | `triggers` om filen har det | `globs` | `alwaysApply` |
| AGENTS.md | `project-rules` | `description`, annars första rubriken, annars första stycket | – | – | alltid `true` |
| Copilot | `copilot-instructions` | som AGENTS.md | – | – | alltid `true` |
| Generisk markdown | `name`, annars filnamnet | `description`, annars första stycket | `triggers`, annars namnet | om filen har det | om filen har det |

Varje normaliserad skill får också `source`, `source_path` och – när den kommer från GitHub –
`source_repo`. Det gör att en ny import kan se att skillen redan finns och erbjuda en uppdatering
i stället för en dubblett.

Normaliseraren gissar aldrig i tysthet: när beskrivningen tas från `when_to_use`, första rubriken
eller första stycket, och när en Cursor-regel varken har `globs` eller `alwaysApply`, följer en
varning med i resultatet så att förhandsgranskningen kan visa den.

```markdown
---
name: typescript
description: 'TypeScript-stil: strikta typer'
tools: []
triggers: []
globs:
  - src/**/*.ts
source: cursor
source_path: .cursor/rules/typescript.mdc
---

Använd interface i stället för type när det går.
```

## Så används det

`detectSkillFormats` tar en lista sökvägar och svarar med

- `files` – källa, typ (`skill` eller `document`) och namnförslag per fil, sorterat per källa,
- `bySource` – antal träffar per källa, för rubriken "12 skills från 3 källor",
- `unknownMarkdown` – markdown utan känt format,
- `ignored` – filer som hoppades över, till exempel i `node_modules`.

Funktionen är ren och rör inte filsystemet: samma logik kan användas på ett klonat repo, ett
uppladdat arkiv eller ett urval filer som redan lästs in. Sökvägar normaliseras, så
`./.cursor/rules/a.mdc`, `.cursor/rules/a.mdc` och Windows-varianten med `\` räknas som samma fil.

```ts
import { countDetected, detectSkillFormats } from '@freevobe/agent-core';

const detection = detectSkillFormats(paths.map((path) => ({ path })));
countDetected(detection); // { skills: 12, sources: 3 }
```

## Importvyn

Skills-dialogen har knappen **Importera från en annan AI**. Fältet tar emot en lokal mapp (relativ
till projektet eller absolut) eller en GitHub-adress – `owner/repo`, `https://github.com/owner/repo`
eller en `git@`-adress. Tomt fält skannar det öppna projektet.

Flödet är medvetet tvåstegat:

1. **Skanna** läser bara. Servern går igenom markdownfilerna, kör detektorn och normaliseraren och
   svarar med källa, namn, beskrivning, globs, `alwaysApply`, noteringar och eventuella konflikter.
   Inget skrivs till disk.
2. **Importera valda** skickar tillbaka de poster du kryssat för. Först då skapas filerna i
   `.freevobe/skills/`, och agenten läser om sina skills direkt.

En skill vars namn redan finns bland projektets, användarens eller de inbyggda skillsen visas som
**konflikt**, är avmarkerad och kan inte importeras i det här steget – diff och valet skriv över,
behåll båda eller hoppa över kommer i nästa steg.

Markdown som inte matchar något känt format listas som en notis längst ner i vyn i stället för att
försvinna. GitHub-adresser klonas grunt till en tillfällig mapp som städas bort direkt efter
skanningen; misslyckas hämtningen visas git:s eget felmeddelande.

### Servervägar

| Metod | Väg | Gör |
| --- | --- | --- |
| `POST` | `/api/projects/:projectId/skills/import/scan` | `{ target? }` → `SkillImportScan` |
| `POST` | `/api/projects/:projectId/skills/import/apply` | `{ items: SkillImportApplyItem[] }` → `SkillImportApplyResult` |

## Säkerhetsskanning

En importerad skill är instruktioner som hamnar i modellens kontext. Därför skannas varje post
innan den får väljas (`packages/agent-core/src/skills/security.ts`):

- **Försök att styra modellen** – "ignore previous instructions", "system prompt", "jailbreak"
  eller att något ska hållas hemligt för användaren. Allvarligast av allt och klassas som farligt.
- **Körbar kod** – `curl … | sh`, `rm -rf`, `sudo`, `eval` och base64-avkodning som körs.
- **Hemligheter och dolt innehåll** – referenser till `.env`, `id_rsa`, `.ssh`, hårdkodade
  nycklar, långa base64-block och osynliga tecken (nollbreddstecken) som gömmer text.
- **Externa adresser** – varje `http(s)`-adress som inte är lokal listas, så att du ser vart
  skillen pekar.

Resultatet blir **Säker**, **Varning** eller **Farlig** med en riskpoäng. En farlig skill går
inte att välja förrän du kryssar i att du förstår risken, och en skill som nämner skript kräver
ett eget godkännande av skriptlistan. Innan importen visas en rad med exakt vad som sparas:
antal filer, skript och externa adresser.

Skript kopieras **aldrig** – importen skriver bara en markdownfil i `.freevobe/skills/`. Att en
skill nämner ett skript betyder alltså inte att det finns i projektet efteråt.

Skannern är ett filter, inte ett bevis. "Säker" betyder att inget känt mönster hittades.

## Nästa steg

1. **Konflikthantering** – diff sida vid sida och valet skriv över, behåll båda eller hoppa över.
2. **Modellrekommendation** – om ingen lämplig modell finns föreslås en och kan hämtas med ett klick.
