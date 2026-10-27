---
name: nextjs-page
description: Bygger Next.js-sidor och route handlers enligt App Router.
tools:
  - read_file
  - create_file
  - edit_file
  - run_tests
triggers:
  - next
  - nextjs
  - route
  - sida
  - page
  - ssr
---

# Next.js-sida

## Arbetsflöde

1. Bestäm om sidan ska vara en server- eller klientkomponent. Standard: server.
2. Lägg filen i rätt segment: `app/<segment>/page.tsx`. Dynamiska segment: `[id]`.
3. Metadata sätts med `export const metadata`.
4. Datahämtning sker i serverkomponenten – inte i en `useEffect`.

## Regler

- `"use client"` endast när komponenten behöver state, event handlers eller webbläsar-API:er.
- Ingen hemlighet i klientkomponenter. Endast `NEXT_PUBLIC_*` får nå webbläsaren.
- Route handlers ligger i `app/api/<namn>/route.ts` och validerar sin indata.
- Använd `next/link` i stället för `<a>` för interna länkar.

## Checklista

- [ ] Sidan renderar utan hydration-varningar.
- [ ] Bygget går igenom (`npm run build`).
