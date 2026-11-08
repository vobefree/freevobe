# Gränssnitt

Freevobe har ett rent, innehållsförst gränssnitt: chatten och koden är huvudpersonerna, och
verktygen syns när du behöver dem. Allt nedan är tillägg – agentloopen, verktygen, skills, MCP,
modellrouting, auto-run och live preview fungerar precis som förut.

## Tema: ljust, mörkt eller systemet

Temat sparas lokalt (`freevobe.theme`) och följer operativsystemet tills du väljer något annat.

- **Inställningar → Utseende → Tema** väljer Ljust, Mörkt eller Följ systemet.
- Knappen i toppraden cyklar ljust → mörkt → system.
- `ThemeProvider` sätter `data-theme` på `<html>` och lyssnar på `prefers-color-scheme`, så att
  systembyten slår igenom direkt.
- Färgerna är CSS-variabler. Det ljusa läget vänder även slate-skalan, så att befintliga
  komponenter följer temat utan att varje klass skrivs om.
- Kodeditorn följer temat: Monaco har ett mörkt (`freevobe-dark`) och ett ljust (`freevobe-light`)
  tema och byter direkt när temat växlar.

## Vylägen: Verbose, Normal, Summary

Samma idé som Claude Code: du väljer hur mycket av körningen chatten visar.

| Läge    | Vad som visas                                                       |
| ------- | ------------------------------------------------------------------- |
| Verbose | Allt: verktygsanrop, resultat och resonemang, utfällda som standard |
| Normal  | Verktygsanrop fälls ihop; resonemang finns bakom en knapp           |
| Summary | Bara dina och agentens meddelanden – inga verktygsrader             |

Välj i toppraden, i chatten eller i Inställningar → Utseende. Valet sparas i
`freevobe.viewMode`.

## Qoder-läge

Ett terminal-likt läge för power users:

- Slås på i **Inställningar → Utseende**, med `Ctrl/Cmd+Shift+Q`, eller med `:qoder` i paletten.
- Hela ytan blir monokrom och monospace, kanter blir skarpa och onödiga knappar försvinner.
- Kommandopaletten (`Ctrl/Cmd+K`) är fortfarande navet och stödjer kolonkommandon:

| Kommando  | Gör                    |
| --------- | ---------------------- |
| `:w`      | Sparar filen i editorn |
| `:q`      | Stänger paletten       |
| `:run`    | Startar live preview   |
| `:test`   | Kör testerna           |
| `:verify` | Kör verifieringen      |
| `:theme`  | Växlar ljust/mörkt     |
| `:qoder`  | Slår på/av Qoder-läget |
| `:side`   | Öppnar sidchatten      |

Allt går att göra utan mus: paletten hanterar sökning, körning och navigering.

## Sidchatt

`Ctrl/Cmd+;` eller knappen i chatten öppnar en sidchatt. Den är en egen session på servern, så
huvudtråden lämnas orörd. Godkännanden som sidchatten utlöser hamnar i huvudflödet, så att inget
körs utan ditt ja.

## Paneler och layout

- Dra i avdelaren mellan editorn och chatten för att ändra höjdfördelningen (20–80 %).
- Dra en panes rubrik till den andra panen för att byta plats på editor och chatt.
- Ordningen och höjdfördelningen sparas lokalt (`freevobe.paneFirst`, `freevobe.paneShare`) och
  finns kvar nästa gång appen startar.
- Alla paneler finns kvar: filer, editor, preview, terminal, diffar, verifiering, checkpoints,
  Control Room och Gives Back.

## Genvägar

| Genväg             | Gör              |
| ------------------ | ---------------- |
| `Ctrl/Cmd+K`       | Kommandopalett   |
| `Ctrl/Cmd+;`       | Sidchatt         |
| `Ctrl/Cmd+Shift+Q` | Qoder-läge       |
| `Ctrl/Cmd+Enter`   | Skicka prompt    |
| `Ctrl/Cmd+B`       | Vänster panel    |
| `Ctrl/Cmd+J`       | Höger panel      |
| `Ctrl/Cmd+S`       | Spara fil        |
| `Ctrl/Cmd+Shift+N` | Ny chatt         |
| `Ctrl/Cmd+Shift+T` | Kör tester       |
| `Ctrl/Cmd+Shift+K` | Avbryt körningen |
