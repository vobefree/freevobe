# ThemeFold – systemdokumentation

> Den här filen beskriver **endast det som är byggt och finns i koden**. Inga idéer,
> planer eller halvfärdiga funktioner. Underlaget är källkoden i `temply/` och den
> databasstruktur som `src/lib/db.ts` skapar.
>
> Produktnamn i gränssnittet: **ThemeFold**. Projektmappen och paketet heter `temply`.
> Senast uppdaterad: 2026-10-19, med Advanced-läget, gratis bildgenerator, Canva-import och
> vattenmärket under provperioden.

---

## 1. Vad systemet är

ThemeFold är en webbaserad studio för att bygga, exportera och publicera Shopify-teman.
En användare beskriver sin butik (i fritext, från en webbplatsadress eller genom att
peka och dra i en live-förhandsvisning), får ett komplett tema och kan sedan ladda ner
det som ett `.zip`-paket eller publicera det direkt till en Shopify-butik via OAuth.

Runt kärnan finns fyra lager som alla är implementerade:

| Lager | Vad det gör |
| --- | --- |
| **Studion** | Redigerar teman i två valfria bygglägen: **tema-styrt** (sektioner, layout, marknader, design, varumärke, media, integrationer, konvertering, copy, AI, temahealth, statistik och historik) eller **Advanced** (fri canvas med AI, Canva-import och gratis bildgenerator) |
| **Konton och betalning** | Registrering, inloggning (e-post, Google, Facebook, Shopify), provperiod och Stripe-prenumeration |
| **Partner/Byrå** | Arbetsyta för byråer: projekt, kunder, team, bibliotek, kundgranskning och vit etikett |
| **Administration** | Internt kontrollplan: översikt, ekonomi, bokföring, användare, inkorg, personal och roller, API-nycklar, projekt, innehåll, system och logg |

Systemet är en fristående Next.js-app utan extern databas eller externa UI-ramverk för
komponenter.

**Två bygglägen, ett tema:** det tema-styrda läget är standard och är det som alltid
skapas om användaren inte aktivt väljer något annat. Advanced är opt-in, sparas i samma
`ThemeConfig` och kan slås på eller av mitt i arbetet utan att sektioner, designtokens
eller Brand DNA skrivs över. Oberoende av läge exporteras temat som ett komplett
Shopify-tema (Online Store 2.0) med Liquid, JSON och samma designtokens. Teman som
skapas eller laddas ner under provperioden får ett låst ThemeFold-vattenmärke i
sidfoten; betalande konton får det inte.

---

## 2. Teknisk plattform

| Del | Val i koden |
| --- | --- |
| Ramverk | Next.js 16 (App Router, App Router-route handlers, React Server Components) |
| Språk | TypeScript 5.9, React 19 |
| Databas | SQLite via Nodes inbyggda `node:sqlite`, filen `.data/temply.db` i WAL-läge |
| Databasbibliotek | Inget – all SQL skrivs för hand i `src/lib/db.ts` och domänmodulerna |
| Styling | Handskriven CSS i sex globala filer (`globals.css`, `site.css`, `storefront.css`, `advanced.css`, `admin.css`, `admin-panels.css`), inga CSS-ramverk |
| Ikoner | `lucide-react` används av `src/components/Icon.tsx` |
| Typsnitt | Laddas från Google Fonts i rotlayouten (Inter, Inter Tight, Instrument Serif, Fraunces, DM Sans) |
| Meddelanden | Inget e-postsystem ingår – kontaktformuläret sparas i databasen |
| Node-version | `engines.node >= 24` (krävs för `node:sqlite`) |

Körkommandon finns i `package.json`: `dev`, `build`, `start`, `typecheck`.
Det finns inga automatiska tester i repot och ingen CI-konfiguration.

---

## 3. Flödet genom systemet

```
Besökare ──► /{språk} (marknadssajt) ──► /{språk}/signup ──► /{språk}/dashboard
                                                                │
                            ┌───────────────────────────────────┤
                            ▼                                   ▼
                    /{språk}/studio/{id}                  Shopify-koppling
        (tema-styrt eller Advanced, health, statistik, AI)  (OAuth mot butiken)
                            │                                   │
                            ├──► .zip-export                    └──► publicering
                            │      (ev. vattenmärke)                  (themeCreate,
                            └──► projektversioner                     themeFilesUpsert,
                                                                      themePublish)

Byrå:      /{språk}/agency ──► /{språk}/agency/workspace ──► /{språk}/review/{token}
                                                  (kundens granskningslänk)

Internt:   /{språk}/admin/**  (inloggning + tvåfaktorskod krävs)
```

### 3.1 Tekniskt dataflöde

- **Rendering:** alla sidor är React Server Components. Inloggning läses med
  `getCurrentUser()` i serverkomponenter och route handlers; det finns ingen global
  klientstore. Studion är den enda stora klientkomponenten och håller temat i en
  `useReducer` med historik för ångra/gör om.
- **Sparande:** varje ändring i studion går genom `commit()`/`commitVersioned()`.
  Autosparningen väntar 700 ms efter sista ändringen och skickar hela `config` som
  JSON till `PATCH /api/projects/{id}`. Servern normaliserar och validerar innan
  raden skrivs; en versionsetikett skapar samtidigt en rad i `project_versions`.
- **Läsande:** `parseConfig()` normaliserar äldre projekt vid varje läsning, så nya
  fält (till exempel `builder`) får standardvärden utan migrering av befintliga rader.
- **Export:** route handlern bygger filerna i minnet, zippar dem med den egna
  implementationen i `src/lib/export/zip.ts` och svarar med `application/zip`.
  Ingen fil skrivs till disk.
- **Publicering:** samma `buildThemeFiles()` används som vid nedladdning, varefter
  Shopify Admin GraphQL anropas. Provperiodens vattenmärke följer därför med även
  vid direkt publicering.
- **Bilder:** AI- och Canva-bilder lagras som URL eller data-URL i temats JSON. Det
  finns ingen extern bildlagring, och ingen bild skickas till någon annan tjänst än
  den som användaren själv valt (gratis AI för text, lokal generator för bilder).

---

## 4. Publika ytor och rutter

Alla sidor ligger under `src/app/[locale]/…` och finns på åtta språk.

| Rutt | Innehåll |
| --- | --- |
| `/{locale}` | Marknadssajt: hero med promptfält, showcase, steg-för-steg, funktioner, formlekplats, priser, FAQ, avslutande CTA, footer |
| `/{locale}/pricing` | Priser, provperiod och prenumerationsknapp |
| `/{locale}/agency` | Partner/Byrå-presentation |
| `/{locale}/agency/pricing` | Byråplanerna Starter, Pro, Unlimited |
| `/{locale}/login` | Inloggning (e-post, Shopify, Google, Facebook) |
| `/{locale}/signup` | Registrering med värvningskod |
| `/{locale}/dashboard` | Användarens teman, nytt tema, Shopify-koppling, värvning, kontostatus |
| `/{locale}/studio/{id}` | Studion för ett enskilt tema |
| `/{locale}/agency/workspace` | Byråns arbetsyta |
| `/{locale}/review/{token}` | Kundgranskning av ett tema (länk med token) |
| `/{locale}/contact` | Kontaktformulär |
| `/{locale}/terms`, `/{locale}/privacy` | Juridiska sidor ur den redigerbara sajttexten |
| `/{locale}/staff/join/{token}` | Acceptera en personalinbjudan |
| `/{locale}/admin` | Adminpanelens översikt (gate om inloggning/tvåfaktor saknas) |
| `/{locale}/admin/economy` | Ekonomi: intäkter, abonnemang, konvertering, betalningar, värvning |
| `/{locale}/admin/accounting` | Bokföring: SIE4, momsrapport, verifikationer, underlag |
| `/{locale}/admin/users` | Användarkonton |
| `/{locale}/admin/inbox` | Inkorg från kontaktformuläret |
| `/{locale}/admin/staff` | Personal och inbjudningar |
| `/{locale}/admin/keys` | API-nycklar och inställningar |
| `/{locale}/admin/projects` | Alla teman i systemet |
| `/{locale}/admin/content` | Innehållseditorn för all sajttext |
| `/{locale}/admin/system` | Driftstatus och sajtregler |
| `/{locale}/admin/audit` | Granskningslogg |

### 4.1 Marknadssajten i sin helhet

Startsidan (`src/app/[locale]/page.tsx`) är byggd i åtta avsnitt, alla med text som
kan skrivas över i innehållseditorn:

1. **Hero** med rubrik, underrubrik, promptfältet (`PromptStart`), förtroenderad och
   tre nyckeltal. Till höger en levande temaförhandsvisning (`HeroShowcase`) med
   badgar för typografi och radie.
2. **Logotypband** (`LogoWave`) med varumärkesnotis.
3. **Språkrad** med de åtta språken och respektive lokala pris.
4. **Så funkar det** i tre steg med illustrationer (`StepArt`).
5. **Funktioner** i sex kort (färg, typografi, form, luft, redigering, snabbhet).
6. **Enkelt läge** med punktlista och den interaktiva formlekplatsen
   (`ShapePlayground`).
7. **Pris** med provperiod, lokalt pris, funktionslista och CTA.
8. **FAQ**, **byråteaser**, avslutande CTA (`FinalCta`), `SiteHeader`, `SiteFooter`
   och cookiebanner (`CookieBanner`).

Sidorna `/pricing`, `/agency`, `/agency/pricing`, `/contact`, `/terms`, `/privacy`
återanvänder samma header, footer och språkval. Alla sidor är serverrenderade och
metadata (titel, beskrivning, canonical) byggs per språk.

Rotrouten `/` har en egen sida som omdirigerar till rätt språk (sparad cookie först,
därefter `Accept-Language`, annars svenska). `src/middleware.ts` gör samma
omdirigering innan sidan renderas, så `/` landar alltid i rätt språk.

---

## 5. Konton, inloggning och sessioner

Implementerat i `src/lib/auth.ts`, `src/lib/social.ts`, `src/lib/shopify.ts` och
`src/app/api/auth/*`.

- **Lösenord** hashas med `scrypt` (16 byte salt, 64 byte nyckel) och jämförs med
  `timingSafeEqual`. Lösenordet måste vara minst 8 tecken vid registrering.
- **Sessioner** ligger i `sessions`-tabellen med 30 dagars giltighet. Cookien
  `temply_session` är `httpOnly`, `sameSite=lax` och `secure` i produktion.
- **Inaktiverade konton** tappar åtkomst direkt, även med giltig session.
- **Inloggningsmetoder som finns:**
  - e-post och lösenord (`/api/auth/login`)
  - Google och Facebook via OAuth (`/api/auth/social/{provider}` + callback) –
    knapparna visas alltid men kräver `GOOGLE_CLIENT_ID`/`FACEBOOK_CLIENT_ID`
  - Shopify-butik via OAuth (`/api/auth/shopify`) som bevisar åtkomst till butiken
    och knyter den till ett befintligt konto
