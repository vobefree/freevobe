# Providers

Freevobe är lokal-first: text och kod körs via Ollama på din egen dator och kräver varken konto
eller nyckel. Utöver Ollama finns tre valfria molnleverantörer som du själv slår på och ger en egen
API-nyckel. Ingenting skickas till dem förrän du har gjort det.

## Leverantörer och capabilities

| Provider              | Auth     | Text | Vision | Verktyg | Bild | Video | Ljud |
| --------------------- | -------- | :--: | :----: | :-----: | :--: | :---: | :--: |
| **Ollama** (lokal)    | ingen    |  ✅  |   ❌   |   ✅    |  ❌  |  ❌   |  ❌  |
| **Claude** (Anthropic) | API-nyckel | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Gemini** (Google)   | API-nyckel | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Grok** (xAI)        | API-nyckel | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |

Tabellen är samma data som `PROVIDER_CAPABILITY_MATRIX` i `@freevobe/protocol`, och ett test
kontrollerar att katalogen och matrisen aldrig glider isär.

### Modeller

| Provider  | Modeller                                                                 |
| --------- | ------------------------------------------------------------------------ |
| Ollama    | Alla modeller du har dragit ner. Listan hämtas live från `/api/tags`.     |
| Anthropic | `claude-sonnet-4-5`, `claude-haiku-4-5` – text, vision och verktyg.       |
| Google    | `gemini-3-pro` (text, vision), `gemini-3.1-flash-image` och `gemini-3-pro-image` (bild), `gemini-omni-1.1-flash` (video, ljud). |
| xAI       | `grok-4` (text), `grok-imagine-image-2.0` (bild), `grok-imagine-video-1.5` (video). |

Priserna i katalogen (`cost`) är uppskattningar per bild, videosekund eller ljudspår. Leverantörerna
ändrar priser – siffran används för att visa en ungefärlig kostnad innan något genereras, inte som
fakturaunderlag.

## Slå på en provider

1. Öppna **Inställningar → Providers**.
2. Slå på providern och klistra in din API-nyckel. Länken i providerkortet går till sidan där du
   skapar nyckeln.
3. Statusen blir **Redo** när nyckeln har sparats.

Nyckeln sparas i samma krypterade valv som connectors använder
(`~/.freevobe/connectors.vault.json`, AES-256-GCM med en egen 32-byte-nyckel i
`connectors.key`, rättighet `0600`). Den skrivs aldrig i databasen, följer aldrig med i ett API-svar
och skickas aldrig till modellen. API:t returnerar bara en maskerad ledtråd, till exempel
`AIza…cdef`, så att du kan se vilken nyckel som ligger sparad.

## Lokal-only-läget

`allowCloudServices` i inställningarna är **av** som standard. Då fungerar text, kod och verktyg
precis som vanligt via Ollama, medan bild, video, ljud och vision svarar med koden `local_only` i
stället för att tyst misslyckas. UI:t förklarar att en molnprovider behövs och var du slår på den.

Att slå på en molnprovider är alltså två steg: `allowCloudServices` och providerns egen toggle. Ett
av dem räcker inte – det ska vara svårt att råka skicka sin kod till ett moln.

## Routing

`ProviderService.resolve(capability)` svarar på vilken provider som ska användas:

| Output          | Regel                                                          |
| --------------- | -------------------------------------------------------------- |
| Text/code       | Ollama om den är på, annars första lediga provider med `text`. |
| Bild            | Vald bildprovider (Google eller xAI), annars första lediga.     |
| Video           | Vald videoprovider (Google eller xAI), annars första lediga.    |
| Ljud            | Endast Google.                                                 |
| Vision (input)  | Claude eller Gemini.                                           |

Reglerna bor i `packages/agent-core/src/providers/registry.ts`.

### Så klassas en beställning

Innan något skickas till en modell klassar `classifyTask` i
`packages/agent-core/src/agent/classifier.ts` vad användaren ber om:

| output_type | Kännetecken                                                       |
| ----------- | ----------------------------------------------------------------- |
| `image`     | "skapa en bild", "generate a logo", "hero image" …                  |
| `video`     | "gör en video", "create a trailer" …                               |
| `audio`     | "komponera musik", "generate a jingle" …                           |
| `code`      | filnamn, funktioner, komponenter, buggar, kommandon                |
| `text`      | allt annat – vanliga frågor                                        |

Klassaren är lokal och kostar ingenting. Den kräver både ett medieord och ett genereringsverb, och
en kodsignal (till exempel `login.tsx`) vinner alltid över ett medieord: "lägg in hero-bilden i
komponenten" är kod, inte en ny bild.

Klarar ingen påslagen provider output-typen skickar loopen händelsen `provider_required` med
orsaken `local_only` eller `not_configured` och avslutar körningen. Chatten visar då en banner med
den exakta förklaringen och knappar som slår på Gemini eller Grok. Servern slår aldrig på något
själv, och ingenting skickas till en textmodell i stället.

