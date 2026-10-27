# Xfinder (arbetsnamn – byter namn före lansering)

Plattform för introverta och ensamma som vill ha socialt sällskap i sin egen takt.
Två delar:

1. **AI-social coach** – öva samtal, småprat, gränssättning och förbered verkliga möten.
2. **Marknadsplats** – boka en verifierad människa för **platoniskt** sällskap: fika,
   promenad, konsert, middag eller evenemang.

> **Positionering:** ingen dejtingapp, ingen escorttjänst, ingen sexuell tjänst och ingen
> fysisk intimitet. AI:n utger sig aldrig för att vara en människa och uppmuntrar alltid
> till verklig kontakt, inte till mer skärmtid.

---

## Status: steg 1 klart (databas, RLS och projektstruktur)

| Steg | Innehåll | Status |
|---|---|---|
| 1 | Datamodell, Supabase-schema, RLS och projektstruktur | ✅ klart |
| 2 | Auth och profiler (Supabase Auth, onboarding, uppstartsavgift 19 kr) | ⏳ |
| 3 | Kompanjonsprofiler (annons, foton, verifiering, sök och filter) | ⏳ |
| 4 | AI-coachen (textchatt, övningar, rollspel, dagsgräns, krisinformation) | ⏳ |
| 5 | Bokningsflöde med Stripe Checkout i testläge + escrow och avbokning | ⏳ |
| 6 | Adminpanel (godkänna kompanjörer, bokningar, återbetalningar, stänga av konton) | ⏳ |
| 7 | Svenska texter, tomma lägen och säkerhetsinformation på alla ytor | ⏳ |

Sidorna `/`, `/status`, `/ai`, `/kompanjor` och `/logga-in` finns och körs. `/status` visar
att databasen svarar, att tabellerna finns och vilka prisregler som gäller.

Databasen ligger i Supabase-projektet **xfinder** (ref `nutltfbbubszocukleef`, region
`eu-north-1`, Stockholm) och migreringarna i `supabase/migrations` är körda dit.

## Kom igång

```bash
npm install
cp .env.example .env.local   # fyll i Supabase-nycklarna
npm run dev                  # http://localhost:3000
```

Kontrollera sedan `http://localhost:3000/status` – där listas varje tabell och om den svarar.

```bash
npm run typecheck   # tsc --noEmit
npm test            # nodens inbyggda testkörare, prisreglerna
npm run verify:db   # end-to-end mot databasen: RLS, priser, escrow, AI-gräns
npm run build       # produktionsbygge
```

### Vad `npm run verify:db` kontrollerar

Skriptet skapar två tillfälliga konton, kör igenom reglerna och städar bort sig självt.
Det testar alltså inte vad appen "kommer ihåg" att göra, utan vad RLS, triggers och
check-villkor faktiskt upprätthåller:

1. Nytt konto får automatiskt en profil med rollen `customer`.
2. Anonyma besökare ser inga profiler.
3. En inloggad användare ser bara sin egen profil, ingen annans.
4. Rollen kan inte eskeleras till `admin` och uppstartsavgiften kan inte markeras som
   betald av användaren (felkod `42501`).
5. En kompanjör kan skapa utkast och skicka in för granskning, men inte publicera sig själv.
   En ofullständig annons kan inte godkännas (`23514`).
6. `quote_booking`: 300 kr/h i 90 minuter = 450 + 45 + 49 = **544 kr**.
7. Bokningen: klientens egna prisförsök skrivs över, escrow är inte släppt,
   samma kompanjör kan inte dubbelbokas (`23P01`), priset och statusen kan inte
   ändras i efterhand, och utomstående ser ingenting.
8. AI-coachen: räknaren pausar vid gränsen, klienten kan varken skriva AI-meddelanden
   direkt eller nollställa dagens räknare.

## Databasen

All SQL ligger i `supabase/migrations` och är källan till sanningen. Filerna är skrivna för
att kunna köras om utan att falla, så de går bra att klistra in i Supabase SQL Editor.

| Fil | Innehåll |
|---|---|
| `20261027120000_xfinder_schema.sql` | Enums och 13 tabeller med index, check-villkor och dubbelbokningsskydd |
| `20261027120100_xfinder_functions.sql` | Funktioner och triggers (pris, roller, escrow, chatt, AI-räknare) |
| `20261027120200_xfinder_rls.sql` | Row Level Security och policies för varje tabell |
| `20261027120300_xfinder_storage.sql` | Bucketar och åtkomstregler för bilder och verifiering |

### Tabeller

| Tabell | Roll |
|---|---|
| `profiles` | En rad per konto, `role` = `customer` / `companion` / `admin` |
| `companion_listings` | Kompanjörens annons: foton, presentation, intressen, timpris, tillgänglighet, **gränser** |
| `bookings` | Bokning med prislåsning, status och escrow-spårning |
| `conversations`, `messages` | Intern chatt, även före bokning |
| `ai_sessions`, `ai_messages`, `ai_usage_daily` | AI-coachens samtal, historik och dagliga räknare |
| `reviews` | Betyg från båda parter efter avslutad bokning |
| `reports`, `blocks` | Anmälan och blockering |
| `payments`, `stripe_events` | Betalningsliggare och idempotens för Stripe-webhooks |