- **Registrering** (`/api/auth/signup`) respekterar `SITE_SIGNUPS`, validerar e-post,
  skapar kontot med provperiod och tillämpar värvningskoden direkt om en sådan anges.
- Det finns **ingen självbetjänings-återställning av lösenord** – en administratör kan
  sätta ett tillfälligt lösenord i användarvyn.

---

## 6. Dashboard för användaren

`src/app/[locale]/dashboard/page.tsx` + `src/components/Dashboard.tsx`.

- Listar användarens teman med namn, status, uppdateringsdatum och publiceringsdatum.
- Skapar nya teman via `POST /api/projects` med namn, fritextprompt, humör
  (`minimal`, `warm`, `playful`, `luxe`, `nature`, `neon`) och **byggläge**.
  *Tema-styrd* är förvalt; *Advanced* skapar en startcanvas (`starterCanvas`) med
  butikens hero, bild, rubrik, text, knapp, tre produkter och ett kampanjband, så
  användaren börjar i en redigerbar version av temat i stället för en tom yta.
- Visar en miniatyr av varje tema: temastyrda projekt renderas som en liten
  butiksförhandsvisning, Advanced-projekt som en skalad canvas
  (`AdvancedCanvasView`). Projekt med `builder.mode = "advanced"` märks med en
  **Advanced**-pill.
- Byter namn, öppnar i studion och raderar teman (med bekräftelse).
- Visar kontostatus: provperiod med återstående dagar, aktiv prenumeration eller
  utgången åtkomst. När åtkomsten gått ut låses byggflödet (`canBuild`) med status 402
  medan inloggning och export av befintliga projekt fungerar.
- Kopplar Shopify-butik och visar om butiken är ansluten.
- Visar värvningskortet: kod, färdig länk att kopiera, statistik och reglerna.
- Visar eventuellt driftmeddelande från `SITE_ANNOUNCEMENT`.

---

## 7. Studion

`src/app/[locale]/studio/[id]/page.tsx` + `src/components/studio/Studio.tsx`.

### 7.1 Skal och arbetsflöde

- **Två lägen:** *Enkelt* (guidebaserad panel) och *Proffs* (flikenligt gränssnitt).
- **Live-förhandsvisning** av en butik med sidorna hem, produkt, om, kontakt och varukorg,
  i desktop- eller mobilbredd.
- **Klicka och redigera direkt i förhandsvisningen**: rubriker, knappar, produktnamn
  och priser kan ändras på plats.
- **Autosparning** 700 ms efter senaste ändring, med statusrad (*sparar*, *sparat*, *fel*).
- **Ångra/gör om** med `Ctrl/Cmd+Z` och `Ctrl/Cmd+Shift+Z`, med historikstack i minnet.
- **Sektionslistan** låter dig lägga till, flytta upp och ner, dölja och visa,
  duplicera och radera sektioner, och i enkelläget finns en knapp för att återställa
  designen.
- **Form och storlek med drag**: radie och proportioner kan dras i förhandsvisningen,
  med reglage för luft, kolumner och textstorlek.
- **Bygglägesväxlare** i verktygsraden (och i mobilläget): *Tema-styrd* / *Advanced*.
  Valet skrivs till `config.builder.mode` och autosparas. När läget slås på första
  gången skapas en startcanvas; när det slås av behålls canvasen intakt, så inget
  arbete försvinner och användaren kan växla fram och tillbaka.
- **Exportmodalen** listar vilka filer som följer med. Under provperioden visas
  dessutom en rad om att den låsta ThemeFold-crediten ingår i exporten.

### 7.2 Flikar i proffsläget

| Flik | Innehåll |
| --- | --- |
| Sektioner | Lägg till, ta bort, sortera, dölj, duplicera och välj sektion |
| Layout | Sektionsbredd, luft, kolumner, bildformat, variant och asymmetri (jämnt, framhävt kort, mosaik) |
| Marknader | Aktiva marknader med språk, valuta, frakt-, retur- och kampanjtext samt egen hero-text per marknad |
| Design | Palett, typografi, form och rörelse samt designtokens |
| Varumärke | Brand DNA (webbplats, palett, text), logotyp och genererade varumärkesfiler (favicon, OG-bild) |
| Media | Bildgenerering för hero och banner, borttagning av bakgrund, smart beskärning med motivfokus och manuell fokuspunkt |
| Integrationer | Nio integrationsplatser med leverantörsval samt Canva-brief och format |
| Konvertering | Fri frakt-bar, recensioner, trust, brådska, nyhetsbrev, sök, sticky add-to-cart och exit-intent |
| Copy | AI- eller regelbaserad text för hero, produkter, SEO, CTA och kampanj |
| Innehåll | Temats innehållstexter |
| AI | Prompt till färdigt tema |
| Theme Health | Analys med betyg, fynd och automatiska fixar |
| Statistik | Shopify-statistik före/efter temaändring, kanaler, produkter och kundvagn |
| Historik | Sparade versioner, spara version, återställ (nuvarande läge sparas först) |

### 7.3 Sektionstyper (18 st)

`hero`, `productGrid`, `features`, `imageText`, `testimonials`, `marquee`, `faq`,
`newsletter`, `ugc`, `trust`, `bundle`, `sizeGuide`, `countdown`, `collection`,
`comparison`, `lookbook`, `completeTheLook`, `story`.

Varje sektion kan styras med samma layoutfält (`width`, `space`, `columns`, `ratio`,
`gap`, `variant`, `span`), så layoutmotorn är gemensam för alla typer.

### 7.4 Advanced-läget (valfritt)

Standard är fortfarande det temastyrda bygget. Advanced är opt-in och kan väljas både
när ett tema skapas (dashboardens dialog) och när som helst i studion via
bygglägesväxlaren. Valet sparas i `config.builder.mode`. När läget slås på första gången
skapas en startcanvas; när det slås av behålls canvasen, så användaren kan växla fram
och tillbaka utan att förlora arbete. Sektioner, designtokens och Brand DNA ligger kvar
och används av båda lägena.

#### 7.4.1 Canvasens modell

Canvasen är en oberoende yta i designkoordinaterna **1200 × 1400** med bakgrund från
en färgtoken eller `transparent`. Den lagras i `ThemeConfig.builder.canvas`:

```ts
builder: {
  mode: "theme" | "advanced";
  canvas: {
    version: 1;
    width: 1200;
    height: 1400;
    background: AdvancedColorToken | "transparent";
    nodes: AdvancedNode[];
  };
}
```

Varje nod har `id`, `type`, `x`, `y`, `w`, `h`, `z`, `rotation`, `radius` och
`opacity`, plus typspecifika fält för text, bild, färg, form, produkt, sektion eller
ritning. Sedan finns `locked`, `hidden` och `groupId` för lagerkontroll. `normalizeNode`/
`normalizeCanvas` i `src/lib/advanced/canvas.ts` klipper alla värden till giltiga
intervall när projektet läses, så en handredigerad eller äldre JSON inte kan skapa en
trasig canvas. Gränserna är bland annat:

**Vy och frihet**

- **Zoom:** 25–200 % i verktygsraden, 100 % återställs med ett klick på procenten.
- **Panorering:** håll `Space` eller mittenmusknappen och dra; scenen scrollar i båda
  riktningarna. Zoom och panorering påverkar bara arbetsvyn, aldrig exporten.
- **Magneter:** knappen **Magneter på/av** slår på eller av snap för alla element.
  Kanter och mittpunkter snappar mot närliggande noder med guide-linjer; `Alt` under
  dragningen ger alltid fri placering.
- **Lager:** ögat visar/döljer en nod (dolda noder följer inte med i exporten) och
  hänglåset låser den så att den bara kan markeras i lagerlistan. Grupperade noder
  flyttas tillsammans när man drar i någon av dem.

| Fält | Gräns |
| --- | --- |
| Noder per canvas | 240 (`isValidConfig` avvisar fler) |
| Position | −20 000…20 000 (x och y) |
| Storlek | minst 4 × 4 |
| Rotation | −360…360 grader |
| Opacitet | 0…1 |
| Text | 2 000 tecken per nod |
| Bild-URL/data-URL | 8 000 000 tecken |
| Ritpunkter | 900 per ritning |
| Sektioner i temat | 60 (`isValidConfig`) |

#### 7.4.2 Element och sektioner

| Typ | Innehåll |
| --- | --- |
| `text` | Fritext med typsnittsstorlek, vikt, radhöjd, teckenavstånd, justering och färg |
| `heading` | Rubrik med temats rubriktypsnitt och vikt |
| `image` | Bild med URL/data-URL, alt-text, `cover`/`contain` och rundning |
| `button` | Länk med text, fyllning, textfärg och temats knappradie |
| `product` | Produktkort som pekar på index i butikens produktlista; exporten använder `collections.all.products` med temats produktdata som reserv |
| `section` | Färdig sektion i sex presets: hero, kampanj, produkter, fördelar, omdöme och banner |
| `shape` | Rektangel, ellips eller linje med fyllning, kontur och rundning |
| `drawing` | Frihandsritning sparad som normaliserade punkter (0–1) |
| `connector` | Koppling mellan två noder; slutpunkterna räknas fram live från nodernas mittpunkter |

Sektionerna är inte kopior av de temastyrda sektionerna: de är mindre, fristående
Liquid-block med samma innehållstyper och samma designtokens. Det gör att de kan
placeras var som helst på ytan och fortfarande se ut som en del av temat.

#### 7.4.3 Direktmanipulering och tangentbord

- **Flytta:** dra i noden. Minst 32 px av noden hålls kvar innanför ytan.
- **Storlek och form:** åtta handtag (`nw`, `n`, `ne`, `e`, `se`, `s`, `sw`, `w`).
  Minsta storlek är 24 px; rundning, rotation och opacitet ställs i högerpanelen.
- **Skriva:** dubbelklicka på en text- eller rubriknod och skriv direkt på canvasen.
  `Esc` avbryter, `Ctrl/Cmd+Enter` eller klick utanför sparar.
- **Rita:** välj pennan och dra fritt. Punkter närmare än 2 px hoppas över, och
  ritningen sparas som en nod med egen storlek och rundade linjer.
- **Koppla:** välj kopplingsverktyget, klicka på första och sedan andra noden. En pil
  skapas mellan nodernas mittpunkter och följer med när noderna flyttas. `Esc`
  avbryter.
- **Flera element:** `Shift`/`Cmd`/`Ctrl`-klicka för att markera flera noder. Då visas en
  radverktygsrad med **Lägg på rad** (samma överkant och höjd, jämna mellanrum och
  ordning från vänster till höger) och **Fri placering**.
- **Produkter på rad:** en ny produkt placeras automatiskt bredvid den förra i stället
  för ovanpå. Är en produkt markerad erbjuder radverktygsraden att lägga alla
  produkter på sidan på rad, även utan `Shift`-markering.
