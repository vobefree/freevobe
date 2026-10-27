---
name: code-review
description: Granskar en diff och hittar buggar, säkerhetsproblem, prestandaproblem och förbättringar.
tools:
  - git_diff
  - read_file
  - search_files
  - run_tests
triggers:
  - review
  - granska
  - granskning
  - code review
  - återkoppling
---

# Kodgranskning

## Arbetsflöde

1. Läs diffen i sin helhet innan du kommenterar något.
2. Leta systematiskt: säkerhet, felhantering, prestanda, läsbarhet, tester.
3. Verifiera varje påstående mot koden. Spekulera inte.
4. Sortera fynden efter allvar: kritisk, viktig, mindre.

## Vad du letar efter

- Injicering (SQL, skal, sökväg), osäker deserialisering, hemligheter i kod eller loggar.
- Saknad validering av indata, saknad felhantering, tysta fel.
- Kvadratisk algoritm där linjär räcker, onödiga nätverks- eller databasanrop i en loop.
- Bryter mot projektets regler i `.vibeforge/rules.md` eller `AGENTS.md`.
- Ändringar utan täckande test.

## Format på svaret

- Ett fynd per punkt: fil:rad, vad, varför det är ett problem, förslag.
- Lämna alltid en kort sammanfattning: hur många kritiska, viktiga och mindre.
