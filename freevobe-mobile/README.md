# Freevobe Mobile

Fjärrkontrollen för **Freevobe Desktop**. Från telefonen följer du agentens körningar, svarar på
godkännanden innan en fil skrivs eller ett kommando körs, läser diffar och loggar och får en notis när
något väntar på dig – medan arbetet fortsätter på datorn.

Appen byggs med Expo (SDK 58), Expo Router och React Native och talar med skrivbordets HTTP-API över
ditt lokala nätverk. Utan en parad dator startar den i **demoläge** med en inbyggd mock, så att du kan
titta på hela flödet direkt.

## Vad appen kan

| Flik | Innehåll |
|---|---|
| **Missions** | Körningar med status, fas, steg, filändringar och modell. En mission som väntar på godkännande markeras tydligt. |
| **Chat** | Promptfält, strömmande svar, plan, verktygsanrop, inline-diff och testkort. Avbryt-knapp medan körningen pågår. |
| **Approvals** | Ett kort per åtgärd som kräver ditt svar: filändring med diff, terminalkommando, nätverksanrop. Godkänn eller avslå, och öppna kortet för hela diffen. Destruktiva och riskfyllda åtgärder ligger i en egen, avskild grupp som inte får godkännas i grupp. |
| **Logs** | Terminalutskrifter, kommandon och systemhändelser per mission. |
| **Settings** | Anslutna datorer, projekt, temaläge (mörkt/ljust/system), notisregler och demoläge. |

## Krav

- **Node 20+** och npm.
- **Freevobe Desktop** som kör på samma nätverk som telefonen (appen ansluter till `http://<dator>:4319`).
- En telefon med **Expo Go**, eller ett eget utvecklingsbygge (se nedan).
- Inget internet krävs: all trafik går mellan telefonen och datorn.

## Kom igång

```bash
npm install
npm start          # npx expo start – visar QR-kod för Expo Go
```

Övriga startkommandon:

```bash
npm run ios        # iOS-simulator
npm run android    # Android-emulator
npm run web        # webbläsaren, för snabb utveckling
```

Appen öppnar i demoläge när ingen dator är parad. Vill du se flödet utan en dator räcker det att köra
`npm run web` och skicka en prompt – mocken spelar upp plan, godkännande, diff, tester och avslut.

## Expo Go eller utvecklingsbygge?

Appen använder inga andra inbyggda moduler än sådana som följer med Expo Go: `expo-camera` för
QR-koden, `expo-secure-store` för parningskoden, `expo-clipboard` för att klistra in en kod och
`expo-notifications` för **lokala** notiser. Expo Go räcker alltså för att utveckla och för att få
notiser medan appen körs.

Två saker kräver ett eget bygge:

- **Pushnotiser när appen är helt stängd.** Remote-notiser togs bort från Expo Go på Android i och med
  SDK 53 ([Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)). v1 skickar
  därför bara lokala notiser; se `src/lib/notifications.ts`.
- **En app att installera på riktigt** (egen ikon, namn och signering).

