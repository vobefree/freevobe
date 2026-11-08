---
name: media-flows
description: Hela kedjan från prompt till färdig bild, video eller ljud – godkännande, kostnad, filens plats och hur den används i koden.
tools:
  - generate_image
  - generate_video
  - generate_audio
  - analyze_image
  - analyze_video
  - read_file
  - search_files
  - create_file
  - edit_file
  - run_tests
  - run_terminal_command
triggers:
  - bild
  - image
  - hero image
  - video
  - ljud
  - audio
  - media
  - generera bild
---

# Medieflöden

## Innan du anropar ett medieverktyg

1. Kontrollera att uppgiften verkligen behöver ny media. En fil som redan finns i projektet eller i
   `.freevobe/media` går före en ny generering – läs `list_files`/`search_files` först.
2. Skriv en prompt som beskriver motiv, stil, ljus och bildutsnitt. Korta prompts ger sämre
   resultat, och en omskrivning är billigare än en ny generering.
3. Beräkna inte priset själv. Godkännandet visar provider, modell och uppskattad kostnad; säg i
   text vad du tänker göra innan du anropar verktyget så att valet går att ta.
4. Medieverktygen kräver alltid användarens ja, även i Full auto. Avvisas godkännandet: föreslå en
   befintlig fil, ett billigare alternativ eller en lägre upplösning i stället för att försöka igen.
5. Filerna hamnar i `.freevobe/media/` med en metadatafil bredvid. Hitta aldrig på en sökväg – läs
   den som verktyget returnerar, och använd den projektrelativt i koden.

## Flöde 1: bild till en sida

1. `generate_image` med `prompt`, `aspect_ratio` (t.ex. `16:9`) och `count: 1`.
2. Verktygssvaret listar sökvägen, provider, modell, storlek och uppskattad kostnad.
3. Öppna sidan som ska använda bilden och lägg in sökvägen relativt projektroten, t.ex.
   `<img src="/.freevobe/media/image-….png" alt="…" />` i ett Next.js-projekt, eller motsvarande
   statisk sökväg i ett Vite-projekt. Lägg till en meningsfull `alt`-text.
4. Kör `run_tests` eller `npm run build` och kontrollera att sökvägen löses upp. Ett 404 i
   utdata betyder att filen ligger utanför det som servern publicerar – flytta den till `public/`
   med `run_terminal_command` i stället för att generera om den.
5. Berätta var filen ligger och vad den kostade.

## Flöde 2: video-loop som bakgrund

1. `generate_video` med `prompt`, `mode: text_to_video` och `resolution: 720p`. Videon räknas som
   fem sekunder i kostnadsöversikten.
2. Använd filen som bakgrund med `autoPlay muted loop playsInline` – utan `muted` startar ingen
   webbläsare uppspelningen automatiskt. Lägg en statisk bild eller en färg bakom som fallback.
3. Kontrollera filens storlek. Är den större än några megabyte: föreslå en kortare prompt eller
   lägre upplösning i stället för att lägga in den i git.
4. Verifiera att sidan fortfarande bygger och att videon inte blockerar första renderingen.

## Flöde 3: ljud och analys av en skärmbild

1. `generate_audio` med en prompt som beskriver stämning, tempo och längd.
2. Lägg en `<audio controls>` eller en egen play-knapp i sidan. Ladda inte filen automatiskt.
3. `analyze_image` med `image_path` och en konkret fråga, t.ex. "Stämmer kontrasten mellan rubriken
   och bakgrunden?". Verktyget skickar filen till providern och kräver godkännande.
4. Använd svaret som underlag för en ändring – kopiera inte in analysen i koden.

## Regler

- Skapa aldrig media "för säkerhets skull". Varje fil kostar pengar och varje fil blir en tillgång
  som måste underhållas.
- Skriv aldrig in en API-nyckel, token eller ett lösenord i en prompt. Regeln blockerar anropet.
- Försök aldrig stänga av leverantörens säkerhetsfilter. Freevobe skickar aldrig en sådan
  instruktion vidare.
- Använd `analyze_image` när resultatet ska bedömas i stället för att gissa.
- Om providern saknas eller budgeten är slut: förklara vad som fattas och vad användaren kan göra,
  och fortsätt med resten av uppgiften i stället för att stanna.
