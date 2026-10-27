# Säkerhet

Allt i VibeForge utgår från en enda princip: **agenten får inte göra något du inte kan se och säga nej till.**

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
- Sponsorplatsen i chatten har ingen åtkomst till innehållet – den tar bara emot ett tal (antal prompter). Se
  [README](../README.md#sponsorplats-i-chatten).

## Om du vill granska själv

```bash
# Politiska regler och deras gränser
cat packages/agent-core/src/security/policy.ts

# Verktygens farlighetsklassning
grep -n "danger" packages/agent-core/src/tools/*.ts

# Testerna som låser beteendet
npx vitest run packages/agent-core/src/security packages/agent-core/src/tools
```
