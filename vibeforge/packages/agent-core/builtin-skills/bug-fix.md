---
name: bug-fix
description: Felsöker systematiskt och rättar orsaken – inte symptomet.
tools:
  - read_file
  - search_files
  - edit_file
  - run_tests
  - git_diff
triggers:
  - bug
  - bugg
  - fel
  - krasch
  - crash
  - regression
  - fixa
---

# Buggfix

## Arbetsflöde

1. Reproducera: hitta kommandot, testet eller stegen som visar felet.
2. Läs den faktiska felutdatan. Gissa inte.
3. Formulera en hypotes om orsaken och kontrollera den innan du ändrar kod.
4. Skriv ett test som misslyckas av samma anledning (så att felet inte kan komma tillbaka).
5. Rätta orsaken. Minsta möjliga ändring.
6. Kör om testet, sedan hela sviten.

## Regler

- Rappa inte över fel med `try/catch` eller genom att hoppa över tester.
- Ändra inte ett test så att det slutar fånga buggen.
- Om orsaken ligger utanför uppgiften: beskriv den i stället för att bygga om systemet.

## Checklista

- [ ] Testet misslyckades innan fixen och passerar efter.
- [ ] Hela testsviten är grön.
- [ ] Commit-meddelandet förklarar varför, inte bara vad.