- **Radhjälp:** när en produkt eller bild dras nära en annan snappar överkanterna till
  samma rad och en guide visas. **Radhjälp på/av** i verktygsraden stänger av eller slår
  på hjälpen; `Alt` under dragningen ger alltid fri placering. **Fri placering** stänger
  också av radhjälpen.
- **Tangentbord:** `Delete`/`Backspace` raderar alla markerade noder, `Ctrl/Cmd+D`
  duplicerar, piltangenter flyttar 1 px (10 px med `Shift`) och `Esc` återgår till
  markeringsverktyget. Studions globala `Ctrl/Cmd+Z` och `Ctrl/Cmd+Shift+Z` fungerar
  även här.
- **Mobilläge:** device-växlaren i verktygsraden visar canvasen i mobilbredd och
  egenskapspanelen blir en drawer.

#### 7.4.4 Högerpanelen

Panelen visar först en översikt (antal noder, yta och bakgrund) när inget är markerat.
För en markerad nod visas:

- innehållsfält som passar typen (text, rubrik, överrad, brödtext, knapptext, länk,
  alt-text, bild-URL, produktindex, sektionstyp, form och ritfärg),
- X/Y/W/H som numeriska fält,
- rundning (0–120), rotation (−180…180), opacitet (0–1) och lager (`z`),
- färgväljare för text, fyllning och kontur. Färger kan vara temats `text`, `muted`,
  `primary`, `accent`, `surface`, `background` och `onPrimary` eller en egen hexkod,
- knapparna **Duplicera**, **Flytta fram** och **Flytta bak**.

Lagerlistan i vänsterpanelen visar noderna i `z`-ordning och har snabbknappar för att
markera, duplicera och radera. Där väljs också canvasens bakgrund och nya element läggs
till med temats aktuella typografi, radier och färger.

#### 7.4.5 AI-prompten och designagenten

Verktygsradens promptfält skickar `POST /api/ai/advanced` med projekt-id, prompt (max
600 tecken) och eventuell markerad nod. Första steget är alltid att tolka prompten i
`readPromptIntent` (`src/lib/advanced/design.ts`):

| Prompt | Tolkning | Resultat |
| --- | --- | --- |
| ”gör sidan mer premium” | stil | designplan |
| ”gör den här sektionen mörkare” | stil + markering | designplan på valt element |
| ”gör något coolt” | otydlig | `422 prompt_unclear` |
| ”skapa en hero för en kaffebutik” | innehåll | copy + ny sektion |

En stilprompt går aldrig till en textmodell. Den blir ett `DesignPlan` med en eller
flera `DesignMood` och ett scope (`canvas` eller `selection`). Innan något skrivs
öppnar `designVariants` tre förslag – den bokstavliga tolkningen plus två närliggande
stilar (premium → redaktionell och mörk premium, modern → minimal och teknisk, och så
vidare). De visas sida vid sida i en modal med varsin skalad live-förhandsvisning av
samma innehåll; först när användaren trycker **Använd** räknas planen in med
`applyDesignPlan`. **Avbryt** eller Escape lämnar projektet helt orört.

Motorn är deterministisk och kräver ingen nyckel: samma instruktion ger samma yta.
Den ändrar bara befintliga noder och stilar – den lägger **aldrig** till en textnod,
så användarens mening kan inte hamna som rubrik.

Stilarna är `premium`, `modern`, `minimal`, `warm`, `bold`, `playful`, `editorial`,
`tech`, `airy`, `compact` och `dark`. Varje recept sätter typsnitt (både
`typography` och nodens eget `font`), vikt, letter-spacing, line-height, radier,
knappstil, tokens och – för sidor – luft. Luften och typsnittsstorlekarna räknas om
från föregående grepp som sparas i `canvas.design`, så ”mer premium” två gånger ger
samma yta i stället för att krympa rubriken varje gång.

Säkerhetsregler i motorn:

- låsta noder lämnas orörda,
- en markering på en annan yta (sidhuvud/sidfot) träffar rätt canvas, aldrig hela sidan,
- `dark` räknar om textfärger och sektionsfyllning med luminans så texten förblir läsbar,
- ogiltiga eller okända mood-värden ignoreras när projektet läses in.

Innehållspromptar går vidare till copy-flödet: gratisvägarna i `freeTextWithProvider`
får strikt JSON (eyebrow, title, text, CTA, badge, preset) tillsammans med Brand DNA och
vald sektion. Svaret valideras och faller tillbaka på `localAdvancedCopy`.
Den lokala reserven använder butikens namn och ämnet i beställningen (”för en
kaffebutik” → ”Välkommen till Kaffebutik”) – aldrig instruktionen själv.

Bara noder av typen `text`, `heading`, `button` och `section` skrivs om. Är en form,
ritning eller koppling markerad skapas i stället en ny sektion, så en prompt aldrig
raderar ett element av misstag. Modellen får inte hitta på rabatter, priser eller
garantier som prompten eller Brand DNA inte stöder. När copy kommer från den lokala
motorn (när ingen gratis AI svarade) säger toasten det uttryckligen.

#### 7.4.6 Gratis bildgenerator

`GET /api/ai/nano-banana` bekräftar att funktionen är tillgänglig (den kräver ingen
nyckel); `POST` skapar en bild och lägger den som en bildnod (460 × 460, temats
bildradie).

- **Ingen extern bildmodell.** Googles bildmodeller (Nano Banana) kräver betald
  fakturering och används därför inte. Bilden ritas av `localArtwork` i
  `src/lib/ai/image.ts`: deterministiska former, gradienter och korn i varumärkets
  palett – samma prompt ger samma bild.
- **Ingen kvot och ingen nyckel.** Ingen räknare, inget `402` och ingen kostnad. Den
  tidigare kvoträknaren är borttagen; tabellen `image_generations` finns bara kvar i
  äldre databaser.
- **Lagring:** bilden kommer tillbaka som data-URL och sparas i nodens `src`. Det finns
  ingen extern bildlagring; en stor bild kan därför göra projektets JSON stor.
- **Offline:** funktionen kräver varken nätverk eller API-nyckel.

#### 7.4.7 Ikoner (bibliotek och egna uppladdningar)

Högerpanelen för varukorg och sök har en ikonväljare med tre källor:

- **Inbyggda exportikoner** – de ikoner som finns i `snippets/icon.liquid`, alltid
  tillgängliga offline.
- **Iconify-biblioteket** – 400 000+ ikoner i 240+ set (Lucide, Tabler, MDI, Phosphor,
  Solar, Hugeicons med flera), gratis och utan nyckel. Sökningen visar 60 träffar i
  taget med **Visa fler**, och **Bläddra i set** listar de första 180 ikonerna ur ett
  valt set. Den valda ikonen hämtas som SVG, saneras av `sanitizeSvg` i
  `src/lib/advanced/icons.ts` och sparas på noden (`iconSvg`).
- **Egen uppladdning** – SVG saneras och sparas som `iconSvg`; PNG, JPG, WebP och GIF
  sparas som data-URL i `iconImage` (max 300 kB). Båda varianterna följer med i
  exporten och kräver inga externa filer i butiken.

Bild- och SVG-markup begränsas till säkra taggar och attribut: script, `on*`-attribut,
`href`, `foreignObject` och externa resurser tas bort. Rasterikoner måste vara en
`data:image/...;base64,`-URL som högst är 420 000 tecken.

#### 7.4.8 Canva

Canva-fliken i Advanced har två vägar:

- **Sparade designer:** listan `config.integrations.canva.designs` från
  integrationspanelen kan läggas till som bildnoder.
- **Egen bildadress:** en URL till en Canva-export (eller annan bild) klistras in och
  läggs som bildnod med valfritt namn som alt-text.

Dessutom kan en **varumärkesbrief** kopieras: format, färger, typsnitt, textförslag,
canvasens storlek 1200 × 1400 och antal sektioner. Det finns fortfarande **ingen
Canva-API-integration** – importen sker via en URL som användaren själv kopierar, och
bilden lagras i temat.

#### 7.4.9 Export och gränser

- `src/lib/export/advanced.ts` genererar `sections/advanced-canvas.liquid` med samma
  palett, typografi, radier och konfiguration som resten av temat.
- Canvasen använder `container-type: inline-size` och `cqw`, så positioner, textstorlek
  och avstånd skalas proportionellt i Shopify och på mobil i stället för att låsa sig
  till pixlar.
- `templates/index.json` pekar på `advanced-canvas` endast när `builder.mode` är
  `advanced` **och** canvasen har minst en nod som inte är en koppling. En tom canvas
  faller tillbaka på det temastyrda förstaintrycket i stället för att ge en tom sida.
- Endast **startsidan** byts ut. Produkt-, samling-, varukorg-, sök- och innehållsmallar
  exporteras alltid från det temastyrda flödet, så kassa och produktdata fungerar.
- Kopplingar exporteras som ett separat SVG-lager med pilmarkör bakom noderna;
  ritningar exporteras som SVG-paths med `preserveAspectRatio="none"`.

#### 7.4.10 Interaktionseffekter

Varje nod kan ha en hover-effekt och en entréeffekt. Båda är ren CSS – ingen
JavaScript, ingen extern fil – och följer med i Shopify-exporten.

| Fält | Värden | Effekt |
| --- | --- | --- |
| `hover` | `none`, `lift`, `grow`, `glow`, `dim`, `underline`, `tilt` | `lift` lyfter elementet med skugga, `grow` skalar upp, `glow` lägger en ring i temats primärfärg, `dim` dämpar, `underline` stryker under text och `tilt` lutar något |
| `reveal` | `none`, `fade-up`, `zoom`, `slide-left`, `slide-right` | Entréeffekt som spelas upp när sidan laddas |

Effekterna använder de individuella CSS-egenskaperna `translate`, `scale` och
`rotate` i stället för `transform`. Det gör att en nod som redan har en inline-
rotation behåller den under effekten. `dim` använder `filter: opacity()`, eftersom
nodens inline-`opacity` annars skulle vinna över hover-regeln.

Klassnamnen byggs av `fxClasses` i `src/lib/advanced/canvas.ts` och delas av
editorn (`AdvancedCanvasView`), förhandsvisningen och `src/lib/export/advanced.ts`,
så en effekt ser likadan ut på alla tre ställen. I editorn är effekterna avstängda
(klasserna läggs bara på när `interactive` är `false`) så att hover aldrig flyttar
ett element under dragningen. `prefers-reduced-motion` stänger av både övergångar
och animationer. Värdena normaliseras mot `HOVER_EFFECTS` och `REVEAL_EFFECTS`, så
okända värden i en gammal eller handredigerad JSON faller bort vid inläsning.

### 7.5 Temamodellen

`src/lib/theme/types.ts` beskriver hela temat:

- **Palett** (primär, accent, bakgrund, text, ytor), **typografi** (tolv typsnitt i sans-
  och serifgrupper med färdiga parningar), **form** (radie, knappradie, kant, skugga),
  **rörelse** (på/av, hastighet).
