# Säkerhet

Allt i Freevobe utgår från en enda princip: **agenten får inte göra något du inte kan se och säga nej till.**

## Behörighetslägen

| Läge             | Filändringar                               | Kommandon         | Nätverk/webbläsare                |
| ---------------- | ------------------------------------------ | ----------------- | --------------------------------- |
| `ask` (standard) | Godkännande krävs                          | Godkännande krävs | Godkännande krävs                 |
| `auto-edit`      | Skrivs efter att diffen visats och loggats | Godkännande krävs | Godkännande krävs                 |
| `auto-run`       | Skrivs direkt                              | Körs direkt       | Godkännande krävs                 |
| `full-auto`      | Skrivs direkt                              | Körs direkt       | Godkännande krävs för nya domäner |

Behörighetsläget sparas per projekt, så ett experimentellt projekt kan köra `full-auto` medan ett känsligt kör `ask`.

## Vad som blockeras i alla lägen

Policyn (`packages/agent-core/src/security/policy.ts`) läser varje verktygsanrop och stoppar:

1. **Destruktiva kommandon** – `rm -rf`, `sudo`, `doas`, `pkexec`, `format`, `mkfs`, `diskpart`, överskrivning av
   enheter, `chmod 777 /`, `curl … | sh` och liknande.
2. **Skrivningar utanför projektroten** – sökvägar normaliseras och jämförs med projektets rot; `..` och absoluta
   sökvägar utanför roten avvisas.
3. **Borttagning av känsliga filer** – `.git`, hemlighetsfiler och allt utanför projektet.
4. **Portexponering och hemligheter ut** – kommandon som öppnar en lyssnande port mot omvärlden eller skickar
   miljövariabler vidare till externa tjänster.
5. **Webbläsaranrop utanför godkända adresser** och hämtningar som kräver en ny domän.

Blockeringen ger händelsen `error` med koden `policy_blocked` och ett begripligt meddelande till modellen, så att den
kan föreslå något annat i stället för att försöka igen.

## Diffar

- Varje `write_file`, `edit_file` och `delete_file` producerar en `FileDiff` med radnummer för både gammalt och nytt
  innehåll.
- I `ask` och `auto-edit` visas diffen i godkännandekortet _innan_ filen rörs.
- Efter körningen ligger alla diffar kvar i högerpanelen (max 40 per session).
- Diffen skickas också som händelse till gränssnittet, så inget skrivs "tyst".

## Godkännanden

- Godkännandekortet visar risk, orsak, kommando/sökväg, diff och eventuella frågor.
- `hardBlock` markerar åtgärder som kräver ett personligt ja även i `full-auto`.
- Beslut loggas i sessionen (`approvals_log`) så att du kan se i efterhand vad du sagt ja till.

## Data och integritet

- Ingen telemetri. `telemetry: false` och ingen kodväg skickar analysdata.
- Ingen inloggning, inget konto, ingen molnlagring.
- Endast `127.0.0.1` används; ändrande anrop från andra origins avvisas med 403.
- Webbläsarautomation, `web_fetch` och MCP-servrar kräver uttryckligt godkännande och visas med URL/kommando i
  godkännandet.
- Gives Back-platsen i chatten har ingen åtkomst till innehållet – den tar bara emot ett tal (antal prompter)
  och har ingen betalningsfunktion. Se [Gives Back](gives-back.md).

## Om du vill granska själv

```bash
# Politiska regler och deras gränser
cat packages/agent-core/src/security/policy.ts

# Verktygens farlighetsklassning
grep -n "danger" packages/agent-core/src/tools/*.ts

# Testerna som låser beteendet
npx vitest run packages/agent-core/src/security packages/agent-core/src/tools
```

## Importerade skills

- Skill-texten läggs i systemprompten som **data**, avgränsad med `<skill-data>` och en tydlig
  regel: en skill får beskriva arbetssätt men aldrig ändra grundprinciper, behörighetsläge eller
  användarens instruktioner.
- En skill som ber modellen ignorera regler, dölja något för användaren eller skicka data vidare
  ska modellen vägra följa och säga till.
- Alla verktygsanrop från en skill går genom samma policy och samma godkännanden som vanliga
  anrop. En skill kan inte skaffa sig utökade rättigheter.
- Varje aktivering loggas i `.freevobe/audit/skills.jsonl` med namn, källa, orsak och körning,
  och kan läsas via `GET /api/projects/:projectId/skills/audit`.

## Hemlighetsfiler

Agenten läser eller ändrar aldrig filer som ser ut att innehålla hemligheter: `.env`,
`.ssh/**`, `id_rsa`, `*.pem`, `*.key`, `.aws/credentials`, `.netrc`, `secrets.json` och liknande
(`packages/agent-core/src/security/sensitive.ts`). Det gäller alla verktyg, inte bara importerade
skills. `search_files` hoppar över dem och säger hur många som hoppades över. Mallar som
`.env.example` är tillåtna eftersom de inte innehåller några värden.

## Modeller

Innan en modell hämtas ska namn, storlek, källa och checksumma visas, och en hämtning kräver
alltid ett uttryckligt ja. Officiella modeller i Ollamas bibliotek märks som officiella;
allt under en egen namespace märks som tredjepart. Hjälpen för det ligger i
`packages/agent-core/src/models/provenance.ts` och används av hämtningsflödet i steg 6.
