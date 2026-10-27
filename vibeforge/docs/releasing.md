# Release

Målet är installerare för Windows, macOS och Linux, med signering och automatisk uppdatering **avstängd tills du
konfigurerat den**.

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
`productName` och `version` i `tauri.conf.json` (t.ex. `VibeForge_0.1.0_x64-setup.exe`).

## Bygg i CI

`.github/workflows/release.yml` bygger Windows, macOS och Linux när du pushar en tagg `v*` och
publicerar filerna i releasen för taggen. Taggen måste matcha `version` i `tauri.conf.json` – annars
avbryter workflowen med ett förklarande fel. Signeringsstegen är fortfarande avstängda (se nedan).

Filerna döps om till exakt de namn nedladdningssidan letar efter:

| Plattform | Filnamn |
|---|---|
| Windows | `Freevobe_v0.1.0_x64-setup.exe` |
| macOS (Apple Silicon) | `Freevobe_v0.1.0_aarch64.dmg` |
| macOS (Intel) | `Freevobe_v0.1.0_x64.dmg` |
| Linux | `Freevobe_v0.1.0_amd64.AppImage` |
| Android (mobilappen) | `Freevobe-Mobile_1.0.0.apk` (appen egen version ur `app.json`) |

Ändrar du namnen i workflowen måste `ASSET_FILE_NAMES` i `freevobe/src/config/release.ts` ändras
ochå – annars hittas filerna bara via GitHub-API:t, inte via den förväntade adressen.

Intel-dmg:n kräver en Intel-runner (`macos-15-intel`): sidobinären paketeras med Node:s SEA på
byggmaskinens arkitektur, så en arm64-runner kan inte producera en agent-binär som körs på Intel.
Jobbet kör i samma workflow men med `continue-on-error`, så en indragen runner bara stryker den
filen i stället för att stoppa resten av releasen. Redan publicerad release utan Intel-fil? Kör
workflowen `macOS Intel (.dmg)` manuellt med taggen som indata – då byggs bara den filen.

Android-appen byggs i samma workflow med Gradle (`expo prebuild` + `assembleRelease`) och kräver
inget EAS-konto. APK:n signeras med debugnyckeln, alltså installerbar vid sidan om butiken – för
Play Store krävs EAS-profilen `production` och ett eget nyckellager.

```bash
git tag v0.2.0
git push origin v0.2.0
```

## Signering

### Windows

1. Skaffa ett Authenticode-certifikat (EV eller OV).
2. Lägg certifikatet och lösenordet som hemligheter och peka ut dem i workflowen.
3. Sätt `bundle.windows.certificateThumbprint` i `tauri.conf.json` om du använder certifikatarkivet.

Utan signering visas en SmartScreen-varning vid installation. Det är ett känt och dokumenterat läge i 0.1.0.

### macOS

1. Apple Developer-konto och ett _Developer ID Application_-certifikat.
2. Sätt `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD` och `APPLE_TEAM_ID`.
3. Notarization krävs för att appen ska starta utan varning på andra maskiner.

## Automatisk uppdatering

Koden är förberedd men avstängd:

```json
"plugins": {
  "updater": {
    "active": false,
    "endpoints": ["https://releases.vibeforge.dev/{{target}}/{{arch}}/{{current_version}}"],
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