- **Sektioner** enligt listan ovan, med innehåll per typ.
- **Header och footer** med mega-meny, sökning, varukorg, sticky och annonsband.
- **Butiksinformation** med namn, tagline och produkter.
- **Marknader**, **mediabibliotek**, **konverteringsinställningar**, **integrationer**,
  **varumärkeskit**, **Brand DNA** och **byggläge** (`builder.mode` + canvas).
- Sex humörpresets: `minimal`, `warm`, `playful`, `luxe`, `nature`, `neon`
  (`src/lib/theme/presets.ts`), plus en prompttolk i `src/lib/theme/prompt.ts` som
  översätter fritext till palett, typografi, form och innehåll helt utan AI.

---

## 8. Export av tema

`GET /api/projects/{id}/export` kräver giltig åtkomst (`canBuild`) och returnerar en
zip-fil byggd av `src/lib/export/theme.ts` tillsammans med `css.ts`, `sections*.ts`,
`advanced.ts`, `credit.ts`, `icons.ts`, `integrations.ts` och `zip.ts` (egen
zip-implementation). Samma byggfunktion används av publiceringen till Shopify.

Vad som läggs i filen styrs av två oberoende villkor:

| Villkor | Effekt |
| --- | --- |
| `builder.mode = "advanced"` och minst en icke-koppling på canvasen | `sections/advanced-canvas.liquid` läggs till och `templates/index.json` pekar på den |
| `watermarkRequired(user)` = `true` (provperiod) | `sections/themefold-footer.liquid` läggs till och renderas statiskt i layouten |

Allt annat är gemensamt för båda lägena: samma designtokens, samma varumärkeskit,
samma integrationer och samma övriga mallar.

### 8.1 Filerna i ett komplett tema

```
assets/theme.css, assets/theme.js
config/settings_schema.json, config/settings_data.json
layout/theme.liquid
locales/{sv,nb,fi,da,en,fr,de,es}.json
sections/header, footer, campaign-band,
         hero, product-grid, features, image-text, testimonials, marquee, faq,
         newsletter, ugc, trust, bundle, size-guide, countdown, category-grid,
         comparison, lookbook, complete-the-look, story,
         main-product, main-collection, main-cart, main-page, main-about,
         main-contact, main-search, main-404, main-list-collections,
         advanced-canvas           (endast Advanced)
         themefold-footer          (endast provperiod)
snippets/product-card, icon, mega-menu, sticky-atc, free-shipping-bar,
         recently-viewed, size-guide, reviews, exit-intent, market-switcher,
         markets, integration-{analytics,chat,consent,newsletter,payments}, app-embed
templates/index, product, collection, cart, page, page.about, page.contact,
          404, search, list-collections
```

`templates/index.json` byggs från temats synliga sektioner i ordning. Okända
sektionstyper hoppas över med en varning i stället för att krascha hela exporten.
Filen kan laddas upp manuellt i Shopify Admin → Online Store → Themes.

### 8.2 Den temastyrda exporten

Detta är standardflödet. Varje synlig sektion i `config.sections` blir en egen Liquid-
sektion med schema-inställningar och blocks, och `templates/index.json` kopplar ihop
dem i rätt ordning. Header, footer, produktkort, varukorg, sök, 404 och innehållssidor
exporteras alltid, oavsett byggläge. Design tokens skrivs till
`config/settings_data.json` och CSS-variablerna i `assets/theme.css`, så en ändring i
palett, typografi eller radie slår igenom i hela butiken.

### 8.3 Advanced-exporten

`advancedSection()` renderar varje nod som absolut positionerad HTML inuti en
`aspect-ratio`-yta med `container-type: inline-size`. Textstorlek, radie och avstånd
räknas om till `cqw` från designbredden 1200, så canvasen behåller proportionerna på
alla skärmar. Produktnoder använder `collections.all.products` och
`image_url`/`image_tag`; sektionsnoder använder temats egna färger och typsnitt.
Kopplingar ritas som ett separat SVG-lager med pilmarkör, och ritningar blir SVG-paths.
Sektionen har bara två schema-inställningar (bakgrundsfärg och maxbredd) och kan
redigeras i Shopifys editor utan att layouten går sönder.

### 8.4 Vattenmärke under provperioden

`watermarkRequired(user)` i `src/lib/db.ts` är `true` så länge kontot har status
`trial`. Då läggs `sections/themefold-footer.liquid` (`src/lib/export/credit.ts`) i
zip-filen och renderas statiskt från `layout/theme.liquid` med
`{% section 'themefold-footer' %}`.

- **Låst i editorn:** sektionen ligger utanför `templates/*.json`, har inga
  inställningar och inga presets. Statiska sektioner kan därför inte raderas, flyttas
  eller läggas till i Shopifys temaeditor – de följer med även vid manuell import.
- **Semantik och SEO:** markupen är en riktig `<footer role="contentinfo">` med
  `lang="en"`, `aria-label`, en beskrivande länktext (”Made with ❤️ using ThemeFold”),
  `target="_blank"`, `rel="noopener"` och UTM-taggar till `https://themefold.se`.
  Emojin är `aria-hidden` och kompletteras med dold text för skärmläsare.
- **Betalande konton:** varken filen eller layoutraden läggs i exporten.
- **Publicering:** samma flagga används av `POST /api/projects/{id}/publish`, så ett
  provtema som publiceras direkt till Shopify får vattenmärket.
- **Granskningslänkar:** `/api/review/{token}/download` använder byråns ägarkonto för
  att avgöra plan, så en granskningslänk inte kan användas för att kringgå regeln.
- **Redan publicerat tema:** märket ligger kvar i butiken tills användaren publicerar
  om efter uppgradering; en ny export för betalande innehåller det aldrig.
- **Gräns:** den som redigerar temakoden direkt kan alltid ta bort en sektion. Låsningen
  gäller Shopifys editor och den normala exporten, inte manuella kodändringar.

### 8.5 Validering och gränser

`isValidConfig()` kontrollerar att `version` är 1, att obligatoriska delar finns, att
temat har högst 60 sektioner och att en eventuell canvas har högst 240 noder. Saknade
fält fylls av `normalizeTheme()`, som också ser till att `builder.mode` alltid är
`theme` eller `advanced` och att canvasen har rätt version och storlek. Det gör att ett
tema sparat före Advanced-läget fortsätter att fungera och exporteras som förut.

---

## 9. Publicering till Shopify

`src/lib/shopify.ts`, `src/app/api/shopify/*`, `src/app/api/projects/{id}/publish`.

- **OAuth-flöde:** `/api/shopify/install?shop=…` sätter en state-cookie och skickar
  användaren till Shopifys godkännandesida. `/api/shopify/callback` verifierar HMAC och
  state, byter koden mot en access-token och sparar butik, token, scopes och tidpunkt
  på användaren.
- **Scopes** (standard): `read_themes,write_themes,read_reports`, API-version `2026-07`.
- **Publicering:** `GET /api/projects/{id}/publish` listar butikens teman;
  `POST` bygger alla temafiler server-side och laddar upp dem till ett valt eller nytt
  tema via Admin GraphQL (`themeCreate`, `themeFilesUpsert`, `themePublish`) och sparar
  temats id och publiceringstid på projektet. Svaret innehåller admin-URL, antal
  uppladdade filer och eventuella fel per fil.
- **Vattenmärke:** `POST` bygger filerna med `watermarkRequired(user)`, så ett
  provtema som publiceras direkt får samma låsta ThemeFold-footer som en nedladdning.
  Efter uppgradering måste temat publiceras om för att märket ska försvinna ur butiken.
- Publicering kräver att Stripe-/Shopify-nycklar finns; annars svarar API:et
  `shopify_not_configured` (501) respektive `not_connected` (409).

---

## 10. Theme Health

`src/lib/health/*` + `src/app/api/health/*` + `src/components/studio/HealthPanel.tsx`.

- **Åtta kategorier:** prestanda, SEO, mobil, bilder, länkar, tillgänglighet,
  konvertering och översättningar.
- **Analysen** (`runThemeHealth`) arbetar på temats konfiguration och ger en poäng
  0–100, ett betyg A–E, kategoripoäng, mätvärden och en lista med fynd. Varje fynd har
  ett stabilt id (t.ex. `seo.title-short`, `images.oversized`, `mobile.small-text`,
  `conversion.sticky-atc`, `translations.swedish-leak`), allvarlighetsgrad, förklaring,
  förslag på åtgärd och vikt.
- **Google PageSpeed** kan köras som tillval (`fetchPsi`, 18 sekunders timeout) och ger
  LCP, CLS, TBT, sidvikt och Lighthouse-poäng. Kräver att butiken är kopplad.
- **Länkkontroll** som tillval (`checkStoreLinks`) hämtar butikens framsida och testar
  upp till tolv interna länkar. Kräver kopplad butik.
- **Automatiska fixar** (`applyHealthFixes`) åtgärdar de fynd som är markerade som
  automatiska, till exempel för svag kontrast, och rapporterar vilka som tillämpades.
- **Resultatet sparas** i `theme_health` och visas vid nästa besök.

---

## 11. Statistik

`src/lib/stats/*` + `GET /api/analytics/shopify` + `StatsPanel`.

- Hämtar säljdata via **ShopifyQL** för två perioder: före och efter temaändringen,
  samt dagsserie, kanaler, topprodukter och kundvagnsdata.
- **Utan kopplad butik eller rapporteringsbehörighet** används tydligt märkt exempeldata
  (`source: "demo"`) med en banner i gränssnittet, så vyn alltid går att använda.
- Varje hämtning sparas i `stats_snapshots` och kan läsas av AI-insikterna.

---

## 12. AI

| Funktion | Leverantör och modul | Beteende |
| --- | --- | --- |
| Prompt → tema | Gratis AI via `src/app/api/ai/theme` | Frågar modellen om humör, färger, radier, typsnitt och texter som JSON. Utan svar tolkas prompten av den inbyggda motorn |
| Texter | Gratis AI via `src/lib/ai/copy.ts` och `POST /api/ai/copy` | Genererar texter för hero, produkter, SEO, CTA och kampanj, och följer Brand DNA när det finns. Utan svar används den regelbaserade generatorn |
| Bilder | Lokal generator i `src/lib/ai/image.ts` | Fyra format: hero, banner, lifestyle och produkt. Deterministisk SVG-konst i varumärkets färger – inga externa anrop och ingen kostnad |
| Advanced-sektion (”Bygg med AI”) | Gratis AI via `src/app/api/ai/advanced` och `src/lib/advanced/prompt.ts` | Skriver om en vald canvasnod eller skapar en ny sektion. Svaret anger `provider` så att det syns vilken gratistjänst som svarade. Utan svar används en regelbaserad kampanj- och sektionsmotor |
| Bild till canvasen | Lokal generator via `src/app/api/ai/nano-banana` och `src/lib/ai/image.ts` | Skapar en bild i varumärkets färger direkt på servern. Ingen nyckel, ingen kvot och ingen betald bildmodell |
| Insikter | Gratis AI via `src/lib/ai/insights.ts` | Läser temahealth och statistik och prioriterar åtgärder. Panelen märker svaret ”Gratis AI”; utan svar används regelbaserade insikter |
| Brand DNA-berikning | Gratis AI via `src/lib/brand/ai-dna.ts` | Föreslår ton, positionering och bildspråk utifrån sajtens text. Misslyckas tyst och DNA:t från crawlningen behålls |

