# Freevobe Learn

Learn How to Vobe är en egen app – inte en sida på freevobe.dev. Man beskriver en värld i ord, appen
tolkar orden, kontrollerar att världen går att spela och låter en gå runt i den. Lektionerna visar
koden som byggde kartan, med ens egen värld som exempel.

Allt sker i webbläsaren: ingen modell, ingen server, inget konto. Bygget är **en enda HTML-fil**, så
appen laddas ner som en fil, öppnas från disk och fungerar utan nät.

## Utveckla

```bash
npm install
npm run dev        # http://localhost:4310
npm test           # spelmotorns 98 tester
npm run typecheck
```

## Bygg nedladdningen

```bash
npm run package    # -> release/freevobe-learn.html  (allt inlinat, ~0,34 MB)
```

Öppna den filen direkt i en webbläsare (även `file://`) – det är samma fil som release-workflowen
lägger bredvid installerarna, och som nedladdningssidan länkar till.

## Innehåll

| Fil                              | Vad den gör                                                          |
| -------------------------------- | -------------------------------------------------------------------- |
| `src/lib/learn/describe.ts`      | Tolkar en mening till en världsbeskrivning (namn, hjälte, mål, storlek) |
| `src/lib/learn/compile.ts`       | Beskrivning → spelbar värld, eller en lista med det som är omöjligt   |
| `src/lib/learn/validate.ts`      | Kontrollerar att målet går att nå och att alla skatter ligger i vägen |
| `src/lib/learn/generate.ts`      | Bygger kartan (deterministiskt ur `seed`)                             |
| `src/lib/learn/game.ts`          | Rörelse, skatter och vinst – rena funktioner, inga sidoeffekter       |
| `src/lib/learn/render.ts`        | Ritar kartan på canvas                                                |
| `src/lib/learn/lessons.ts`       | Lektionerna och koden de visar                                        |
| `src/lib/learn/progress.ts`      | Sparar rekord i webbläsarens `localStorage`                           |
| `src/components/learn/`          | Skärmarna: formuläret, kartan och lektionerna                         |

## Gränser

Kartan är visuell. Textkartan och lektionerna går att läsa med skärmläsare, men själva gången kräver
att man ser kartan. Det finns ingen delning och ingen topplista – rekorden stannar i webbläsaren.
