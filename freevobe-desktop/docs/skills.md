# Skills, regler och minne

## Skills

Ett skill är en Markdown-fil med YAML-frontmatter i projektet:

```markdown
---
name: react-component
description: Skapar React-komponenter enligt projektets konventioner
tools:
  - read_file
  - write_file
  - run_tests
triggers:
  - react
  - component
  - ui
---

# React-komponent

1. Läs två befintliga komponenter och följ deras mönster.
2. Skriv komponenten med tydliga typer och tillgängliga roller.
3. Lägg till ett test som beskriver beteendet.
4. Kör testerna och visa diffen.
```

- **Plats:** `.freevobe/skills/*.md` i projektet. De inbyggda originalen ligger i
  `packages/agent-core/builtin-skills/` och kopieras till projektet med knappen _Kopiera inbyggda_.
- **Aktivering:** en skill aktiveras när en trigger förekommer i prompten, eller när du skriver `@skillnamn`
  (`@refactoring städa upp diff-motorn`). Det som aktiveras injiceras i systemprompten för den körningen.
- **Verktygslista:** `tools:` beskriver vilka verktyg skillen förväntas använda. Det är dokumentation i första hand –
  policyn (behörighetsläget) gäller fortfarande för varje anrop.
- **Checklistor:** skriv dem som `- [ ]`-listor i Markdown. Agenten bockar av dem i sitt arbete och i uppgiftslistan.

### Medföljande skills

`react-component`, `nextjs-page`, `api-endpoint`, `python-script`, `bug-fix`, `test-writing`, `code-review`,
`refactoring`, `documentation`, `database-migration`.

### Importera och exportera

- **Exportera**: öppna Skills-dialogen, välj en skill och tryck _Exportera vald_ – hela Markdown-filen hamnar i urklipp.
- **Importera**: klistra in Markdown med frontmatter i textfältet och tryck _Importera till projektet_.
- Skillfiler är vanliga filer i ditt repo: granska dem i en pull request och versionshantera dem med git.

## Projektregler

Reglerna läses automatiskt och injiceras i systemprompten:

| Fil                           | Innehåll                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                   | Allmänna instruktioner för agenten i det här projektet.                                              |
| `.freevobe/rules.md`         | Projektspecifika regler: kodstil, testkommandon, gränser.                                            |
| `.freevobe/preferences.json` | Maskinläsbara inställningar: `permissionMode`, `contextBudgetChars`, `maxIterations`, `testCommand`. |

Exempel på `.freevobe/preferences.json`:

```json
{
  "permissionMode": "auto-edit",
  "contextBudgetChars": 32000,
  "maxIterations": 16,
  "testCommand": "npm test --workspace @freevobe/desktop"
}
```

## Projektminne

`.freevobe/memory.md` är projektets långtidsminne: arkitektur, tekniska val, kända buggar, testkommandon, kodstil och
dina egna preferenser. Filen läses vid varje körning, ligger i git och redigeras i Minne-dialogen.

Skriv kort och konkret. Ett bra minne svarar på frågan "vad skulle en ny utvecklare behöva veta i morgon?".

## Hooks

Hooks kör kommandon vid bestämda punkter och konfigureras i `.freevobe/hooks.json`. Filen innehåller en **lista** av
hooks (samma lista kan också ligga under nyckeln `hooks` i `.freevobe/preferences.json`):

```json
[
  {
    "name": "eslint",
    "event": "after_file_edit",
    "command": "npx eslint --fix ${FILE}",
    "filePattern": "**/*.{ts,tsx}",
    "blockOnFailure": false,
    "enabled": true,
    "timeoutMs": 60000
  },
  {
    "name": "tester",
    "event": "before_commit",
    "command": "npm test",
    "blockOnFailure": true,
    "enabled": true,
    "timeoutMs": 300000
  },
  {
    "name": "hemligheter",
    "event": "before_commit",
    "command": "grep -R \"sk-\" src || true",
    "blockOnFailure": true,
    "enabled": false,
    "timeoutMs": 30000
  }
]
```

Tillgängliga händelser: `on_session_start`, `before_file_edit`, `after_file_edit`, `before_terminal_command`,
`after_terminal_command`, `before_test_run`, `after_test_run`, `before_commit`, `after_commit`.

`blockOnFailure: true` stoppar åtgärden om kommandot ger ett annat resultat än 0 – bra för tester före commit och för att
blockera commits som innehåller API-nycklar.