Alla AI-anrop har en fungerande fallback, så ingen funktion i studion kräver en AI-nyckel.
Oberoende av vilka nycklar som finns är analysen av temat (temahealth) och exporten helt
lokal.

**Gratis först, nycklar sist.** `freeTextWithProvider` i `src/lib/ai/free-text.ts` provar
vägarna i denna ordning:

1. **Kilo Gateway** (`minimax/minimax-m3.1-flash:free`) – nyckelfri, routar till en
gratismodell och svarar utan inloggning. Reserv: `kilo-auto/free`.
2. **Pollinations** – nyckelfri sista utväg, strypt till ett svar var 30:e sekund per IP.
3. **Google Gemini** (`GEMINI_API_KEY`) – endast Flash-modellerna i gratisnivån.
4. **OpenRouter** (`OPENROUTER_API_KEY`) – alltid `openrouter/free` eller `:free`.

Nycklarna ligger sist medvetet: en nyckel kan sitta på ett Google Cloud-projekt med
fakturering, och då debiteras även Flash-modellerna. Ett gratisbygge ska aldrig kunna råka
kosta pengar bara för att en nyckel finns i miljön. `FREE_AI_KEYLESS=0` stänger av de två
nyckelfria vägarna för den som hellre vill använda sin egen nyckel. Svaret innehåller
ochå `provider` (`kilo`, `pollinations`, `gemini` eller `openrouter`), så det går att se
i nätverksfliken vilken väg som användes.

**Advanced-prompten** skickar alltid med Brand DNA (`dnaPrompt`) och den valda nodens
nuvarande innehåll. Svaret måste vara JSON med `eyebrow`, `title`, `text`, `ctaLabel`,
`badge` och `preset`; servern validerar och klipper längderna innan noden byggs om. Om
alla gratisvägar fallerar används den regelbaserade motorn som känner igen kampanj,
produkter, fördelar, omdöme och banner.

**Endast gratismodeller** används. Textmodeller måste vara Flash-varianter i Googles
gratisnivå (`freeGeminiModel` i `src/lib/ai/gemini.ts` avvisar Pro, Argon och andra
betalmodeller), OpenRouter tvingas alltid till `openrouter/free` eller ett modellnamn som
slutar på `:free`, och samma regel gäller `KILO_MODEL` (`kiloModel` i
`src/lib/ai/free-text.ts`). Bildfunktionen anropar ingen extern bildmodell alls – Googles
bildmodeller kräver betald fakturering – utan ritar bilden lokalt.

**Nycklar och modeller** kan bytas i adminpanelen utan omstart, eftersom `envValue()`
läser databasen före miljön. `GOOGLE_API_KEY` fungerar som reserv till
`GEMINI_API_KEY`.

---

## 13. Brand DNA och varumärkesanalys

`src/lib/brand/*`, `POST /api/brand/extract`, `POST /api/brand/dna`,
`src/components/studio/BrandDnaEditor.tsx`.

- **Från webbplats:** `crawlSite` hämtar startsidan och relevanta undersidor.
  Den respekterar `robots.txt`, blockerar privata adresser (SSRF-skydd mot
  `localhost`, `10.x`, `192.168.x`, `172.16–31.x`, `.local`) och normaliserar inmatad
  adress till http(s). Den snabba analysen i `brand/extract` använder samma skydd
  (`fetchPublicPage`): DNS-kontroll före varje anrop, privata adresser avvisas även
  efter omdirigering, och bara http(s) med port 80/443 tillåts.
- **Från palett eller text:** snabbvägen läser hexkoder eller fritext och bygger en
  palett och en stiling.
- **Analysen** plockar ut färger (med viktning för knappanvändning), typsnitt,
  radier, bilder, logotyp, ikoner, sociala länkar, produkter, sidtitel, meta-beskrivning,
  OG-bild samt text om retur, frakt och garantier – med filter som rensar bort
  navigations- och cookiebrus.