Bygg ett utvecklingsbygge med EAS, se [Bygga med EAS](#bygga-med-eas).

## Parning med datorn

Öppna **Freevobe Desktop → Parning** och skanna QR-koden i appens onboarding. Går kameran inte att
använda kan du skriva in adress, port och parningskod för hand – appen tar också emot koden via
urklipp.

Appen accepterar tre format, allt för att kamera, urklipp och handskriven kod ska fungera:

```jsonc
// 1. JSON (det skrivbordet lägger i QR-koden)
{ "url": "http://192.168.1.20:4319", "token": "<minst 16 tecken>", "name": "studio-pc" }

// 2. Länk
freevobe://pair?url=http://192.168.1.20&port=4319&token=<...>&name=studio-pc

// 3. En rad för hand
192.168.1.20:4319 <token>
```

Regler: porten är valfri (standard **4319**) och parningskoden ska vara minst 16 tecken utan
blanksteg. Parningskoden sparas i nyckelringen via `expo-secure-store` (på webben, där SecureStore
saknas, i `localStorage` – endast för utveckling).

### Säkerhet i v1

Skrivbordet talar **HTTP**, så parningskoden går okrypterad över det lokala nätverket. Det är ett
medvetet val för v1 och appen är byggd därefter:

- Adresser **utanför** det lokala nätverket är blockerade – använd VPN eller en HTTPS-tunnel i stället.
- Adresser på det lokala nätverket kräver att du bekräftar att du litar på nätverket, och appen varnar
  innan du kopplar upp.
- `localhost` och `https://` går igenom utan varning.

Bedömningen ligger i `src/lib/pairing.ts` och är enhetstestad.

## Endpoints som Freevobe Desktop måste exponera

Alla anrop skickar parningskoden i huvudet `x-freevobe-token`. Appen skickar även det äldre
`x-vibeforge-token` med samma värde, så att den fungerar mot både dagens server och en omdöpt sådan.
Adaptern som översätter svaren ligger i `src/api/desktop.ts`; den är medvetet förlåtande – ett saknat
eller oväntat fält ska ge en tom vy, inte en krasch.

| Metod | Väg | Används till | Förväntat svar |
|---|---|---|---|
| `GET` | `/api/health` | Anslutningsstatus | `{ ok, name, protocol, port }` |
| `GET` | `/api/settings` | Aktiv modell i översikten | `{ defaultModel }` |
| `GET` | `/api/projects` | Projektväljaren | `[{ id, name, path, lastModel?, permissionMode }]` – `permissionMode` är `ask`, `auto-edit`, `auto-run` eller `full-auto` |
| `GET` | `/api/sessions?projectId=<id>` | Missionslistan | `[{ id, projectId, title, model, updatedAt, messageCount }]` |
| `GET` | `/api/sessions/:id/tasks` | Steg i en mission | `[{ id, sessionId, title, status }]` – status är `todo`, `doing`, `blocked` eller `done` |
| `GET` | `/api/sessions/:id/messages` | Chatt och loggar | `[{ id, role, content, createdAt, toolCalls? }]` – roll är `system`, `user`, `assistant` eller `tool`; ett verktygsanrop är `{ id, name, args }` |
| `GET` | `/api/runs` | Pågående körningar | `[{ runId, sessionId, projectId, startedAt, status }]` – status är `running` eller `finished` |
| `POST` | `/api/chat` | Starta en körning | Skickar `{ sessionId, prompt, model? }`, svarar `{ runId }` |
| `GET` | `/api/runs/:id/events` | Körningen live | `text/event-stream` där varje `data:`-rad är en händelse med `type` (se `src/api/types.ts`) |
| `POST` | `/api/runs/:id/abort` | Avbryt-knappen | `{ aborted: true }` |
| `GET` | `/api/approvals` | Godkännandelistan | `[{ id, runId, kind, title, detail, risk, reason, hardBlock, createdAt, path?, command?, cwd?, url?, args?, diff? }]` |
| `POST` | `/api/approvals/:id` | Godkänn eller avslå | Skickar `{ decision, answers?, rememberForSession? }` |
| `GET` | `/api/projects/:id/git/status` | Filändringar per mission | `{ branch, ahead?, behind?, files: [{ path, index, worktree, staged }] }` |

Händelsetyperna i strömmen – `status`, `plan`, `message`, `tool_call`, `approval_request`, `diff`,
`file_changed`, `terminal`, `tests`, `run_finished` – beskrivs i `src/api/types.ts`. Klienten tål att
en enstaka händelse är trasig: felet rapporteras och strömmen fortsätter.

## Utveckla

```bash
npm test           # enhetstester (vitest)
npm run typecheck  # tsc --noEmit
npm run lint       # expo lint
```

Testerna täcker den rena logiken – protokollmappning, mock-API:t, diffar, parning, notisregler och
händelsereducering. Skärmarna verifieras i stället genom att appen bundlas och körs, se
`vitest.config.mts`.

### Struktur

```
src/
  api/            protokoll (types.ts), klientgränssnitt (client.ts), live-adapter (http.ts),
                  översättning av skrivbordets svar (desktop.ts) och mock (mock.ts)
  app/            rutter – (tabs)/ för flikarna, mission/[id], approval/[id], onboarding, connect
  components/     UI-primitiver (ui.tsx), kort (cards.tsx), diffvy (diff-view.tsx)
  constants/      färger, typografi, mått
  hooks/          use-api.ts (React Query mot klienten), use-run-stream.ts (händelser in)
  lib/            diff, parning, notisregler, notiser, säker lagring, SSE-tolkning
  state/          Zustand-store: anslutningar, inställningar, körningen som strömmar in
```

Filen `src/api/index.ts` är enda stället där valet mellan mock och riktig dator görs.

## Bygga med EAS

`eas.json` har tre profiler:

| Profil | Används till |
|---|---|
| `development` | Utvecklingsbygge med `expo-dev-client` för telefon eller simulator (`android.buildType: apk`). |
| `preview` | Internt testbygge, installeras direkt på en Android-telefon (`apk`). |
| `production` | Släppbygge – `app-bundle` för Play, arkiv för App Store, versionsnummer höjs automatiskt. |

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile development   # utvecklingsbygge
npx eas-cli@latest build --profile preview       # internt testbygge
npx eas-cli@latest build --profile production    # släpp
npx eas-cli@latest submit --profile production   # skicka till butik
```

Projektet är ännu inte kopplat till ett EAS-projekt (`extra.eas.projectId` saknas i `app.json`), så
första bygget frågar om du vill skapa ett. `eas-cli` är inte en lokal beroende – kör det med `npx
eas-cli@latest`.

## Bygga APK i CI (och signering)

`.github/workflows/release.yml` bygger APK:n med `npx expo prebuild` + `gradlew assembleRelease` och
lägger den i releasen. Release-varianten signeras av
`plugins/with-android-release-signing.js` – en config-plugin, eftersom `expo prebuild` skapar
`android/` från grunden och alltid pekar release-varianten på debugnyckeln.

Pluginen läser `android/key.properties` (samma filnamn som React Native dokumenterar):

```properties
storeFile=app/upload-key.jks
storePassword=…
keyAlias=…
keyPassword=…
```

I CI skrivs filen och nyckellagret från hemligheterna `ANDROID_KEYSTORE_BASE64`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` och `ANDROID_KEY_PASSWORD`, och `apksigner`
kontrollerar efter bygget att APK:n inte är debug-signerad. Vill du bygga en signerad APK lokalt:
skapa nyckellagret med `keytool`, lägg `key.properties` i `android/` och kör sedan
`cd android && ./gradlew assembleRelease`. Saknas `key.properties` används debugnyckeln, så att
lokala byggen fungerar utan hemligheter. Se [Release](../vibeforge/docs/releasing.md#android-nyckellager).

## Felsökning

- **"Kunde inte nå datorn på …"** – Freevobe Desktop kör inte, telefonen är inte på samma nätverk,
  eller så tillåter datorns brandvägg inte port 4319.
- **"Datorn nekade parningen"** – koden har gått ut eller återkallats. Para ihop igen från skrivbordet.
- **Parningskoden hittas inte** – nyckeln kan inte läsas (t.ex. efter ominstallation). Para ihop igen;
  appen säger till i inställningarna.
- **Inga notiser** – kontrollera behörigheten på telefonen och att rätt reglage är på i inställningarna.
  På webbläsaren finns inga notiser alls; där hoppas de över.
- **Prova utan att röra datorn** – slå på Demoläge i inställningarna; då används mocken även när en
  dator är parad.
