---
name: python-script
description: Skriver Python-skript och moduler med typer och felhantering.
tools:
  - read_file
  - create_file
  - edit_file
  - run_terminal_command
triggers:
  - python
  - py
  - script
  - pandas
  - argparse
---

# Python-skript

## Arbetsflöde

1. Kontrollera projektets stil: `pyproject.toml`, formaterare, typkontroll.
2. Skriv funktioner med typannoteringar och en `main()` som anropas via `if __name__ == "__main__":`.
3. Använd `argparse` för kommandoradsargument.
4. Lägg felhanteringen där felet kan uppstå och ge ett begripligt meddelande.

## Regler

- Inga `except:` utan undantagstyp.
- Använd `pathlib` i stället för strängsammansatta sökvägar.
- Skriv inte över användarens data utan att kontrollera först (och fråga om det är oklart).
- Tredjepartsberoenden läggs i `pyproject.toml`, aldrig installeras globalt.

## Checklista

- [ ] Skriptet kan köras med `python <fil> --help`.
- [ ] Inga tysta fel.
