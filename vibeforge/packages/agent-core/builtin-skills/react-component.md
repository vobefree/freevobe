---
name: react-component
description: Skapar och ändrar React-komponenter enligt projektets konventioner.
tools:
  - read_file
  - search_files
  - write_file
  - edit_file
  - run_tests
triggers:
  - react
  - component
  - komponent
  - ui
  - jsx
  - tsx
---

# React-komponent

## Arbetsflöde

1. Läs en befintlig, liknande komponent i projektet först. Följ dess mönster.
2. Kontrollera om projektet använder funktionskomponenter med `export function` eller `export const`.
3. Skriv komponenten i en egen fil med samma filnamnsstil som grannarna.
4. Lägg till eller uppdatera ett test om projektet har tester för komponenter.

## Kodstandard

- Typer på alla props. Ingen `any`.
- Ingen onödig state: härled i stället för att duplicera.
- Sidoeffekter i `useEffect` ska ha korrekt beroendelista.
- Tillgänglighet: `button` för klick, `aria-label` när texten inte räcker.
- Ingen inline-stil om projektet använder CSS-klasser eller Tailwind.

## Checklista före avslut

- [ ] Komponenten importeras och används på minst ett ställe, eller är avsiktligt fristående.
- [ ] Inga oanvända importer.
- [ ] Testet (om något) kör grönt.
