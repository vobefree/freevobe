# Learn How to Vobe

Freevobe Learn är en egen app för barn – inte en sida på freevobe.dev: beskriv en värld med egna
ord, få en världsbeskrivning som redan är kontrollerad, spela kartan och läs till sist koden som
byggde den.

Appen byggs till **en enda HTML-fil** som laddas ner från releasen tillsammans med installerarna.
Filen öppnas från disk och spelar utan nät. Det finns ingen server, inget konto och ingen modell i
kedjan – texten tolkas av en ordlista som ligger i filen, och kartan ritas på en `canvas`.
Ingenting lämnar webbläsaren.

## Flödet

| Steg | Vad som händer                                                              | Kod                       |
| ---- | --------------------------------------------------------------------------- | ------------------------- |
| 1    | Barnet skriver en mening, t.ex. "en mörk skog med en katt och tre stjärnor". | `describeWorld`           |
| 2    | Meningen blir en `WorldSpec` med plats, hjälte, skatt, hinder, mål och frö.  | `src/lib/learn/describe.ts` |
| 3    | Kontrollen går igenom beskrivningen och kartan.                             | `validateSpec`, `validateWorld` |
| 4    | Kartan byggs av fröet och får en gång, skrymslen och hinder.                | `generateWorld`           |
| 5    | Barnet styr hjälten, samlar skatter och öppnar målet.                        | `move`, `src/lib/learn/game.ts` |
| 6    | Lektionerna visar riktig kod med barnets egen värld som exempel.             | `LESSONS`, `lessons.ts`   |

Om en karta inte klarar kontrollen provas åtta nya frön innan appen ger upp. Då visas i stället
felet – med en mening om vad som är fel och vad barnet kan skriva annorlunda.

## Världsbeskrivningen

Beskrivningen är vanlig JSON och visas för barnet under "Hela beskrivningen som data":

```json
{
  "name": "Skogen med katten",
  "seed": 2769852306,
  "biome": "forest",
  "hero": "katt",
  "treasure": "stjarna",
  "obstacle": "lava",
  "goal": "hemmet",
  "target": 3,
  "cols": 15,
  "rows": 11,
  "mood": "wild"
}
```

- `seed` räknas fram ur texten (FNV-1a), så samma mening ger alltid samma karta.
- `cols`/`rows` kommer från ord som "liten" (11 × 9) och "jättestor" (19 × 13), annars 15 × 11.
- `target` läses från siffror eller räkneord närmast skatten och hålls inom 1–8.
- `mood` blir `wild` av ord som "farlig" och `calm` av "lugn"; vilda världar får fler hinder.
- Ordlistan finns i [`src/lib/learn/lexicon.ts`](../src/lib/learn/lexicon.ts) och innehåller tio
  platser, tolv hjältar, sju skatter, nio hinder och sju mål – på svenska och engelska.

Varje val redovisas i gränssnittet ("`skog` → skogen"). Ord som inte betydde något tas inte bort
tyst: de listas som "ord jag inte använde".

## Reglerna som måste hålla

`validateSpec` (beskrivningen):

| Regel                        | Varför                                              |
| ---------------------------- | --------------------------------------------------- |
| Namnet finns och är ≤ 40 tecken | Tomt namn ger en tom rubrik                      |
| Hjälte, skatt, hinder, mål finns | Varje sak ska gå att rita och prata om          |
| `target` är ett heltal 1–8   | Fler skatter än så går inte att spela på små kartor |
| Kartan är 9–25 × 7–19 rutor  | Utanför det blir rutorna oläsbara                   |
| Platsen finns i ordlistan    | Färger och namn måste vara kända                    |

`validateWorld` (kartan):

| Regel                                  | Felkod                 |
| -------------------------------------- | ---------------------- |
| Kartan är lika stor som beskrivningen  | `size-mismatch`        |
| Hjälten står på golv, inte i en vägg   | `start-blocked`        |
| Målet ligger på golv                   | `goal-blocked`         |
| Målet går att nå från starten          | `goal-unreachable`     |
| Alla skatter finns, är unika och går att nå | `treasure-*`      |
| Gången hänger ihop och går på golv     | `route-broken`         |
| Inget hinder står på gången eller en skatt | `hazard-on-route`, `hazard-on-treasure` |

Bara `error` stoppar spelet. `warning` visas men spelar vidare. Meddelandena är skrivna till barnet,
inte till en utvecklare: "Det finns ingen väg från hjälten fram till målet."

## Varför kartan alltid går att spela

Generatorn bygger inte en slumpad karta och hoppas på det bästa:

1. En gång ritas från start till mål, ett steg i taget, alltid inåt.
2. Skatter hamnar i återvändsgränder. Vägen dit läggs i en skyddad mängd.
3. Några genvägar knyter ihop gången så att kartan får val i stället för en enda korridor.
4. Hinder läggs bara på golv som inte finns i den skyddade mängden.