- **Brand DNA** är ett strukturerat dokument (palett, typografi, form, bildspråk, ton,
  positionering, löften, do/don't) som kan redigeras fält för fält. Manuellt ändrade
  fält markeras så att AI:n inte skriver över dem.
- **Tillämpning** (`applyDna`) skriver DNA:t på temat och `dnaPrompt` skickar en kort
  sammanfattning med i AI-anrop så att ton och bildspråk håller ihop.
- **Varumärkesfiler:** favicon, logotypvariant och OG-bild genereras som SVG ur
  varumärket, och logotyp kan laddas upp som fil och sparas i temat.

---

## 14. Integrationer och konvertering

`src/lib/integrations/catalog.ts`, `src/components/studio/IntegrationsPanel.tsx`.

Nio platser med valbara leverantörer, som alla får motsvarande snippet i exporten:

| Plats | Leverantörer |
| --- | --- |
| produktrecensioner | Judge.me, Loox, Shopify Reviews |
| nyhetsbrev i footern | Klaviyo, Omnisend, Mailchimp |
| chatt | Tidio, Gorgias, Intercom |
| lojalitet | Smile.io, LoyaltyLion |
| analys (flera samtidigt) | Google Analytics 4, Meta Pixel, TikTok Pixel |
| samtycke | Shopify Customer Privacy, Cookiebot, Consentmo |
| betalningar (flera samtidigt) | Klarna, PayPal, Shop Pay, Apple Pay |
| social UGC | Instagram-feed, Foursixty |
| kampanjband | Temply kampanjband (byggs i temat, ingen app krävs), Shopify Campaigns |

Dessutom finns **Canva-panelen**: den genererar formatmallar och en brief (format,
färger, typsnitt, textförslag) som klistras in i Canva, och sparar Canva-designer i
`config.integrations.canva.designs`. I Advanced-läget kan en sparad design eller en
bildadress från en Canva-export läggas direkt som bildnod, och briefen som kopieras
därifrån innehåller även canvasens mått (1200 × 1400) och antal sektioner. Det finns
fortfarande **ingen Canva-API-integration** i koden – importen sker via en URL som
användaren själv kopierar, och bilden lagras i temat.

**Konverteringspanelen** styr fri frakt-bar, recensioner, trust-markörer, brådska,
nyhetsbrev, sök, sticky add-to-cart och exit-intent, och dessa skrivs till temats
snippets vid export.

---

## 15. Partner/Byrå

`src/lib/agency.ts`, `src/lib/agency-plans.ts`, `src/app/api/agency/*`,
`src/components/agency/AgencyWorkspace.tsx`.

### 15.1 Planer

| Plan | Pris | Projekt | Medlemmar | AI-copy | AI-bilder | Vit etikett | Kundgranskning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Partner Starter | $99 | 3 | 2 | 100 | 50 | nej | nej |
| Partner Pro | $249 | 10 | 5 | 500 | 250 | ja | ja |
| Partner Unlimited | $499 | obegränsat | obegränsat | 5000 | 2500 | ja | ja |

Planen sparas på byrån och **kan bytas i byråns inställningar**. Gränserna för projekt,
medlemmar och AI-kvot kontrolleras i API:erna för att koppla projekt och bjuda in
medlemmar, medan kundgranskning kräver Pro eller Unlimited.

### 15.2 Arbetsytan

Fem flikar: **översikt**, **projekt**, **bibliotek**, **team** och **granskningar**,
plus **inställningar** för namn, plan, varumärkesnamn, varumärkesfärg och vit etikett.

- **Projekt** kopplas till kunder och får status; de skapar en riktig projektrad som
  sedan öppnas i studion.
- **Kunder** registreras med namn, butiksdomän och kontaktadress.
- **Bibliotek** sparar delar av ett tema (tema, sektion, varumärke, tokens, konvertering)
  och kan appliceras på andra projekt.
- **Team** är byråns medlemslista med rollerna ägare, administratör, designer och
  granskare. Rollerna beskriver ansvar och visas i gränssnittet; själva arbetsytan och
  dess API:er är knutna till byråns ägarkonto. Medlemmarna har ingen egen inloggning
  till arbetsytan, eftersom det skulle kräva e-postverifiering för att en inbjuden
  adress inte ska kunna tas över av någon annan.

### 15.3 Kundgranskning

En granskningslänk skapas per projekt och kund, med en token i `agency_reviews`. Kunden
öppnar `/{locale}/review/{token}` utan konto och kan:

- titta på temat i förhandsvisning,
- skriva kommentarer (sparas i `agency_comments`),
- godkänna temat eller begära ändringar (status `approved` respektive `changes`),
- ladda ner underlaget via `/api/review/{token}/download`.

Vid vit etikett visas byråns namn i stället för ThemeFold.

---

## 16. Värvningsprogram

`src/lib/referrals.ts`, `src/lib/i18n/referral.ts`, `/{locale}/signup?ref=KOD`.

- Varje konto får en egen kod (`ensureReferralCode`), med tvetydiga tecken borttagna.
- Koden kan anges manuellt i registreringsformuläret eller följa med i länken, och
  valideras live mot `GET /api/referral/check` med grön eller röd hjälptext.
- **Den inbjudne** får extra provdagar direkt vid registrering.
- **Den som bjöd in** får gratisdagar först när den inbjudne faktiskt betalar
  (`qualifyReferral` anropas från betalflödet).
- **Tak:** antalet belöningar per konto är begränsat, och belöningar som nått taket
  markeras `capped`.
- Standardvärden: 7 bonusdagar till den inbjudne, 30 gratisdagar till den som bjöd in,
  max 3 belöningar. Alla tre kan ändras i adminpanelen under *Värvning*.

---

## 17. Prissättning, provperiod och betalning

`src/lib/billing.ts`, `src/lib/db.ts`, `src/app/api/billing/*`.

- **Provperiod:** 3 dagar som standard (`SITE_TRIAL_DAYS`, tillåtet intervall 1–90),
  förlängd med värvningsbonus.
- **Vattenmärke:** under provperioden får varje exporterat eller publicerat tema en
  låst ThemeFold-footer i sidfoten. Betalande konton får den inte, och utgångna konton
  kan inte bygga alls (`canBuild`). Se avsnitt 8.4.
- **Pris per språk** (belopp i minsta enhet i `LOCALE_META`):
  svenska 21 SEK, norska 22 NOK, danska 15 DKK, finska/franska/tyska/spanska 1,85 EUR,
  engelska 2 USD.
- **Stripe Checkout** skapas server-side med `price_data` i kundens valuta,
  `client_reference_id` och metadata med användar-id, och `success_url` pekar på
  `/api/billing/return`.
- **Returflödet** verifierar sessionen mot Stripe, aktiverar prenumerationen (30 dagar)
  och kvalificerar värvningen. Själva betalningsraden skrivs inte här.
- **Webhooken** (`/api/billing/webhook`) verifierar signaturen med HMAC-SHA256.
  `checkout.session.completed` aktiverar prenumerationen, `invoice.paid` registrerar
  fakturans belopp och valuta (en rad per faktura, även vid Stripes omförsök) och
  kvalificerar värvningen, och `customer.subscription.deleted` sätter planen till
  `canceled`. Fakturan är alltså den bokföringsmässiga händelsen, vilket gör att samma
  betalning inte kan bokföras både i returflödet och i webhooken.
- **Utan Stripe-nycklar** körs betalflödet i dev-läge: prenumerationen aktiveras,
  en betalningsrad skapas i användarens lokala valuta, värvningen kvalificeras och
  användaren skickas till prissidan med `?dev=1`. Det gör att hela kedjan – inklusive
  ekonomi, bokföring och värvning – går att testa lokalt.
- Det finns **ingen självbetjänings-uppsägning** i gränssnittet; uppsägning hanteras via
  Stripe och slår igenom via webhooken.

---

## 18. Adminpanelen

### 18.1 Inloggning med tvåfaktorskydd

`src/app/[locale]/admin/layout.tsx`, `src/components/admin/AdminLoginGate.tsx`,
`src/lib/admin/mfa.ts`, `src/lib/totp.ts`, `src/app/api/admin/mfa`.

- Administrationsytan har en **egen inloggning**: e-post och lösenord, därefter en kod
  från en autentiserare. Inloggningen sker på samma adress som panelen.
- **Första gången** visas en registrering: en hemlighet presenteras som läsbar nyckel,
  som otpauth-länk och som text att klistra in i Google Authenticator, 1Password, Authy
  eller Apple Lösenordshanterare. Därefter visas **åtta engångskoder** en enda gång.
- **TOTP** följer RFC 6238 med SHA-1, sex siffror och 30 sekunders steg, med ett stegs
  tolerans åt vardera hållet. Implementerat i egen kod utan externa beroenden.
- **Hemligheten krypteras** i databasen med AES-256-GCM via `src/lib/secret-box.ts`, och
  engångskoderna sparas bara som hash.
- **Spärrar:** fem felaktiga koder låser inloggningen i tio minuter; åtta felaktiga
  lösenord låser i femton minuter per e-postadress.
- **Sessionsflagga:** en session får en `mfa_at`-stämpel först när koden verifierats.
  Alla admin-API:er kräver en verifierad session, inte bara sidorna.
- **Återställning av faktorn** (vid ny telefon) tar bort MFA-posten och nollställer
  `mfa_at` för den aktuella sessionen, så att panelen direkt kräver en ny registrering
  i stället för att fortsätta lita på den gamla verifieringen.
- **Nödutgång:** `ADMIN_MFA_DISABLED=1` i miljön stänger av kravet så att ägaren kan
  registrera en ny autentiserare om telefonen och engångskoderna är borta. Det går inte
  att göra inifrån panelen.
- Allt loggas i granskningsloggen: `admin.login`, `mfa.enrol_start`, `mfa.enrolled`,
  `mfa.verified`, `mfa.failed`, `mfa.locked`, `mfa.recovery_used`, `mfa.reset`,
  `admin.password_changed`.

### 18.2 Roller och behörigheter

`src/lib/admin/permissions.ts`, `src/lib/admin/roles.ts`, `src/lib/staff.ts`.

- **Ägare** bestäms av `ADMIN_EMAILS` i miljön och har alltid alla behörigheter. Rollen
  kan inte skapas, ändras eller delas ut från panelen.
- **Inbyggda roller:** Ägare, Admin, Ekonomi, Support, Utvecklare. Administratören får
  allt utom att rotera API-nycklar och ändra systemflaggor.
- **Egna roller** kan skapas med valfri kombination av behörigheter och redigeras i
  panelen. Nya behörigheter läggs till i befintliga inbyggda roller vid uppstart.
- **17 behörigheter:** `overview.view`, `economy.view`, `economy.manage`, `users.view`,
  `users.manage`, `inbox.view`, `inbox.manage`, `staff.view`, `staff.manage`,
  `keys.view`, `keys.manage`, `projects.view`, `content.view`, `content.manage`,
  `system.view`, `system.manage`, `audit.view`.
- En person får bara dela ut roller vars behörigheter den själv har, och ingen kan
  ändra sin egen roll.

### 18.3 Panelerna

| Panel | Vad den gör |
| --- | --- |
| Översikt | Realtidsvy med temahealth, intäkter, konton, projekt, systemstatus, senaste analyser, nya konton, projekt och inkorg. Uppdateras automatiskt var 30:e sekund |
| Ekonomi | Intäkter per period, ARPU, betalande andel, konvertering, dagsserie, valutor, leverantörer, planer, senaste betalningar och värvningsstatistik. CSV-export |
| Bokföring | Se avsnitt 19 |
| Användare | Sök, kontodetaljer, byta plan, förlänga provperiod, sätta tillfälligt lösenord, koppla från Shopify, aktivera/inaktivera, tilldela personalroll och radera konto |
| Inkorg | Meddelanden från kontaktformuläret med status ny/klar, sökning, markering och radering |
| Personal | Bjuda in med e-post och roll, skapa ny inbjudningslänk, sätta status (inbjuden, aktiv, avstängd), se senast inne och ta bort |
| Roller | Skapa och redigera roller med behörighetsmatris |
| API-nycklar | Alla nycklar och inställningar grupperade i AI, Shopify, Inloggning, Betalningar, Sajt, Värvning och Bokföring. Hemliga värden skickas aldrig tillbaka till klienten |
| Projekt | Alla teman i systemet med ägare, status och hälsa; hämtar ner ett tema som zip |
| Innehåll | Se avsnitt 20 |
| System | Driftstatus: databasens storlek och antal rader, körmiljö (Node-version, miljö, `APP_URL`, drifttid), status för de nyckelfria gratisvägarna (Kilo, Pollinations), Gemini, OpenRouter, Shopify, Stripe, PageSpeed och inställningskryptot, personalräkning samt översikt över alla inställningar. Dessutom registreringsöppning, provperiod, supportadress, driftmeddelande och värvningsregler |
| Logg | Granskningslogg med aktör, åtgärd, mål, detaljer och tid, med sökning |

### 18.4 Granskningslogg

Alla ändringar i panelen skriver en rad i `admin_audit` via `src/lib/audit.ts`, och
loggen visas i egen panel med sökning på aktör, åtgärd och mål.

---

## 19. Bokföring och moms

`src/lib/accounting/*`, `/{locale}/admin/accounting`,
`GET /api/admin/economy/accounting`.

### 19.1 Filerna som kan laddas ner

| Format | Filändelse | Innehåll |
| --- | --- | --- |
| `sie4` | `.se` | SIE typ 4: kontoplan, ingående och utgående balans, resultatrader och samtliga verifikationer |
| `verifikat` | `.csv` | Verifikationslista med en rad per kontorad, debet och kredit |
| `moms` | `.csv` | Momsrapport per månad och ruta |
| `underlag` | `.csv` | Varje betalning med valuta, kurs, belopp i SEK, moms och Stripe-avgift, för avstämning |
| `json` | – | Samma rapport som panelen visar |

Panelen visar periodväljare (från/till samt genvägarna *denna månad*, *förra månaden*,
*i år*), nyckeltal och en momstabell med en kolumn per månad.

### 19.2 Hur beloppen räknas

- Betalningar läses ur `payments`. Endast rader med status `paid`, `refunded` eller
  `refund` bokförs; andra statusar (till exempel en skapad Stripe-session) hoppas över.
- Belopp räknas om till SEK med växelkursen i inställningarna (SEK är alltid 1).
- **Momssats per valuta** avgör om svensk moms tas ut. Är priset inklusive moms blir
  nettot `brutto / (1 + moms)` och momsen resten – vid 25 % alltså 20 % av bruttot
  (249 kr → 199,20 kr + 49,80 kr). Är priset exklusive moms beräknas momsen uppåt.
- **Försäljning** bokförs som debet på clearingkontot (fordran hos Stripe, standard
  1580), kredit på 3041 för svensk moms eller 3045 för försäljning utanför Sverige, och
  kredit på 2611 för utgående moms 25 %.
- **Återbetalning** bokförs som en motverifikation med omvända tecken.
- **Stripe-avgiften** beräknas ur inställd procentsats plus fast belopp och bokförs som
  inköp av tjänst från annat EU-land med omvänd skattskyldighet: debet 4535 och 2645,
  kredit 2614, och clearingkontot minskas med avgiften. Momsen tar då ut sig själv i
  ruta 21, 30 och 48.
- **Avrundning** sker till öre i varje steg, och bokföringen förs i två decimaler.

### 19.3 Momsrapportens rutor

Ruta 05 (skattepliktig försäljning 25 %), 10 (utgående moms 25 %), 20–24 (inköp),
21 (inköp av tjänster från annat EU-land – Stripe-avgifterna), 30 (utgående moms på
ruta 21), 39 (B2B-tjänster inom EU, alltid 0 i nuvarande dataunderlag),
40 (försäljning utanför Sverige), 48 (ingående moms att dra av) och 49 (moms att betala
eller få tillbaka).

Momsen på Stripe-avgiften är både utgående och ingående och påverkar därför inte ruta 49.

### 19.4 SIE-filen

- Rubriker: `#FLAGGA`, `#PROGRAM`, `#FORMAT PC8`, `#GEN`, `#SIETYP 4`, `#FNAMN`,
  `#ORGNR`, `#FADRAD`, `#RAR` följt av `#KONTO`, `#IB`, `#UB`, `#RES` och alla `#VER`
  med `#TRANS` inom måsvingar.
- **Serier:** `S` för försäljning och `B` för Stripe-avgifter, med löpnummer per serie.
- **Debet positivt och kredit negativt**, varje verifikation summerar till noll.
- **Räkenskapsåret** beräknas ur inställningen för räkenskapsårets start.
- Texten skrivs i **ren ASCII** (å, ä, ö translittereras) och filen deklareras som PC8,
  så den kan läsas även av äldre bokföringsprogram.

### 19.5 Inställningar för bokföringen

Under *API-nycklar → Bokföring*: företagsnamn, organisationsnummer,
momsregistreringsnummer, adress, räkenskapsårets start, priser inklusive/exklusive moms,
momssats i Sverige, moms per valuta, växelkurser till SEK, Stripe-avgift i procent,
Stripe fast avgift i kronor, om avgiften har omvänd skattskyldighet eller ingen moms,
samt bankkonto och konto för Stripe-saldo.

---

## 20. Innehållseditorn

`src/lib/content.ts`, `src/components/admin/ContentEditor.tsx`,
`/{locale}/admin/content`, `GET/POST /api/admin/content`.

- **All text på sajten** är redigerbar per språk: både gränssnittets texter och
  sajttexterna (juridik, kontakt, cookies, fot, varumärkesnotis). Editorn listar
  texterna grupperade per område, till exempel *Gränssnitt · Studio*,
  *Sajttexter · Villkor*.
- **Nycklar** är punktade sökvägar (`site.contact.title`, `hero.title`,
  `site.terms.sections.0.body`), och listor hanteras post för post.
- **Funktioner:** sökning på text eller nyckel, filter för *endast ändrade*, spara
  osparade ändringar i en klump, återställa ett enskilt fält, återställa hela språket
  och kopiera alla svenska ändringar till ett annat språk.
- **Ändringar ligger som överliggande lager** i `content_overrides`. Originaltexten i
  koden finns kvar som reserv, så nya texter i koden fungerar direkt och en tömd
  överskrivning återställer originalet. Sajten revalideras vid sparande och ändringen
  slår igenom direkt.
- Editorn öppnas på redaktörens eget språk och kräver behörigheten `content.view`
  (att redigera kräver `content.manage`).

---

## 21. Språk och lokalisering

- **Åtta språk:** svenska, norska, finska, danska, engelska, franska, tyska, spanska.
- **Språkval:** en sparad cookie vinner alltid, därefter landskoden från CDN-huvuden,
  därefter webbläsarens `Accept-Language`, annars svenska. Omdirigeringen görs av
  `src/middleware.ts` och av rotsidan `src/app/page.tsx`, och gäller endast `/`.
  Besökarens val sparas i cookien `temply_locale`.
- **Alla gränssnittstexter** ligger i `src/lib/i18n/` uppdelade per område: allmänt och
  studio (`en.ts`, `sv.ts` …), pro-läget, temahealth och insikter, layout och marknader,
  Brand DNA, **Advanced** (`advanced.ts`), byrå, integrationer, bokföring, värvning,
  social inloggning och juridiska sajttexter. Advanced-orden finns på alla åtta språk
  och saknade nycklar faller tillbaka på engelska.
- **Sajttexten** kan dessutom skrivas över per språk i innehållseditorn.
- **Lokala priser** visas i rätt valuta och med rätt format per språk.

---

## 22. Databas

24 tabeller skapas i `src/lib/db.ts`. Databasen är en fil i `.data/temply.db` med
WAL-läge och fem sekunders låstimeout, så flera processer kan läsa samtidigt.

| Tabell | Innehåll |
| --- | --- |
| `users` | Konto, lösenordshash, språk, provperiod, plan, Shopify-koppling, inaktivering, värvningskod och vem som bjöd in |
| `sessions` | Sessioner med utgångstid och tidpunkten för verifierad tvåfaktorskod |
| `mfa` | Krypterad TOTP-hemlighet, hashade engångskoder och bekräftelsetid |
| `projects` | Teman: namn, konfiguration som JSON, Shopify-temats id och publiceringstid |
| `project_versions` | Sparade versioner av ett tema med etikett |
| `payments` | Betalningar med leverantör, belopp, valuta, status och Stripe-session |
| `contact_messages` | Meddelanden från kontaktformuläret med hanterad-flagga |
| `referrals` | Värvningar med kod, status, bonus- och belöningsdagar |
| `staff` | Personal med roll, status, inbjudningstoken och senast inne |
| `staff_roles` | Roller med behörighetslista |
| `settings` | Krypterade inställningar och nycklar som överrider miljön |
| `content_overrides` | Redigerade sajttexter per språk och nyckel |
| `admin_audit` | Granskningslogg med aktör, åtgärd, mål och detaljer |
| `theme_health` | Sparade temahealth-rapporter per projekt |
| `stats_snapshots` | Sparade statistikuttag per projekt och källa |
| `ai_insights` | Sparade AI-insikter |
| `image_generations` | Äldre kvoträknare för bilder; används inte längre |
| `agencies` | Byrå med plan, varumärke, vit etikett och AI-användning |
| `agency_members` | Byråmedlemmar med roll och status |
| `agency_clients` | Byråns kunder |
| `agency_projects` | Koppling mellan byrå, projekt, kund och status |
| `agency_library` | Byråns bibliotek av tema-delar |
| `agency_reviews` | Granskningslänkar med token, kundnamn och status |
| `agency_comments` | Kommentarer i en granskning |

Konfigurationen för ett tema lagras som JSON i `projects.config` och normaliseras vid
läsning, så äldre projekt fungerar även när nya fält tillkommer. Nya projekt får
alltid `builder: { mode: "theme", canvas: emptyCanvas() }`; Advanced är alltså opt-in
och en canvas utan noder påverkar inte exporten. `isValidConfig()` avvisar okända
lägesvärden, fler än 60 sektioner och fler än 240 canvas-noder innan raden skrivs.

Bildgenereringen har ingen räknare alls längre – den är lokal och gratis. Den enda
räknaren som tidigare låg per användare i stället för per
projekt: `image_generations` har primärnyckel `(user_id, month)` och räknar bara
lyckade AI-bilder. Övriga tabeller är kopplade till projekt, byrå eller konto enligt
tabellen ovan.

---

## 23. API-referens

Alla rutter ligger under `src/app/api`. `GET/POST` märks per rutt; alla kräver inloggad
användare om inget annat anges. AI-rutter som genererar eller bygger (tema, copy, bild,
Advanced och `POST` för insikter) kräver dessutom aktiv åtkomst; rena
läsningar som `GET` för insikter gör det inte. Advanced svarar `402` när kontot är
utgånget.

### Publika rutter

| Rutt | Metod | Beskrivning |
| --- | --- | --- |
| `/api/contact` | POST | Kontaktformulär med honeypot och IP-broms; sparas i inkorgen |
| `/api/referral/check` | GET | Kontrollerar en värvningskod utan inloggning |

### Konton och session

| Rutt | Metod | Beskrivning |
| --- | --- | --- |
| `/api/auth/signup` | POST | Skapar konto, provperiod och tillämpar värvningskod |
| `/api/auth/login` | POST | E-post och lösenord |
| `/api/auth/logout` | POST | Avslutar sessionen |
| `/api/auth/shopify` | GET | Startar butiksinloggning |
| `/api/auth/social/{provider}` | GET | Startar Google- eller Facebook-inloggning |
| `/api/auth/social/{provider}/callback` | GET | Tar emot OAuth-svaret |
| `/api/staff/accept` | GET, POST | Läser och accepterar en personalinbjudan |

### Projekt, export och publicering

| Rutt | Metod | Beskrivning |
| --- | --- | --- |
| `/api/projects` | GET, POST | Listar och skapar teman |
| `/api/projects/{id}` | GET, PATCH, DELETE | Hämtar, sparar och raderar ett tema |
| `/api/projects/{id}/versions` | GET, POST | Listar versioner, sparar och återställer |
| `/api/projects/{id}/export` | GET | Zip med hela temat |
| `/api/projects/{id}/publish` | GET, POST | Listar butikens teman och publicerar |

### Studio-funktioner

| Rutt | Metod | Beskrivning |
| --- | --- | --- |
| `/api/ai/theme` | POST | Prompt till färdigt tema |
| `/api/ai/copy` | POST | Texter för hero, produkter, SEO, CTA, kampanj |
| `/api/ai/image` | POST | Bildgenerering |
| `/api/ai/advanced` | POST | Prompt till en Advanced-sektion |
| `/api/ai/nano-banana` | GET, POST | Genererar en gratis bild lokalt i varumärkets färger |
| `/api/ai/insights` | GET, POST | Läser och skapar AI-insikter |
| `/api/brand/extract` | POST | Snabb varumärkesanalys från webbplats, palett eller text |
| `/api/brand/dna` | POST | Komplett Brand DNA från en domän |
| `/api/health/audit` | GET, POST | Läser och kör temahealth |
| `/api/health/fix` | POST | Tillämpar automatiska fixar |
| `/api/analytics/shopify` | GET | Butiksstatistik |
| `/api/referral/check` | GET | Kontrollerar en värvningskod |

### Byrå och granskning

| Rutt | Metod | Beskrivning |
| --- | --- | --- |
| `/api/agency` | GET, PATCH | Arbetsytan och dess inställningar |
| `/api/agency/projects` | POST | Kopplar ett projekt till byrå och kund |
| `/api/agency/projects/{id}` | DELETE | Tar bort kopplingen |
| `/api/agency/members` | POST, PATCH, DELETE | Medlemmar |
| `/api/agency/library` | POST, DELETE | Biblioteksdelar |
| `/api/agency/reviews` | POST, PATCH | Skapar och uppdaterar granskningar |
| `/api/review/{token}` | GET, POST | Granskning: läsa, kommentera, godkänna, begära ändringar |
| `/api/review/{token}/download` | GET | Laddar ner underlaget |

### Betalning

| Rutt | Metod | Beskrivning |
| --- | --- | --- |
| `/api/billing/checkout` | POST | Skapar Stripe-session eller aktiverar i dev-läge |
| `/api/billing/return` | GET | Verifierar och aktiverar prenumerationen |
| `/api/billing/webhook` | POST | Signaturverifierad webhook |

### Shopify

| Rutt | Metod | Beskrivning |
| --- | --- | --- |
| `/api/shopify/install` | GET | Startar OAuth mot butiken |
| `/api/shopify/callback` | GET | Tar emot OAuth-svaret |

### Admin

| Rutt | Metod | Beskrivning |
| --- | --- | --- |
| `/api/admin/mfa` | GET, POST | Inloggning, registrering, verifiering, återställning och byte av lösenord |
| `/api/admin/overview` | GET | Panelens startsida |
| `/api/admin/economy` | GET | Ekonomirapport och CSV |
| `/api/admin/economy/accounting` | GET | Bokförings- och momsunderlag i fem format |
| `/api/admin/users` | GET, PATCH, DELETE | Användaradministration |
| `/api/admin/inbox` | GET, PATCH, DELETE | Inkorg |
| `/api/admin/staff` | GET, POST, PATCH, DELETE | Personal och inbjudningar |
| `/api/admin/roles` | GET, POST, PATCH, DELETE | Roller |
| `/api/admin/keys` | GET, POST | Nycklar och inställningar |
| `/api/admin/system` | GET, POST | Driftstatus och sajtregler |
| `/api/admin/projects` | GET | Alla teman |
| `/api/admin/projects/{id}/export` | GET | Hämtar ner ett tema som zip |
| `/api/admin/audit` | GET | Granskningslogg |
| `/api/admin/content` | GET, POST | Innehållseditorn |

---

## 24. Säkerhet

- **Lösenord:** scrypt med salt och konstanttidsjämförelse.
- **Sessioner:** slumpmässigt id, 30 dagars livstid, `httpOnly`-cookie, `sameSite=lax`,
  `secure` i produktion.
- **Behörigheter:** varje admin-API kontrollerar behörighet på serversidan, och
  adminpanelens API:er kräver dessutom verifierad tvåfaktorskod.
- **Tvåfaktorsskydd:** TOTP med krypterad hemlighet, hashade engångskoder, spärr vid
  upprepade fel och loggning av varje försök.
- **Hemligheter:** API-nycklar och inställningar krypteras med AES-256-GCM i
  `settings`-tabellen och överrider miljövariablerna. Hemliga värden skickas aldrig
  tillbaka till webbläsaren, och nycklar kan bara läsas som "satt/ej satt".
- **Stripe:** webhook-signaturer verifieras med HMAC-SHA256 och tidsfönster på fem
  minuter.
- **Shopify:** OAuth med state-cookie och HMAC-verifiering av callbacken.
- **Utgående hämtningar:** varumärkesanalysen blockerar privata IP-adresser och lokala
  domäner, respekterar `robots.txt` och normaliserar indata.
- **Kontaktformuläret** har en broms per IP-adress (ett meddelande per minut) och ett
dolt honeypot-fält som tyst avvisar robotar. Meddelandet sparas i databasen och
maxlängder klipps per fält.
- **Rubriker:** `poweredByHeader` är avstängt.
- **Loggning:** alla ändringar i panelen spåras med aktör, åtgärd, mål och detaljer.

---

## 25. Konfiguration

### 25.1 Miljövariabler

| Variabel | Krävs för | Standard |
| --- | --- | --- |
| `APP_URL` | Shopify OAuth och inbjudningar | – |
| `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` | Publicering och butiksinloggning | – |
| `SHOPIFY_SCOPES` | – | `read_themes,write_themes,read_reports` |
| `SHOPIFY_API_VERSION` | – | `2026-07` |
| `GOOGLE_CLIENT_ID/SECRET`, `FACEBOOK_CLIENT_ID/SECRET` | Social inloggning | – |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Riktiga betalningar | dev-läge utan |
| `FREE_AI_KEYLESS` | `1` = nyckelfria gratisvägarna Kilo och Pollinations används | `1` |
| `KILO_MODEL` | Kilo-modell; måste vara `kilo-auto/free` eller sluta på `:free` | `minimax/minimax-m3.1-flash:free` |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Valfri gratis reserv för AI-tema, texter och Brand DNA | `openrouter/free` |
| `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_MODEL` | Valfri gratisnivå för insikter, AI-copy och Advanced; `GOOGLE_API_KEY` är reserv | – respektive `gemini-3.8-flash` |
| `GEMINI_API_BASE` | Egen proxy | Googles API |
| `PAGESPEED_API_KEY` | Höjd kvot för hastighetsmätning | publik kvot |
| `ADMIN_EMAILS` | Ägare av adminpanelen (kommaseparerad) | – |
| `ADMIN_MFA_DISABLED` | Nödutgång som stänger av tvåfaktorskravet | av |
| `SETTINGS_SECRET` | Krypteringsnyckel för inställningar | faller tillbaka på `SHOPIFY_API_SECRET` |

### 25.2 Inställningar i panelen

Alla kan sättas i adminpanelen i stället för i miljön, och värden i databasen vinner över
miljön. Grupperna är:

- **AI & analys:** `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_API_BASE`,
  `GEMINI_MODEL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `PAGESPEED_API_KEY`
- **Shopify:** `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_SCOPES`,
  `SHOPIFY_API_VERSION`
- **Inloggning:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`,
  `FACEBOOK_CLIENT_SECRET`
- **Betalningar:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Sajt & drift:** `APP_URL`, `SITE_SIGNUPS`, `SITE_TRIAL_DAYS`, `SITE_SUPPORT_EMAIL`,
  `SITE_ANNOUNCEMENT`
- **Värvning:** `REFERRAL_ENABLED`, `REFERRAL_TRIAL_BONUS_DAYS`, `REFERRAL_REWARD_DAYS`,
  `REFERRAL_MAX_REWARDS`
- **Bokföring:** `ACCOUNTING_COMPANY_NAME`, `ACCOUNTING_ORG_NUMBER`,
  `ACCOUNTING_VAT_NUMBER`, `ACCOUNTING_ADDRESS`, `ACCOUNTING_FISCAL_START`,
  `ACCOUNTING_PRICES_INCL_VAT`, `ACCOUNTING_VAT_RATE`, `ACCOUNTING_VAT_BY_CURRENCY`,
  `ACCOUNTING_FX_RATES`, `ACCOUNTING_STRIPE_FEE_PERCENT`,
  `ACCOUNTING_STRIPE_FEE_FIXED_SEK`, `ACCOUNTING_STRIPE_VAT`,
  `ACCOUNTING_BANK_ACCOUNT`, `ACCOUNTING_CLEARING_ACCOUNT`

---

## 26. Drift och utveckling

```bash
npm install
npm run dev        # utvecklingsserver
npm run typecheck  # TypeScript utan emit
npm run build      # produktionsbygge
npm start          # kör produktionsbygget
```

- Databasen skapas automatiskt vid första anslutningen i `.data/temply.db`, inklusive
  tabeller, index och lätta migreringar för äldre databaser (till exempel kolumnerna
  `disabled`, `handled`, `referral_code`, `referred_by` och `mfa_at`).
- Administrationspanelen kräver att kontots adress finns i `ADMIN_EMAILS` eller att
  kontot har en aktiv personalroll; annars visas en förklarande skärm i stället för
  paneler.
- `scripts/count-dna.mjs` är ett litet hjälpskript för att räkna fält i Brand DNA.
- `scripts/audit-smoke.sh`, `audit-e2e.sh`, `audit-links.mjs`, `audit-admin.sh`,
  `audit-admin-extra.sh`, `audit-billing.sh`, `audit-agency.sh` och `audit-mfa.sh`
  är manuella granskningstest. De kräver en körande server (`BASE=…`) och rensar
  sina egna testkonton där det går. `audit-totp.mjs` räknar TOTP-koder åt MFA-testet.

---

## 27. Vad som inte finns i koden

Följande är medvetet inte påstått ovan och finns inte implementerat:

- **Ingen e-postutskick.** Inga beroenden eller anrop för e-post finns; kontaktformuläret
  sparar meddelandet i databasen och adminpanelen visar det i inkorgen.
- **Ingen självbetjänings-återställning av lösenord** och ingen e-postverifiering.
- **Ingen uppsägning av prenumeration i gränssnittet** – uppsägning sker via Stripe och
  registreras genom webhooken.
- **Ingen egen fakturering för byråplanerna.** Planen sätts i byråns inställningar och
  gränserna kontrolleras i API:erna; någon betalning för byråplanen finns inte kopplad.
- **Inga automatiska tester eller CI** i repot. `scripts/audit-*.sh` är manuella
  rök- och flödestest som körs mot en startad server (se avsnitt 26).
- **Ingen realtidssamarbete** i studion – sparande sker per användare mot databasen.
- **Stripe-avgiften beräknas** ur inställd procentsats och fast belopp, inte ur Stripes
  egna transaktionsavgifter.
- **Ingen avstämning av Stripe-utbetalningar** mot bankkonto i bokföringen.
- **Återbetalningar bokförs bara om de finns som rader** med status `refunded` eller
  `refund` i `payments`.
- **Ingen OSS-redovisning** och ingen automatisk momsberäkning per EU-land – momsen styrs
  av inställningen moms per valuta.
- **Canva-integrationen är manuell:** formatmallar, sparade designer, bild-URL:er och en
  brief – inget API-anrop och ingen automatisk synk mot Canva-kontot.
- **Advanced-canvasen byggs för startsidan.** Produkt-, kundvagn- och innehållsmallar
  exporteras fortfarande från det temastyrda flödet, så kassa och produktdata inte går
  sönder.
- **Vattenmärket syns inte i studiots förhandsvisning.** Det läggs bara i den
  exporterade layouten. Ett tema som redan publicerats under provperioden behåller
  märket tills det publiceras om, och den som redigerar temakoden direkt kan alltid ta
  bort sektionen – låsningen gäller Shopifys editor.
- **Bildgenereringen har ingen kvot** och är därför densamma för alla konton. Alla teman
  på samma konto delar samma tre bilder, och endast lyckade AI-bilder räknas.
- **Ingen bildlagringstjänst**; uppladdade bilder och AI-bilder sparas som URL eller
  data-URL i temats konfiguration.
- **Ingen broms eller spärr för inloggning på vanliga användarkonton** – spärrarna
  finns bara i adminpanelens inloggning, och kontaktformuläret har en enkel IP-broms.
- **Ingen backup- eller exportfunktion för databasen** i gränssnittet.

---

## 28. Nyckelmoduler i källkoden

| Område | Filer |
| --- | --- |
| Databas och scheman | `src/lib/db.ts` |
| Temamodell | `src/lib/theme/types.ts`, `presets.ts`, `prompt.ts`, `labels.ts`, `layout.ts`, `premium.ts` |
| Temaexport | `src/lib/export/theme.ts`, `advanced.ts`, `credit.ts`, `css.ts`, `sections.ts`, `sections2.ts`, `sections3.ts`, `icons.ts`, `integrations.ts`, `zip.ts` |
| Advanced | `src/lib/advanced/canvas.ts`, `prompt.ts`, `icons.ts`, `src/lib/ai/image.ts`, `src/app/api/ai/advanced`, `src/app/api/ai/nano-banana`, `src/components/studio/advanced/*` |
| Studio | `src/components/studio/Studio.tsx`, `panels.tsx`, `panels2.tsx`, `panels3.tsx`, `Inspector.tsx`, `InspectorExtra.tsx`, `controls.tsx` |
| Varumärke | `src/lib/brand/crawl.ts`, `extract.ts`, `dna.ts`, `kit.ts`, `styles.ts`, `logos.ts`, `image-tools.ts`, `ai-dna.ts` |
| Temahealth | `src/lib/health/audit.ts`, `fixes.ts`, `psi.ts`, `linkcheck.ts`, `types.ts` |
| Statistik | `src/lib/stats/index.ts`, `shopifyql.ts`, `demo.ts`, `types.ts` |
| AI | `src/lib/ai/gemini.ts`, `copy.ts`, `image.ts`, `insights.ts` |
| Byrå | `src/lib/agency.ts`, `agency-plans.ts`, `agency-server.ts` |
| Admin | `src/lib/admin/*`, `src/lib/admin.ts`, `src/components/admin/*` |
| Bokföring | `src/lib/accounting/config.ts`, `bookings.ts`, `export.ts` |
| Innehåll | `src/lib/content.ts`, `src/components/admin/ContentEditor.tsx` |
| Säkerhet | `src/lib/auth.ts`, `src/lib/secret-box.ts`, `src/lib/totp.ts`, `src/lib/admin/mfa.ts` |
| Integrationer | `src/lib/integrations/catalog.ts`, `src/components/studio/IntegrationsPanel.tsx` |
| Översättningar | `src/lib/i18n/*` |