### Så skyddas datan

* **RLS på allt.** En användare ser bara sina egna rader, plus godkända kompanjörens publika
  profildata. Admin har egen roll och kontrolleras av `public.is_admin()`.
* **Admin-rollen kan inte sättas av klienten.** `profiles.role` är skyddat av en trigger, och
  rollen sätts aldrig från signup-metadata.
* **Pengar och escrow kan inte ändras av en användare.** Triggers kontrollerar att priser,
  `funds_released_at` och Stripe-id:n bara ändras av servern.
* **Priset räknas fram i databasen.** Klienten skickar bara annons, längd, tid och aktivitet –
  `bookings_prepare` fyller i timpris, kompanjörens belopp, serviceavgift, engångsavgift och
  totalpris. `rpc quote_booking` ger samma siffror till bokningssidan.
* **Kompanjören kan inte godkänna sig själv.** Annonsens status, verifiering och betyg styrs av
  `protect_listing_columns`.
* **Ingen dubbelbokning.** Ett `EXCLUDE`-villkor gör att en kompanjör inte kan ha två aktiva
  bokningar samtidigt.
* **AI-gränsen kan inte kringgås.** `ai_messages` och `ai_usage_daily` har ingen skrivpolicy för
  klienten; servern räknar upp med `rpc consume_ai_message`.
* **Blockering stoppar chatten.** En trigger hindrar meddelanden mellan blockerade parter och
  flaggar (utan att stoppa) telefonnummer och e-postadresser i chatten.

### Prisregler

| Regel | Värde |
|---|---|
| Uppstartsavgift (spamfilter) | 19 kr, en gång per konto |
| Första bokningen | 49 kr, en gång per kund |
| Serviceavgift | 10 % av kompanjörens belopp för bokningen |
| Totalpris | kompanjörens belopp + serviceavgift + engångsavgift |

Alla belopp lagras i **hela kronor** som `integer`. Omräkning till öre (× 100) sker först i
Stripe-lagret. Reglerna finns både som `check`-villkor i SQL och som rena funktioner i
`src/lib/pricing.ts`, med test i `src/lib/pricing.test.ts` så att de inte kan glida isär.

## Projektstruktur

```
xfinder/
  supabase/migrations/     databasen (körs mot Supabase)
  src/
    app/                   App Router: /, /status, /ai, /kompanjor, /logga-in
    components/ui/         shadcn/ui-komponenter (knapp, kort, badge, alert, fält)
    components/            delade byggstenar (header, footer, tomma lägen)
    lib/
      constants.ts         svensk vokabulär: aktiviteter, intressen, städer, övningar
      safety.ts            krisinformation (112, 1177, vårdcentral) och detektering
      pricing.ts           prisreglerna som rena funktioner
      env.ts               miljövariabler med tydliga svenska fel
      migrations.ts        manifest över migreringarna
      types/database.ts    typer som speglar schemat
      supabase/            klienter: browser, server (cookies), service role, middleware
    middleware.ts          förnyar sessionen och skyddar inloggade ytor
```

## Beslut som redan är fattade

* **Uppstartsavgiften ligger inte framför AI-coachen.** 19 kr krävs för att kunna kontakta
  eller boka en kompanjör (spamfiltret gör nytta där), men coachen går att prova direkt efter
  registrering. Det ger en ärlig väg in och skyddar marknadsplatsen.
* **Fakturering i hela kronor** i databasen, öre först mot Stripe.
* **Kolumnskydd sker i triggers, inte med kolumnrättigheter**, eftersom admin annars skulle
  låsas ute från samma tabell.
* **Admin-mutationer går via service role i serverkod**, aldrig med nyckeln i webbläsaren.
* **En konversation per kund + kompanjör** (`unique (customer_id, companion_user_id)`), så att
  chatten före bokning och chatten efter bokning är samma tråd.
* **`pending`-bokningar går ut efter 15 minuter** (`pending_expires_at`) så att ett avbrutet
  Checkout-köp inte blockerar tiden.
* **`btree_gist`** används för dubbelbokningsskyddet.
* **Sluttiden lagras i `bookings.ends_at`** i stället för att räknas ut i indexvillkoret.
  `timestamptz + interval` är bara `STABLE` i Postgres och får inte stå i ett index, vilket
  `EXCLUDE`-villkoret är. Triggern sätter `ends_at`, villkoret jämför två kolumner.

## Nästa steg

Steg 2: Supabase Auth med e-postlänk, onboarding av profil (stad, intressen, språk,
komfortnivå, önskade aktiviteter) och uppstartsavgiften på 19 kr via Stripe Checkout.