Verktygen som anropar API:erna (`generate_image`, `generate_video`, `generate_audio`,
`analyze_image`, `analyze_video`) byggs i nästa steg ovanpå samma tjänst.

## API

| Metod    | Väg                          | Gör                                        |
| -------- | ---------------------------- | ------------------------------------------ |
| `GET`    | `/api/providers`             | Katalog, status, preferenser och valvets sökväg. |
| `PATCH`  | `/api/providers/:id`         | `{ "enabled": true }` slår på eller av.    |
| `POST`   | `/api/providers/:id/key`     | `{ "key": "…" }` sparar nyckeln krypterat. |
| `DELETE` | `/api/providers/:id/key`     | Tar bort nyckeln.                          |
| `PATCH`  | `/api/providers/preferences` | `{ "kind": "image", "providerId": "xai" }`. |

Nyckeln skickas bara in, aldrig ut. Ett svar från `GET /api/providers` innehåller `keyHint`, inte
nyckeln.

## Säkerhet

- Nycklarna lämnar aldrig datorn utom som `Authorization`-huvud till leverantörens eget API.
- Ingen provider aktiveras automatiskt, och en nyckel i sig slår inte på något.
- `allowCloudServices` styr all molntrafik; är den av går ingenting ut.
- Loggar och felmeddelanden maskerar nycklar via `security/secrets.ts`.
- Leverantörernas egna policyer gäller för genererat innehåll. Freevobe kringgår inga filter.

## Media i gränssnittet

Bilder, videor och ljud som verktygen skapar sparas i projektets `.freevobe/media/`. Servern läser
bara den mappen: `GET /api/projects/:id/media` listar filerna med metadata och
`GET /api/projects/:id/media/file?path=…` skickar själva filen. Båda kräver åtkomsttoken, och en
sökväg utanför mappen avvisas innan något läses.

Resultatet syns på två ställen i appen:

- **I chatten** som kort direkt i flödet efter körningen, med förhandsvisning, provider, modell och
  uppskattad kostnad.
- **I Media-fliken** i högerpanelen, som listar hela mappen nyast först. Fliken läser om sig själv
  när en körning har skapat ny media.

Filerna hämtas med token som blob-URL:er i stället för att serveras öppet, så inget lämnar datorn
och ingen fil kan läsas utan giltig token. Saknas metadatafilen (`<fil>.json`) visas filen ändå med
storlek och tid.

## Kostnad och säkerhet för media

### Priset syns innan något skickas

Varje medieverktyg ber om ett godkännande som visar prompten, providern, modellen och den
uppskattade kostnaden. Siffran räknas fram ur katalogens pris per bild, videosekund eller ljudspår:
en bild kostar priset för en bild, en video räknas som fem sekunder och ett ljudspår som en enhet.
Analys av en befintlig bild eller video visar inget pris – där debiteras bara textmodellen.

Kostnaden är en uppskattning. Leverantörerna ändrar priser, och en bild med högre upplösning kan
kosta mer än katalogens siffra. Samma uppskattning sparas i metadatafilen bredvid filen och visas
efteråt i chatten och i Media-fliken.

### Daglig budget

I Inställningar → Agent och säkerhet finns **Daglig mediabudget (USD)**. Är den 0 gäller ingen
gräns. Är den satt stoppas ett anrop innan det skickas, om dagens summa plus anropets uppskattade
pris skulle passera gränsen. Dagens summa räknas ur metadatafilerna i projektets `.freevobe/media`
– alltså det som faktiskt sparats, inte ur en separat räknare som kan hamna i otakt.

Media-fliken visar total kostnad, dagens kostnad och hur mycket som är kvar av budgeten.

### Hårda säkerhetsregler

- **Alltid godkännande.** Bild, video, ljud och vision kräver ett personligt ja, även i Full auto.
  Auto-godkännande per kategori påverkar aldrig medieverktygen.
- **Inga hemligheter i prompts.** En prompt som ser ut att innehålla en API-nyckel, token eller
  lösenord blockeras innan den lämnar datorn.
- **Providerns filter kringgås aldrig.** En prompt som ber om att stänga av leverantörens
  säkerhetsfilter blockeras, och Freevobe skickar aldrig en sådan instruktion vidare.
- **Sexuellt innehåll med minderåriga blockeras** i alla lägen och går inte att godkänna bort.
- **Ingen fil utanför projektet.** Analysverktygen läser bara filer under projektroten, och
  mediafliken visar bara `.freevobe/media/`.

Reglerna gäller i alla behörighetslägen och kan inte slås av i gränssnittet.

Se [media-flows.md](media-flows.md) för tre kompletta exempel från prompt till färdig fil.
