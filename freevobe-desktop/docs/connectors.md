# Connectors

En connector är en frivillig brygga mellan Freevobe och en tjänst du redan använder – GitHub, Vercel,
Supabase och några till. Utan connectors är Freevobe precis som förut: helt lokalt, utan konton och utan
nätverksanrop. Ingenting ansluts av sig självt.

## Integritetsprinciperna

- **Local-first.** Koden stannar på din maskin. En connector gör inget förrän du ansluter den och verktygen
  aktiveras.
- **Least privilege.** Varje connector listar exakt vilka behörigheter den begär, och du ser listan _innan_
  du klistrar in något. Ingen connector frågar efter bredare åtkomst än den behöver.
- **Preview före produktion.** Deploy går till en preview-URL först. Produktion kräver ett separat ja.
- **Secrets never in chat.** En token hamnar aldrig i prompten, i modellens kontext, i loggen eller i
  databasen. Servern lämnar bara ut en maskerad ledtråd (`ghp_ab…1234`).
- **Every action logged.** Verktygsanrop från connectors går genom samma godkännande- och loggflöde som
  resten av agenten och syns i högerpanelens logg.
- **Easy revoke.** _Koppla bort_ raderar token från datorn och visar vilka behörigheter som därmed inte
  längre används. Vill du ogiltigförklara den helt återkallar du den även hos leverantören.
- **No silent data sharing.** Telemetri är avstängd och annonsplatsen skickar aldrig kod eller prompter.

## Så fungerar läget

Token är **global för maskinen** (en GitHub-token gäller alla projekt), medan **valet att använda connectorn
är per projekt**. Ett projekt kan alltså köra med Vercel medan ett annat är helt lokalt – utan att du
klistrar in samma token två gånger.

Statusen räknas fram i stället för att lagras:

| Token finns | Aktiv i projektet | Status                                                 |
| ----------- | ----------------- | ------------------------------------------------------ |
| nej         | –                 | `disconnected` (eller `error` om ett fel registrerats) |
| ja          | ja                | `connected`                                            |
| ja          | nej               | `disconnected`                                         |

`git` är inbyggd: den kräver ingen nyckel och är alltid `connected`.

## Katalogen

| Connector    | Auth                      | Status                            |
| ------------ | ------------------------- | --------------------------------- |
| `git`        | lokal (inbyggd)           | klar                              |
| `github`     | OAuth, token som fallback | arkitektur klar, verktyg i steg 4 |
| `vercel`     | token                     | klar (11 verktyg)                 |
| `supabase`   | token                     | arkitektur klar, verktyg i steg 3 |
| `netlify`    | OAuth                     | _kommer snart_                    |
| `railway`    | token                     | _kommer snart_                    |
| `stripe`     | API-nyckel                | _kommer snart_ (endast läsning)   |
| `resend`     | API-nyckel                | _kommer snart_                    |
| `cloudflare` | API-nyckel                | _kommer snart_                    |
| `neon`       | API-nyckel                | _kommer snart_                    |

Verktygen ligger i katalogen från början, märkta `implemented: false` tills steget som inför dem är klart.
Gränssnittet visar då _planerade_ verktyg i stället för att låtsas att de fungerar.

## Vercel

Vercel-connectorn ger elva verktyg. De registreras hos agenten **bara** när connectorn är påslagen i projektet
_och_ en token finns i valvet – annars beter sig agenten som om verktygen inte fanns.

| Verktyg                      | Gör                                           | Godkännande          |
| ---------------------------- | --------------------------------------------- | -------------------- |
| `vercel_list_projects`       | listar kontots/teamets projekt                | frågar (auto i läge) |
| `vercel_get_project`         | projektets ramverk, git-länk, produktionsgren | frågar (auto i läge) |
| `vercel_create_project`      | skapar ett tomt projekt                       | alltid               |
| `vercel_deploy`              | deploy från git-repot, preview som standard   | alltid + extra ja    |
| `vercel_get_deployments`     | senaste deploymenterna med status             | frågar (auto i läge) |
| `vercel_get_deployment_logs` | byggloggar som text                           | frågar (auto i läge) |
| `vercel_get_env_vars`        | nycklar, miljöer och typ – aldrig värden      | frågar (auto i läge) |
| `vercel_set_env_var`         | sätter/uppdaterar en miljövariabel            | alltid               |
| `vercel_delete_env_var`      | raderar en miljövariabel                      | alltid + extra ja    |
| `vercel_get_domains`         | projektets domäner och verifieringsstatus     | frågar (auto i läge) |
| `vercel_add_domain`          | kopplar en domän till projektet               | alltid               |

### Preview före produktion

`vercel_deploy` deployar med `target: preview` om inget annat anges. Sätts `target: "production"` ställer
verktyget **en andra fråga**, efter det vanliga godkännandet, med projekt, git-ref och en varning om att alla
domäner pekar om. Nekas det steget skapas ingen deployment alls. Policyn kräver dessutom alltid ett personligt ja
för connectorverktyg som ändrar något – även i **Full auto** – eftersom ändringen sker i en extern tjänst.

