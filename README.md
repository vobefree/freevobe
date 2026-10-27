# Inklockning – Forshems Gästgiveri

Ett enkelt inklockningssystem för Forshems Gästgiveri: schema på timme, timlöner,
månadsrapporter med automatisk timräkning, utskriftsklar totalrapport – och egna inlogg
för anställda som checkar in och ut.

Byggt i Next.js (App Router) med ett minimalt backend (route handlers) och en libSQL/SQLite-databas.
Samma SQL fungerar med en lokal fil och med Turso på Vercel.

## Vad systemet kan

**Administration** (`/admin`)
- Lägga till, ändra och ta bort anställda – med användarnamn, PIN-kod och **timlön**.
- Schemalägga pass i månadskalendern (anställd, datum, start/slut, anteckning).
- Månadsrapport per anställd: alla arbetade dagar, incheckad/utcheckad, **timmar räknas ut automatiskt**
  och ersättning = timmar × timlön. Totalsumma för hela månaden.
- **Skriv ut total rapport** med alla arbetade dagar (`/admin/rapporter/utskrift`), klar för signering.

**Anställd** (`/min-sida`)
- Eget inlogg (användarnamn + PIN).
- Ser kommande pass från schemat.
- Checka in när man kommer, checka ut när man slutar – med live-timer.
- Ser egna arbetade dagar och timmar för månaden.

## Kom igång lokalt

```bash
npm install
npm run dev        # http://localhost:3000
```

`.env.local` (skapat i detta projekt) pekar på en lokal fil-databas `data.db` som skapas automatiskt.

**Admin-inlogg:** användarnamn och lösenord hämtas ur `.env.local` – standardvärdena är
`admin` / `forshem`. Byt dem innan systemet går i drift (sätt `ADMIN_USERNAME` och `ADMIN_PASSWORD`
innan första första besöket, kontot skapas vid första inloggningen).

## Deploya på Vercel

1. Skapa databas – Turso (gratisnivå räcker):

   ```bash
   npm i -g @tursodatabase/cli
   turso db create forshems
   turso db tokens create forshems
   ```

   Notera URL:en (`libsql://forshems-xxx.turso.io`) och token.

2. Importera projektmappen i Vercel (vercel.com/new – dra in mappen eller koppla repo:t).
   Projektnamnet bestämmer adressen: om du behåller namnet **forshems-gastgiveri** blir länken
   `https://forshems-gastgiveri.vercel.app`. Sätt miljövariabler i projektets Settings → Environment
   Variables **innan första deployen**:

   | Variabel | Värde |
   |---|---|
   | `DATABASE_URL` | `libsql://forshems-xxx.turso.io` |
   | `TURSO_AUTH_TOKEN` | tokenen från `turso db tokens create` |
   | `SESSION_SECRET` | slumpad sträng, t.ex. `openssl rand -hex 32` |
   | `ADMIN_USERNAME` | ditt administratörsnamn |
   | `ADMIN_PASSWORD` | ditt lösenord |
   | `APP_URL` | (valfritt) `https://forshems-gastgiveri.vercel.app` – QR-koden härleder adressen automatiskt om den saknas |

   Tabellerna skapas automatiskt vid första anropet och admin-kontot skapas av
   `ADMIN_USERNAME`/`ADMIN_PASSWORD` – ingen manuell steg kvar efter deployen.

   **Klar-checklista:** deploya → öppna länken → logga in som admin → lägg till en anställd →
   skanna QR-koden från `/admin/qrkod` med mobilen → checka in. PWA-install (Lägg till på
   hemskärmen) fungerar direkt eftersom Vercel levererar HTTPS.

3. **Namn i adressraden:** appen har alltid titeln/namnet *Forshems Gästgiveri*
   (fliknamn, PWA-namn, manifest). Själva adressen blir `forshems-gastgiveri.vercel.app`
   om projektmamnet är `forshems-gastgiveri`. Vill du att **adressraden ska visa Forshems namn
   i sin helhet** kopplar du en egen domän till Vercel (gratis, Domains i projektinställningarna),
   t.ex. `klocka.forshem.se` – då står det i adressraden.

## Struktur

```
src/
  app/                sidor (App Router, RSC)
    page.tsx          inloggning (centrerad; anställd som standard, admin via ?admin=1)
    min-sida/         anställds vy: pass, checka in/ut, egna timmar
    admin/            översikt, anställda, schema, rapporter (+ utskriftsvy), qrkod
  api/                minimalt backend (POST-route handlers)
    login, logout, clock
    admin/employees, admin/shifts (CRUD)
  server/             db, auth (scrypt + signerad session), rapporter, tidsformatering
  components/         logotyprad, knappar, flash-meddelanden, klockor
public/logo.png       logotypen från forshem.se
```

## Så räknas timmarna ut

Varje in- och utcheckning sparas som en post (`time_entries`) med lokalt datum och klockslag i
svensk tid. Rapporten summerar `(utcheckning − incheckning)` per dag och månad, avrundar till
två decimaler och multiplicerar med den anställdas timlön. Inklockningar som saknar utcheckning
visas som *Pågår* och räknas inte förrän den anställda checkat ut.
