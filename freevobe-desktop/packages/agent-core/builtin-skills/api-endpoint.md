---
name: api-endpoint
description: Lägger till eller ändrar en HTTP-endpoint med validering och felhantering.
tools:
  - read_file
  - search_files
  - create_file
  - edit_file
  - run_tests
triggers:
  - endpoint
  - api
  - route handler
  - rest
  - http
---

# API-endpoint

## Arbetsflöde

1. Hitta hur projektet redan svarar på fel och vilket svarsformat som används.
2. Validera all indata innan den används. Avvisa med 400 och ett tydligt felmeddelande.
3. Autentisera och auktorisera före allt annat om endpointen är skyddad.
4. Skriv ett test som täcker både lyckat svar och minst ett fel.

## Regler

- Aldrig lita på klientens id:n: härled ägarskap från sessionen.
- Inga hemligheter i loggar eller i svarskroppen.
- Statuskoder: 200/201 för lyckat, 400 för valideringsfel, 401/403 för behörighet, 404 för saknat, 500 för internt.
- Långsamma operationer dokumenteras med tidsgräns.

## Checklista

- [ ] Indata valideras.
- [ ] Felväg testad.
- [ ] Ingen hemlighet i svar eller logg.