Flödet blir därför: bygg och verifiera lokalt (`run_tests`/`run_verification`) → deploy till preview → granska
preview-URL:en → deploy till produktion med det extra godkännandet. Efter varje deploy returnerar verktyget
preview-URL, status och `deploymentId`; `vercel_get_deployment_logs` visar vad bygget gjorde.

Deployen skapas från projektets **git-länk i Vercel** (repo + ref). Inga filer lämnar datorn, och ett projekt utan
kopplat repo får ett tydligt fel i stället för ett halvt bygge.

### Miljövariabler utan hemligheter i chatten

`vercel_get_env_vars` hämtar aldrig värden (ingen `decrypt`), bara nycklar och miljöer. `vercel_set_env_var` tar
antingen ett vanligt värde (`value`) eller en **fil i projektet** (`valueFromFile`, t.ex. `.env.local` – då läses
raden `KEY=...`). Värdet skickas direkt till Vercel och skrivs aldrig i verktygssvaret. Sökvägar utanför
projektroten avvisas.

### När något går fel

Ett API-fel blir ett läsbart verktygssvar utan token, och felet registreras på connector-kortet
(`state.lastError`). Så syns en utgången token eller en saknad behörighet utan att agenten fastnar.

`vercel_deploy` kräver att token har `deployments:write` och att projektet är kopplat till ett repo. Team-resurser
kan kräva att token skapas för teamet i Vercel.

## Var hemligheterna ligger

```
~/.freevobe/connectors.vault.json   AES-256-GCM, en post per connector (rättighet 0600)
~/.freevobe/connectors.key          32 slumpade byte, rättighet 0600
```

Filerna ligger utanför projektet, utanför git och utanför databasen. Butiken skriver atomiskt (temp-fil +
rename) och läser aldrig tillbaka en token till något annat än den connector som ska använda den.

Två kända begränsningar i det här steget, medvetet redovisade:

1. **Ingen OS-keychain ännu.** Nyckeln är en lokal fil som bara du kan läsa. Nästa härdning är att binda den
   till macOS Keychain, Windows Credential Manager eller libsecret – gränssnittet
   (`get`/`set`/`delete`/`hint`/`info`) är medvetet litet så att bytet bara rör en fil.
2. **Ingen API-verifiering vid anslutning.** Anslutningen sparas och krypteras direkt; token prövas först när ett
   connectorverktyg körs, och felet rapporteras då tillbaka till kortet. Att verifiera direkt vid anslutning
   (med tydligt svar innan man lämnar inställningarna) är nästa steg.

Försvinner nyckelfilen men valvet finns kvar vägrar butiken läsa i stället för att tysta misslyckas: då
återansluter du dina connectors.

## API

| Metod    | Väg                                                        | Gör                                                              |
| -------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| `GET`    | `/api/projects/:projectId/connectors`                      | katalog + status + lagringsinformation                           |
| `POST`   | `/api/projects/:projectId/connectors/:connectorId/connect` | ansluter med `secret` och valfritt `accountLabel`                |
| `PATCH`  | `/api/projects/:projectId/connectors/:connectorId`         | `{ enabled: boolean }` – på/av i projektet                       |
| `DELETE` | `/api/projects/:projectId/connectors/:connectorId`         | kopplar bort, raderar token, returnerar återkallade behörigheter |

Alla svar innehåller bara `ConnectorView`-objekt: definition (id, ikon, auth-typ, scopes, verktyg) och
tillstånd (status, aktiv, maskerad ledtråd, kontonamn, senaste fel). Ingen token, någonsin.

Etiketter och beskrivningar bor i locale-filerna i gränssnittet (`connectors.<id>.name`,
`connectors.scope.<id>`), så att servern aldrig behöver skicka språkberoende text.

## Egen connector via MCP

Saknas din tjänst? Koppla in vilken MCP-server som helst i stället – dess verktyg dyker upp som vanliga
agentverktyg. Se [MCP](mcp.md). Connectors-kortet i inställningarna har en genväg dit.

## Testning

```bash
npx vitest run packages/agent-core/src/connectors     # katalog, valv, tjänst, Vercel-klient och -verktyg
npx vitest run packages/agent-server/src/connectors.test.ts
npx vitest run apps/desktop/src/components/ConnectorsSection.test.tsx
```

Vercel-testerna använder en fejkad `fetch` och rör aldrig nätet. De kontrollerar bland annat att token bara går i
`Authorization`-headern, att ett API-fel inte läcker token, att produktion kräver ett extra ja (och att ingen
deployment skapas när det nekas), samt att ett env-värde från fil skickas till Vercel men inte syns i svaret.

Testerna kontrollerar bland annat att en token inte går att hitta i valvfilen, att rättigheterna är 0600, att
ett projekt kan stänga av en connector utan att röra de andra, och att ett API-svar aldrig innehåller själva
token.