Sedan kontrollerar `reachableTiles` (bredden-först) att målet och varje skatt nås från starten.
Kontrollen är oberoende av generatorn, så ett fel i generatorn kan inte slinka igenom.

Testerna i [`compile.test.ts`](../src/lib/learn/compile.test.ts) och
[`generate.test.ts`](../src/lib/learn/generate.test.ts) kör femton meningar, alla tio platser och en
liten karta med åtta skatter genom hela kedjan.

## Lektionerna

Sex lektioner, alla med kod som kopierats ordagrant ur appens egna filer:

| Lektion                     | Fil                          | Symbol           |
| --------------------------- | ---------------------------- | ---------------- |
| Ord blir en värld           | `src/lib/learn/describe.ts`  | `describeWorld`  |
| Kartan måste gå att spela   | `src/lib/learn/validate.ts`  | `validateWorld`  |
| Så hittas vägen             | `src/lib/learn/validate.ts`  | `reachableTiles` |
| En ruta i taget             | `src/lib/learn/game.ts`      | `move`           |
| Så ritas världen            | `src/lib/learn/render.ts`    | `drawWorld`      |
| Rekordet stannar här        | `src/lib/learn/progress.ts`  | `writeProgress`  |

[`lessons.test.ts`](../src/lib/learn/lessons.test.ts) läser källfilerna och kräver att varje citat
fortfarande finns där (whitespace-normaliserat) och att symbolen finns i filen. Ändrar någon koden
utan att uppdatera lektionen går testet sönder – lektionen kan inte beskriva kod som inte finns.

Varje lektion har en fråga med tre svar. Rätt svar markerar lektionen som klar och sparas lokalt.

## Rekord och integritet

- Rekord och avklarade lektioner sparas i `localStorage` under `freevobe.learn.progress.v1`.
- Bara den bästa rundan behålls per värld: minst antal steg, och vid lika många steg den med färst snubblingar. Nyckeln är plats + frö + antal + storlek + känsla.
- Trasig eller gammal data tas bort i stället för att krascha sidan, och om webbläsaren nekar
  skrivning fortsätter spelet utan att spara.
- Ingen analys, inga cookies, inga konton, ingen top­plista och ingen server som får veta något.

## Tillgänglighet

- Kartan har en beskrivande `aria-label`, och status (skatt tagen, målet låst, hinder) läses upp i
  en `aria-live`-yta.
- Spelet går att styra med piltangenter, WASD och fyra knappar på 48 × 48 px.
- `prefers-reduced-motion` stänger av gungningen och ritar stilla bilder.
- Kartan finns också som text (`Kartan som text`), så rutnätet går att läsa utan färger.

## Vad som inte finns

- **Ingen AI-modell.** Världen tolkas av en ordlista med regler. Det står också på sidan, i stället
  för att låtsas att en modell var inblandad.
- **Ingen berättarröst och inget ljud.**
- **Ingen delning eller topplista.** Rekordet är bara ditt.
- **Inga fler platser än de tio i ordlistan.** Ett okänt ord blir en skog, och det sägs rakt ut.

## Filer

```
src/lib/learn/
  types.ts        WorldSpec, GeneratedWorld, PlayableWorld, GameState
  lexicon.ts      platser, hjältar, skatter, hinder, mål och färger
  describe.ts     text → beskrivning, med spår av varje val
  generate.ts     beskrivning → karta (mulberry32, gång, skrymslen, hinder)
  validate.ts     describeSpec/validateWorld + reachableTiles
  compile.ts      hela kedjan med åtta försök
  game.ts         move(), startGame(), summary()
  render.ts       canvas-ritning (biomfärger, hjälte, skatter, hinder, mål)
  world-text.ts   kartan som text
  progress.ts     localStorage: rekord och lektioner
  lessons.ts      sex lektioner med riktig kod
src/components/learn/
  learn-app.tsx           formulär, beskrivning, spel och lektioner
  world-description.tsx   godkänd beskrivning, JSON och textkarta
  world-canvas.tsx        keyboard, knappar, HUD och vinst
  lessons-section.tsx     lektioner med quiz
src/main.tsx              monterar appen och följer systemets ljusa/mörka läge
index.html                skalet som blir den nedladdade filen
```

## Verifiera

```bash
cd freevobe-learn
npm test                     # spelmotorn, världskedjan och lektionernas citat
npm run typecheck
npm run package              # -> release/freevobe-learn.html
```

Öppna `release/freevobe-learn.html` direkt i en webbläsare (även från disk). Skriv en mening, bygg,
spela och kontrollera att rekordet ligger under `localStorage` → `freevobe.learn.progress.v1`.
Under utveckling: `npm run dev` → <http://localhost:4310>.
