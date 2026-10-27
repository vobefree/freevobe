---
name: test-writing
description: Skriver tester som faktiskt fångar fel, i projektets testramverk.
tools:
  - read_file
  - create_file
  - edit_file
  - run_tests
triggers:
  - test
  - tester
  - vitest
  - jest
  - pytest
  - e2e
---

# Testskrivning

## Arbetsflöde

1. Läs ett befintligt test i projektet och använd samma struktur och hjälpare.
2. Testa beteende genom det publika gränssnittet, inte privata detaljer.
3. Täck den lyckliga vägen, ett felfall och ett gränsfall.
4. Kör testet och se det misslyckas om implementationen saknas.

## Regler

- Ett påstående per beteende; namnet ska beskriva beteendet, inte funktionen.
- Inga sömn- eller tidsberoenden utan kontrollerad klocka.
- Inga nätverksanrop i enhetstester – injicera i stället (VibeForge använder injicerade transporter).
- Mocka inte det du äger: använd riktig kod där det går.

## Checklista

- [ ] Testet har setts misslyckas och sedan passera.
- [ ] Inga hårdkodade tidszoner eller sökvägar.
