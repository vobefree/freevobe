# Release

Målet är installerare för Windows, macOS och Linux. Signeringen slås på med hemligheter (se
[Signering](#signering)) och automatisk uppdatering **är avstängd tills du konfigurerat den**.

## Förberedelser

```bash
npm install
npm run icons          # genererar apps/desktop/src-tauri/icons (PNG, ICO, ICNS)
npm run verify         # typecheck + lint + tester
npm run test:e2e       # valfritt men rekommenderat före release
```

Krav för att bygga skalet: Rust (stable) och Tauri-beroendena för din plattform. På Linux:

```bash
sudo apt-get install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

## Bygg lokalt

Agenten paketeras först – utan den startar den installerade appen ingen backend:

```bash
npm run sidecar:build                          # agentbinär + inbyggda skills till paketet
npm run tauri build -- --bundles nsis          # Windows .exe
npm run tauri build -- --bundles dmg           # macOS .dmg
npm run tauri build -- --bundles appimage,deb  # Linux
```

Artefakterna hamnar i `apps/desktop/src-tauri/target/release/bundle/` och får namn efter
`productName` och `version` i `tauri.conf.json` (t.ex. `Freevobe_0.1.0_x64-setup.exe`).

## Bygg i CI

`.github/workflows/release.yml` bygger Windows, macOS och Linux när du pushar en tagg `v*` och
publicerar filerna i releasen för taggen. Taggen måste matcha `version` i `tauri.conf.json` – annars
avbryter workflowen med ett förklarande fel. Signeringen ligger i workflowen och är avstängd så
länge hemligheterna inte finns (se [Signering](#signering)).

Filerna döps om till exakt de namn nedladdningssidan letar efter:

| Plattform             | Filnamn                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| Windows               | `Freevobe_v0.1.0_x64-setup.exe`                                         |
| macOS (Apple Silicon) | `Freevobe_v0.1.0_aarch64.dmg`                                           |
| macOS (Intel)         | `Freevobe_v0.1.0_x64.dmg`                                               |
| Linux                 | `Freevobe_v0.1.0_amd64.AppImage`                                        |
| Android (mobilappen)  | `Freevobe-Mobile_1.0.0.apk` (appen egen version ur `app.json`)          |
| Alla filer            | `SHA256SUMS.txt` – kontrollsummor, se [Kontrollsummor](#kontrollsummor) |

Ändrar du namnen i workflowen måste `ASSET_FILE_NAMES` i `freevobe/src/config/release.ts` ändras
ochå – annars hittas filerna bara via GitHub-API:t, inte via den förväntade adressen.

Intel-dmg:n kräver en Intel-runner (`macos-15-intel`): sidobinären paketeras med Node:s SEA på
byggmaskinens arkitektur, så en arm64-runner kan inte producera en agent-binär som körs på Intel.
Jobbet kör i samma workflow men med `continue-on-error`, så en indragen runner bara stryker den
filen i stället för att stoppa resten av releasen. Redan publicerad release utan Intel-fil? Kör
workflowen `macOS Intel (.dmg)` manuellt med taggen som indata – då byggs bara den filen.

Android-appen byggs i samma workflow med Gradle (`expo prebuild` + `assembleRelease`) och kräver
inget EAS-konto. Signeringen sköts av ett eget nyckellager via en config-plugin – se
[Android](#android-nyckellager).

```bash
git tag v0.2.0
git push origin v0.2.0
```

## Signering

Signeringen ligger i `.github/workflows/release.yml` och `macos-intel.yml` och slås på med
hemligheter – inga kodändringar behövs. Är hemligheterna inte satta går bygget igenom ändå, men
filen blir osignerad och operativsystemet varnar vid installation; workflowen skriver då en varning i
körningen. Hemligheterna sätts under **Settings → Secrets and variables → Actions**.

| Hemlighet                                                      | Platform | Innehåll                                                                             |
| -------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `WINDOWS_CERTIFICATE`                                          | Windows  | Authenticode-certifikatet som `.pfx`, base64-kodat                                   |
| `WINDOWS_CERTIFICATE_PASSWORD`                                 | Windows  | Lösenordet för `.pfx`-filen                                                          |
| `APPLE_CERTIFICATE`                                            | macOS    | _Developer ID Application_-certifikatet som `.p12`, base64-kodat                     |
| `APPLE_CERTIFICATE_PASSWORD`                                   | macOS    | Lösenordet för `.p12`-filen                                                          |
| `APPLE_SIGNING_IDENTITY`                                       | macOS    | Certifikatets namn, t.ex. `Developer ID Application: Ditt AB (TEAMID)`               |
| `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`                  | macOS    | Apple-ID, app-specifikt lösenord och team-ID för notariseringen                      |
| `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_P8_BASE64` | macOS    | App Store Connect-nyckel (nyckel-ID, issuer-ID, `.p8` base64) i stället för Apple-ID |
| `ANDROID_KEYSTORE_BASE64`                                      | Android  | Nyckellagret (`.jks`) base64-kodat                                                   |
| `ANDROID_KEYSTORE_PASSWORD`                                    | Android  | Lösenordet för nyckellagret                                                          |
| `ANDROID_KEY_ALIAS`                                            | Android  | Aliaset för nyckeln i lagret                                                         |
| `ANDROID_KEY_PASSWORD`                                         | Android  | Lösenordet för nyckeln                                                               |

Koda filerna så här:

```bash
base64 -w0 certifikat.pfx             # WINDOWS_CERTIFICATE (macOS/Linux; base64 -i på macOS)
base64 -w0 developer-id.p12           # APPLE_CERTIFICATE
base64 -w0 upload-key.jks             # ANDROID_KEYSTORE_BASE64
base64 -w0 AuthKey_XXXXXXXXXX.p8      # APPLE_API_KEY_P8_BASE64
```

```powershell
# Windows motsvarande
[Convert]::ToBase64String([IO.File]::ReadAllBytes('certifikat.pfx'))
```

Antingen Apple-ID eller App Store Connect-nyckeln räcker för notariseringen. Nyckeln är att föredra i
CI: den går inte ut som en app-specifik lösenkod gör.

### Windows (Authenticode)

1. Skaffa ett Authenticode-certifikat (OV eller EV) som en `.pfx`-fil med lösenord.
2. Sätt `WINDOWS_CERTIFICATE` och `WINDOWS_CERTIFICATE_PASSWORD`.
3. Bygget importerar certifikatet i runnerkontots certifikatarkiv och skickar tumavtrycket till Tauri
   via en delvis konfiguration (`tauri-signing.conf.json`) som djupmergas in i `tauri.conf.json`.
   Tauri signerar appen, sidobinären och installeraren. Tidsstämpeln hämtas från
   `http://timestamp.digicert.com` – byt den i `release.yml` om din utfärdare kräver en annan.
4. Efter bygget verifieras signaturen med `Get-AuthenticodeSignature`. Är den inte giltig avbryts
   releasen i stället för att en osignerad fil publiceras.

Ett EV-certifikat på fysisk dosa, eller certifikat som inte får exporteras som `.pfx`, kan inte
importeras så här. Använd då i stället `bundle.windows.signCommand` tillsammans med utfärdarens
verktyg (t.ex. Azure Trusted Signing) eller en signeringstjänst.

```powershell
# Kontrollera en nedladdad fil
Get-AuthenticodeSignature .\Freevobe_v0.1.0_x64-setup.exe | Format-List Status, SignerCertificate
```

### macOS (Developer ID och notarisering)

1. Apple Developer-konto, ett _Developer ID Application_-certifikat och antingen en app-specifik
   lösenkod eller en App Store Connect-nyckel med rollen _Developer_.
2. Sätt `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY` och därtill
   antingen `APPLE_ID` + `APPLE_PASSWORD` + `APPLE_TEAM_ID` eller `APPLE_API_KEY` +
   `APPLE_API_ISSUER` + `APPLE_API_KEY_P8_BASE64`. Utan certifikatet blir appen osignerad; då
   hoppas också notariseringen över, eftersom en osignerad app inte kan notariseras.
3. Tauri koden-signerar appen (hårdnat körläge är på som standard) och häftar fast biljetten på den.
   Dmg-filen notariseras och häftas separat i workflowen, eftersom Tauri inte gör det
   ([tauri-apps/tauri#7533](https://github.com/tauri-apps/tauri/issues/7533)) – utan biljett på
   själva filen varnar Gatekeeper den som laddar ner den.
4. Svaret från `notarytool` måste vara `Accepted`, och `stapler validate` måste gå igenom, annars
   avbryts releasen.

```bash
# Kontrollera en nedladdad fil
spctl --assess --type install -vv Freevobe_v0.1.0_aarch64.dmg   # accepted, source=Notarized Developer ID
xcrun stapler validate Freevobe_v0.1.0_aarch64.dmg
```

### Android (nyckellager)

Release-APK:n signeras av Gradle. Konfigurationen kommer från
`plugins/with-android-release-signing.js`, en Expo-config-plugin, eftersom `expo prebuild` skapar
`android/` från grunden och annars låter release-varianten använda debugnyckeln.

1. Skapa nyckellagret en gång och spara det – nyckeln kan inte bytas utan att installerade appar
   slutar kunna uppdateras:

   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore upload-key.jks \
     -alias freevobe -keyalg RSA -keysize 4096 -validity 10000
   ```

2. Sätt `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` och
   `ANDROID_KEY_PASSWORD`.
3. Bygget lägger nyckellagret i `android/app/upload-key.jks` och skriver `android/key.properties` –
   båda ligger under `android/` och skapas bara på byggmaskinen. Efter bygget kontrollerar
   `apksigner` att APK:n **inte** bär debugnyckelns identitet; är den det avbryts releasen.

Utan hemligheterna byggs APK:n med debugnyckeln. Den går att installera vid sidan om butiken, men kan
inte laddas upp till Play Store, och en sådan installation kan inte uppdateras till en butikssignerad
version. För Play Store behövs dessutom ett `.aab` (`./gradlew bundleRelease`) i stället för APK:n.

```bash
# Kontrollera en nedladdad fil
$ANDROID_HOME/build-tools/<version>/apksigner verify --print-certs Freevobe-Mobile_1.0.0.apk
```

### Så vet du att signeringen tog

Workflowen verifierar varje fil själv och avbryter releasen om signaturen inte är giltig: Windows
(installeraren och appens binär), macOS (`notarytool` + `stapler validate`) och Android
(`apksigner`). En varning om att en hemlighet saknas i körningen betyder att filen publicerades
osignerad.

## Kontrollsummor

Varje release får en SHA-256-summa för varje fil, så att den som laddar ner kan kontrollera att
filen är exakt den som CI byggde – signaturen säger vem som publicerade filen, summan säger att den
inte ändrats på vägen.

`.github/scripts/release-checksums.sh` gör tre saker, och `release`-jobbet anropar det:

1. **`compute`** summerar alla filer i artefaktkatalogen **efter** att dmg:erna häftats och APK:n
   signerats, och skriver `SHA256SUMS.txt` i `sha256sum`-format.
2. Filen laddas upp tillsammans med installationsfilerna.
3. **`body`** skriver in summorna i releaseanteckningarna mellan markörerna
   `<!-- sha256sums:start -->` och `<!-- sha256sums:end -->`. En omkörning av samma tagg ersätter
   sektionen i stället för att lägga till en till.

Summorna står i anteckningarna därför att GitHub-API:et svarar med CORS men själva
filnedladdningen inte gör det: nedladdningssidan kan läsa releasens text men inte hämta
`SHA256SUMS.txt` i webbläsaren. Den egna filen finns för kommandoraden.

Lägger du till en fil i en release som redan är publicerad (t.ex. Intel-dmg:n via workflowen
`macOS Intel (.dmg)`) uppdaterar **`add`** både `SHA256SUMS.txt` och anteckningarna, så summan för
den filen inte saknas.

Publicerades releasen innan kontrollsummorna fanns går det att lägga till dem i efterhand: kör
workflowen **Kontrollsummor** (`.github/workflows/release-checksums.yml`) med taggen som indata.
Den laddar ner filerna, summerar dem och skriver in resultatet – ingen ombyggnad behövs.

```bash
# macOS och Linux
sha256sum -c SHA256SUMS.txt            # shasum -a 256 -c SHA256SUMS.txt på macOS
shasum -a 256 Freevobe_v0.1.0_aarch64.dmg
```

```powershell
# Windows
Get-FileHash .\Freevobe_v0.1.0_x64-setup.exe -Algorithm SHA256
```

Stämmer inte summan ska filen inte installeras. Nedladdningssidan visar samma värden under
_Verify your download_, med en kopieringsknapp per fil.

## Automatisk uppdatering

Koden är förberedd men avstängd:

```json
"plugins": {
  "updater": {
    "active": false,
    "endpoints": ["https://releases.freevobe.dev/{{target}}/{{arch}}/{{current_version}}"],
    "pubkey": "…"
  }
}
```

Aktivera i fyra steg:

1. `npm run tauri signer generate` – spara den privata nyckeln som hemlighet (`TAURI_SIGNING_PRIVATE_KEY`,
   `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`).
2. Klistra in den publika nyckeln i `pubkey`.
3. Sätt `active: true` och en riktig `endpoints`-URL.
4. Sätt `bundle.createUpdaterArtifacts: true` i `tauri.conf.json` så att uppdateringspaketen byggs.

Testa alltid en uppdatering mellan två riktiga versioner innan den slås på för användare: kontrollera signaturkontroll,
återställning efter avbruten nedladdning och att appen startar om korrekt.

## Sidecar (agentbinären)

Skrivbordsappen kan köra agenten från en fristående binär i stället för att kräva Node:

```bash
npm run build --workspace @vibeforge/agent-server   # bundlar agenten till en fil (esbuild)
npm run sidecar:build                              # Node SEA → fristående binär
```

Agenten importerar bara Node:s inbyggda moduler, vilket är vad som gör den möjlig att bädda in i en
binär. `build-agent.mjs` vägrar bundla om ett npm-beroende dyker upp i agentkoden, så felet hamnar i
bygget i stället för hos användaren.

Resultatet blir `apps/desktop/src-tauri/binaries/vibeforge-agent-<mål-trippel>[.exe]`, som Tauri
paketerar via `bundle.externalBin` och lägger bredvid appens egen binär. De inbyggda skillsen är
markdown-filer som läses vid körning och kopieras därför till appens resurskatalog
(`apps/desktop/src-tauri/builtin-skills/`, paketeras via `bundle.resources`); skalet pekar ut dem
åt agenten med `VIBEFORGE_BUILTIN_SKILLS`.

Skalet letar efter binären i denna ordning: `VIBEFORGE_AGENT_BIN`, bredvid appens binär, i
resurskatalogen – och faller sedan tillbaka på `node` med källkoden (`VIBEFORGE_AGENT_ENTRY`,
annars paketets `dist`), vilket är vad som används i utvecklingsläge.

## Versionshantering

- `version` finns i `package.json` (rot), `apps/desktop/package.json` och
  `apps/desktop/src-tauri/tauri.conf.json`. De ska vara samma.
- Skriv en rad i `apps/web/lib/content.ts` (`CHANGELOG`) vid varje release.
