# Temply

Bygg ett Shopify-tema i världsklass genom att peka, dra och skriva en mening.
Temply är en fristående Next.js-app: webbaserad studio + äkta Shopify-integration
(OAuth, tema-upload, publicering) + export av ett komplett, godkänt temapaket.

## Funktioner

- **Live-förhandsvisning** av en riktig butik (hero, produktgrid, berättelse, recensioner, FAQ, nyhetsbrev, footer).
- **Klicka-och-redigera direkt i förhandsvisningen** – rubriker, knappar, produktnamn, priser.
- **Form & storlek med drag** – dra i kortets hörn för radie, reglage för luft och textstorlek, A−/A+ för typografi.
- **Sektioner** – lägg till, döp om, dölj, duplicera, radering, sortering med mera.
- **Prompt till tema** – inbyggd svensk/engelsk designmotor (offline) som tolkar t.ex. "varm keramikbutik" till färg, typsnitt, form och innehåll. Text-AI använder gratisvägar: nyckelfria Kilo Gateway och Pollinations först, därefter Gemini gratisnivå och OpenRouter free om en nyckel finns. Ingen betalmodell kan nås.
- **8 språk** i hela gränssnittet: svenska, norska, finska, danska, engelska, franska, tyska, spanska – inklusive lokala priser.
- **Export** – laddar ner ett `.zip` med `layout/theme.liquid`, sektioner, snippets, templates, assets, config och 8 locale-filer. Filen kan laddas upp direkt i Shopify Admin → Online Store → Themes.
- **Publicering** – Shopify OAuth mot butiken, skapar/uppdaterar ett tema och publicerar det.
- **3 dagars gratis provperiod** med alla funktioner, därefter **2 USD/månad** (debiteras i lokal valuta: 21 kr, 22 NOK, 1,85 €, 15 DKK, $2 …).
- **Stripe-redo** – utan Stripe-nycklar kör betalflödet i dev-läge så hela kedjan kan testas.

## Kom igång

Krav: **Node 24+** (använder inbyggda `node:sqlite`).

```bash
cd temply
npm install
cp .env.example .env.local   # sätt APP_URL till samma port som du kör på
npm run dev                  # http://localhost:3000
```

Öppna `/{språk}` – t.ex. `/sv`, `/en`, `/de`. Skapa konto, beskriv din butik och
börja dra i förhandsvisningen.

> Kör du på en annan port (t.ex. `npm run dev -- --port 3100`) måste `APP_URL` i
> `.env.local` peka på samma adress, annars matchar inte Shopifys redirect-URL.

## Miljövariabler

| Variabel | Krävs | Beskrivning |
| --- | --- | --- |
| `APP_URL` | för Shopify OAuth | Publik basadress, t.ex. `https://temply.se`. Måste matcha redirect-URL i Shopify. |
| `SHOPIFY_API_KEY` | för publicering | Shopify Partners → App setup → Client ID. |
| `SHOPIFY_API_SECRET` | för publicering | Client secret. Används för HMAC-verifiering av OAuth. |
| `SHOPIFY_SCOPES` | nej | Standard `read_themes,write_themes`. |
| `SHOPIFY_API_VERSION` | nej | Standard `2026-07`. |
| `STRIPE_SECRET_KEY` | för riktiga betalningar | Utan denna körs dev-läge. |
| `STRIPE_WEBHOOK_SECRET` | för riktiga betalningar | Från `stripe listen` eller Dashboard → Webhooks. |
| `GEMINI_API_KEY` / `OPENROUTER_API_KEY` | nej | Gratisnivå för AI-teman och texter; annars används den inbyggda motorn. |

## Shopify-app

1. Skapa en app i [Shopify Partners](https://partners.shopify.com) → **App setup**.
2. Lägg till redirect-URL: `{APP_URL}/api/shopify/callback`.
3. Begär scope `read_themes,write_themes` (App URL kan vara samma som `APP_URL`).
4. Fyll i `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` och `APP_URL`.
5. Starta om, öppna ett projekt i studion → **Publicera** → ange `dinbutik` och godkänn.

Installationsflödet: `/api/shopify/install?shop=…` sätter state-cookie och skickar
till Shopifys godkännandesida. `/api/shopify/callback` verifierar HMAC + state,
byter kod mot access token och sparar butiken på användaren. Publicering sker via
Admin GraphQL (`themeCreate` / `themeFilesUpsert` / `themePublish`).

## Stripe

Checkout skapas server-side med `price_data` i kundens valuta (belopp i
`src/lib/i18n/index.ts` → `LOCALE_META.amountCents`). Efter lyckad betalning
aktiveras prenumerationen i `/api/billing/return`; webhooken
`/api/billing/webhook` hanterar `checkout.session.completed`,
`invoice.paid` och `customer.subscription.deleted`.

Lokalt:

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

## Databas

SQLite via `node:sqlite`, filen `.data/temply.db` (WAL). Tabeller: `users`
(provperiod, plan, Shopify-token), `sessions`, `projects` (temakonfiguration som
JSON), `payments`. Inget externt databasberoende behövs.

Provperioden är 3 dygn från registrering. När den löpt ut dirigeras byggflödet
till prissidan; inloggning och export av befintliga projekt är kvar.

## Temamodellen

`src/lib/theme/types.ts` beskriver hela temat: färgpalett, typografi, form
(radie, knappradie, kant, skugga), hero-layout, produktkort, sektioner och
innehåll. Presets och mood-motorn ligger i `presets.ts`, prompttolken i
`prompt.ts` och Liquid-genereringen i `src/lib/export/`.

Exporterat tema innehåller:

```
assets/theme.css, assets/theme.js
config/settings_schema.json, config/settings_data.json
layout/theme.liquid
locales/en.default.json + sv, nb, fi, da, fr, de, es
sections/*.liquid (header, footer, hero, product-grid, main-*, …)
snippets/product-card.liquid, snippets/icon.liquid
templates/index.json, product.json, collection.json, cart.json, page.json, 404.json, search.json, list-collections.json
```

## Skript

```bash
npm run dev        # utvecklingsserver
npm run typecheck  # TypeScript utan emit
npm run build      # produktionsbygge
npm start          # kör bygget
```
