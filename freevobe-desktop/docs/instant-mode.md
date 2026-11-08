# Prompt → klart

Freevobe kör som standard ett sammanhängande flöde: du skriver vad du vill ha, och appen gör
resten. Det finns inga mellansteg att klicka igenom.

```
du: "Gör en hemsida till en frisör"
  → projekt skapas i ~/Freevobe/<namn> (om inget är öppet)
  → modell väljs automatiskt (verktygsduglig kodmodell)
  → agenten läser, skriver filer, kör kommandon och tester
  → verifiering körs (typkontroll, lint, tester när projektet har dem)
  → förhandsvisningen startas och öppnas
  → chatten visar "Klart"
```

## Vad som händer automatiskt

| Steg | Vad appen gör |
| --- | --- |
| Projekt | Skapar `~/Freevobe/<kort namn>` när ingen mapp är öppen. Du kan fortfarande öppna en egen mapp först. |
| Modell | Behåller din valda modell om den har verktygsstöd, annars den minsta installerade kodmodellen med verktygsstöd. Saknas helt visas routerns förslag. |
| Behörighet | Kör med **Auto-kör**: filändringar, kommandon, tester och git sker utan frågor. Har du valt **Full auto** behålls det. |
| Verifiering | Körs efter en körning som ändrat filer (styrs av `verifyAfterRun`). |
| Preview | Startas och öppnas i mittenpanelen när körningen är klar. |
| Granskning | Agenten får läsa den egna previewn (`preview_check`) utan godkännande – den rör bara `127.0.0.1`/`localhost`. |

## Vad som fortfarande kräver ditt ja

"Prompt → klart" tar bort mellansteg, inte säkerhet. Dessa är hårda och frågar alltid:

- destruktiva kommandon (`rm -rf` mot rot/hemkatalog, `sudo`, `format`, diskverktyg),
- att skriva utanför projektet,
- att exponera en port mot nätet eller starta en tunnel,
- media som kostar pengar (bild, video, ljud) och analys av uppladdade filer,
- webbläsarautomation (`browser_click`, `browser_fill`),
- ändringar i externa tjänster via connectors (t.ex. deploy till produktion),
- MCP-verktyg från en server du inte godkänt.

## Stänga av

Inställningar → **Agent och säkerhet** → stäng av **Prompt → klart**. Då gäller behörighetsläget du
valt (till exempel **Fråga alltid**) och varje steg godkänns igen. Preview, verifiering och
projektskapande sker då bara när du själv trycker på knapparna.

Läget sparas som `instantMode` i inställningarna och är på som standard för nya och befintliga
installationer.
