# Medieflöden: från prompt till färdig fil

Den här sidan visar hela kedjan för de tre vanligaste uppgifterna. Samma flöde gäller oavsett om du
skriver prompten själv eller väljer ett av medieexemplen i en tom chatt.

Kedjan är alltid densamma:

1. **Klassaren** avgör om uppgiften kräver bild, video eller ljud och vilken provider som kan
   leverera det.
2. **Providern** måste vara påslagen, ha en sparad nyckel och molntjänster måste vara tillåtna. Är
   något av det inte uppfyllt visas en banner i chatten i stället för ett halvt svar.
3. **Godkännandet** visar prompten, providern, modellen och den uppskattade kostnaden. Inget skickas
   förrän du svarar.
4. **Filen** sparas i projektets `.freevobe/media/` med en metadatafil bredvid sig.
5. **Koden** använder den projektrelativa sökvägen, och verifieringen körs som vanligt.
6. **Media-fliken** visar filen, kostnaden och hur mycket av dagens budget som är kvar.

## Flöde 1: hero-bild till en startsida

**Prompt:** "Skapa en hero-bild i 16:9, spara den i projektet och använd den i startsidan."

1. Agenten letar efter en befintlig bild först. Hittar den ingen anropar den `generate_image` med
   `aspect_ratio: "16:9"`.
2. Godkännandekortet visar motivet, `google/gemini-3.1-flash-image` och en kostnad på ungefär
   `$0.02`. Godkänn eller avvisa.
3. Filen sparas som `.freevobe/media/image-….png`. Agenten läser sökvägen ur verktygssvaret – den
   hittar aldrig på ett filnamn.
4. Sökvägen läggs in där startsidan förväntar sig statiska filer, med en `alt`-text. I Next.js
   behöver filen ofta ligga under `public/`; agenten flyttar den då dit i stället för att generera
   en ny.
5. Verifieringen (typkontroll, lint, tester) körs. Media-fliken visar bilden och `$0.02`.

**Kontrollera själv:** öppna sidan, se att bilden laddar och att `alt`-texten beskriver motivet.

## Flöde 2: kort loop-video som bakgrund

**Prompt:** "Gör en kort loop-video och lägg den som bakgrund i hero-sektionen."

1. Agenten anropar `generate_video` med `resolution: "720p"`. Videon räknas som fem sekunder i
   kostnadsöversikten; godkännandet visar summan innan något skickas.
2. Filen sparas som `.freevobe/media/video-….mp4`.
3. Koden använder `<video autoPlay muted loop playsInline>` med en statisk fallbackbild bakom.
   `muted` krävs för att webbläsaren ska starta uppspelningen automatiskt.
4. Är filen stor föreslår agenten en kortare prompt eller lägre upplösning i stället för att lägga
   in den i git.

**Kontrollera själv:** sidan ska rendera även innan videon är klar, och videon ska loopa utan ljud.

## Flöde 3: ljudintro och analys av en skärmbild

**Prompt:** "Skapa ett ljudintro, lägg en spelare i sidan och verifiera att filen finns."

1. `generate_audio` skapar en ljudfil i `.freevobe/media/`. Godkännandet visar priset för ett
   ljudspår.
2. Agenten lägger in en `<audio controls>` eller en egen play-knapp. Inget autoplay.
3. Vill du bedöma resultatet kan agenten använda `analyze_image` på en skärmbild: filen skickas
   till providern för analys och kräver ett eget godkännande. Svaret används som underlag för en
   ändring – det klistras inte in i koden.

**Kontrollera själv:** filen finns i Media-fliken, spelaren fungerar och sidan bygger.

## När något stoppar flödet

| Läget | Vad du ser | Vad du gör |
| --- | --- | --- |
| Ingen provider påslagen | Banner: provider krävs | Slå på Gemini eller Grok och spara en nyckel i Inställningar → Providers |
| Molntjänster avstängda | Banner med knappen "Aktivera Gemini" | Slå på molntjänster, eller fortsätt med text och kod lokalt |
| Budgeten är slut | Verktygsfelet nämner dagens summa och gränsen | Höj den dagliga budgeten i Inställningar → Agent och säkerhet |
| Du avvisar godkännandet | "Du avvisade medieanropet" | Inget skapades och inget debiterades; be om ett billigare alternativ |
| Prompten blockeras | Säkerhetsregeln står i felet | Skriv om prompten; hemligheter och filterkringgåenden går inte att godkänna |

Kostnaden är alltid en uppskattning ur katalogens priser. Fakturan från leverantören är facit.
