---
name: refactoring
description: Refaktorerar utan att ändra beteende, i små verifierbara steg.
tools:
  - read_file
  - search_files
  - edit_file
  - run_tests
  - git_diff
triggers:
  - refactor
  - refaktorera
  - städa
  - struktur
  - clean up
---

# Refaktorering

## Arbetsflöde

1. Se till att det finns tester som beskriver nuvarande beteende. Saknas de: skriv dem först.
2. Refaktorera i små steg och kör testerna mellan varje steg.
3. Ändra inte beteende och struktur i samma steg.
4. Avsluta med en grön testsvit och en läsbar diff.

## Regler

- Lägg inte in nya funktioner samtidigt som du städar.
- Flytta kod hellre än att kopiera den.
- Bryt ut en fil när den gör flera saker eller överstiger ungefär 400 rader.
- Behåll publika gränssnitt om inget annat beslutats.

## Checklista

- [ ] Beteendet är oförändrat (testerna bevisar det).
- [ ] Inga oanvända exporter kvar.
- [ ] Diffen är läsbar för en granskare.
