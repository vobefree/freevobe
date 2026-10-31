# Freevobe – landing page

Marketing site for **Freevobe**, the local-first AI coding agent that vobes with Ollama.
Static, fast and dependency-light: no stock images, no tracking, no ad code (yet).

> **Vobe** *(verb)* – to build with Ollama through natural-language chat, locally and without
> token limits.

## Stack

| Del            | Val                                                                       |
| -------------- | ------------------------------------------------------------------------- |
| Ramverk        | Next.js 15 (App Router, React 19, TypeScript)                             |
| Styling        | Tailwind CSS v4 (`@theme`-tokens, mörkt tema som standard + ljust läge)    |
| Komponenter    | shadcn/ui-mönster (Radix + `cva` + `cn`) i `src/components/ui`            |
| Animationer    | Framer Motion (subtila fade-ins, `prefers-reduced-motion` respekteras)    |
| Ikoner         | Lucide                                                                    |

## Kom igång

```bash
npm install
npm run dev        # http://localhost:4300
npm run build      # produktionsbygge
npm run typecheck  # tsc --noEmit
```

## Struktur

```
src/
  app/
    layout.tsx          typsnitt, SEO-metadata, JSON-LD (SoftwareApplication), tema-bootstrap
    page.tsx            sektionerna i ordning
    globals.css         designtokens (mörkt/ljust), rutnät, glow, kodpaneler
    robots.ts           /robots.txt
    sitemap.ts          /sitemap.xml
    opengraph-image.tsx delningsbild som genereras vid bygget
    icon.svg            favicon
  components/
    site/               navbar (sticky + mobilmeny) och footer
    sections/           hero, social proof, problem→lösning, features, how it works,
                        skills, gives-back, privacy, FAQ, avslutande CTA
    ui/                 button, card, badge, accordion (shadcn-stil)
    motion/reveal.tsx   scroll-animationer
    sections/gives-back.tsx  Gives Back – välgörenhet i stället för annonser
    app-mockup.tsx      produktmockup byggd i HTML/CSS (chat, diff, terminal, tester)
  lib/
    site.ts             all text, länkar, nav och produktfakta på ett ställe
    gives-back.ts       katalogen med ändamål och de fyra principerna
    tokens.ts           delade ytklasser
    utils.ts            cn()
```

All copy lives in [`src/lib/site.ts`](src/lib/site.ts) – ändra produktnamn, nedladdningslänk eller
FAQ där i stället för att leta i komponenterna.

## Teman

Mörkt läge är standard (`#050505`–`#0a0a0a`, lila `#7C3AED`/`#8B5CF6` som accent och teal för
“lokalt/privat”). Ljust läge aktiveras genom klassen `light` på `<html>` och byts med knappen i
navbaren; valet sparas i `localStorage` och sätts före första målningen så att sidan inte blinkar.
Kod- och terminalpaneler är alltid mörka (som i en riktig editor) via `.vf-dark-surface`, så att
diff- och terminalfärger behåller kontrasten i båda lägena.

## Gives Back (inga annonser)

Sidan har **ingen annonskod** – ingen AdSense, inga annonsnätverk och inga spårningselement. Där
annonsplatsen låg finns i stället sektionen `#gives-back`, som förklarar principen och länkar
direkt till organisationernas egna sidor.

- Katalogen ligger i [`src/lib/gives-back.ts`](src/lib/gives-back.ts) och har samma id:n som
  skrivbordsappens katalog (`packages/protocol/src/gives-back.ts` i `freevobe-desktop/`).
- Inga pengar går genom sajten eller appen: ingen kassa, inget konto, ingen betalningsleverantör,
  ingen provision och inga spårningsparametrar i länkarna.
- `src/lib/gives-back.test.ts` låser att länkarna är https, att id:na är unika och att inget pekar
  på ett annonsnätverk.

Full beskrivning: [`freevobe-desktop/docs/gives-back.md`](../freevobe-desktop/docs/gives-back.md).

## Learn How to Vobe

Learn är en **egen app**, inte en sida på sajten: den byggs i `freevobe-learn/` till en enda
HTML-fil som laddas ner från releasen och spelas offline. Här på sajten finns bara en nedladdning
(under `/download/#learn`) – ingen `/learn/`-route, ingen spelkod i det här paketet.

Full beskrivning: [`freevobe-learn/docs/learn-how-to-vobe.md`](../freevobe-learn/docs/learn-how-to-vobe.md).

## Deploy

Sidan byggs som en **statisk export** (`output: 'export'` i `next.config.ts`), så den kan hostas på
vilken statisk värd som helst. Inget serverruntime behövs.

```bash
NEXT_PUBLIC_SITE_URL=https://din-adress.example npm run export   # -> out/
npm run deploy:prepare                                          # out/ -> deploy/public/
```

`NEXT_PUBLIC_SITE_URL` styr canonical, `og:image`, `sitemap.xml` och `robots.txt`. Utan den
används `https://freevobe.dev`.

`deploy/` innehåller det som ska publiceras:

| Fil                  | Roll                                                                    |
| -------------------- | ----------------------------------------------------------------------- |
| `manifest.json`      | publiceringsmanifest: worker-modul, compatibility date, assets-mapp     |
| `worker.js`          | serverar `ASSETS` och svarar med den riktiga 404-sidan                  |
| `public/`            | genererad export (HTML, `_next/`, `_headers`, og-bild, robots, sitemap) |
| `wrangler.toml`      | endast för lokal verifiering: `npx wrangler dev --config deploy/wrangler.toml` |

Cachening och content-type för den extensionslösa delningsbilden styrs deklarativt i
[`public/_headers`](public/_headers) – den hamnar automatiskt i exporten.

`deploy:prepare` stryker exportens RSC-payloads (`*/index.txt`) när den kopierar till
`deploy/public/`. Med tolv språk blir paketet annars strax över 10 MiB, vilket är taket hos värden
som tar emot `deploy/`. Sidorna blir identiska, men klick mellan dem gör en vanlig sidladdning i
stället för en klientnavigering. Bygger värden själv från `out/` – som Vercel gör – finns
payloadarna kvar.

### Nedladdningslänkar

Alla nedladdningslänkar kommer från [`src/config/release.ts`](src/config/release.ts) – ingen annan fil
hårdkodar dem:

```bash
NEXT_PUBLIC_RELEASE_REPO=agare/repo NEXT_PUBLIC_RELEASE_TAG=v1.2.3 npm run export
```

`RELEASE_REPO` (standard: `freevobe/freevobe`) styr repo, släppsida och API-anropet som hämtar senaste
versionen. `RELEASE_TAG` används bara för att bygga de förväntade filnamnen när GitHub-API:t inte kan
svara. `ASSET_FILE_NAMES` måste matcha filerna som CI laddar upp.

Sidan fungerar i tre lägen utan konfiguration: hittar API:t en release visas versionsnumret och rätt
installationsfil per plattform, svarar GitHub 404 (inga releaser ännu) visas **View releases** i stället
för en död fillänk, och om API:t inte kan nås visas "Latest release" utan versionsnummer.

Övriga redaktionella länkar: `site.discord`, `site.x` och `site.url` i `src/lib/site.ts`.
