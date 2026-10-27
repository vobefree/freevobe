---
name: database-migration
description: Skriver databasmigreringar som är säkra att köra och lätta att backa.
tools:
  - read_file
  - create_file
  - edit_file
  - run_terminal_command
triggers:
  - migration
  - migrering
  - schema
  - sql
  - databas
---

# Databasmigrering

## Arbetsflöde

1. Läs befintliga migreringar och följ projektets numrering och verktyg.
2. Skriv migreringen framåt, och en rollback om projektet stödjer det.
3. Kör mot en lokal databas först. Aldrig mot produktionsdata utan uttryckligt samtycke.
4. Verifiera att befintlig data fortfarande fungerar (läs något ur tabellen efter migreringen).

## Regler

- Nya kolumner är valfria eller har ett standardvärde – annars låser du tabellen.
- Radera aldrig data i samma migrering som du lägger till struktur.
- Indexera kolumner som frågas ofta, men lägg inte till index utan anledning.
- Ingen migrering ska köras automatiskt mot en databas du inte äger.

## Checklista

- [ ] Migreringen är körd lokalt och tabelldata är intakt.
- [ ] Rollback finns om projektet använder det.
- [ ] Migreringen är idempotent där det är möjligt.
