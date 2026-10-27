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

```bash
npm run tauri build -- --bundles nsis          # Windows .exe
npm run tauri build -- --bundles dmg           # macOS .dmg
npm run tauri build -- --bundles appimage,deb  # Linux
```

Artefakterna hamnar i `apps/desktop/src-tauri/target/release/bundle/`.

## Bygg i CI

`.github/workflows/release.yml` bygger alla tre plattformar när du pushar en tagg `v*` och lägger dem som ett utkast
till release. Filen innehåller de hemligheter som behövs för signering (utkommenterade – lägg in dem när du har dem).

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
npm run sidecar:build     # Node SEA → apps/desktop/src-tauri/binaries/vibeforge-agent[.exe]
```

Skalet letar i denna ordning: `VIBEFORGE_AGENT_BIN`, `VIBEFORGE_AGENT_ENTRY`, en binär i appens resurskatalog och
slutligen `node` med källkoden (utvecklingsläge).

## Versionshantering

- `version` finns i `package.json` (rot), `apps/desktop/package.json` och
  `apps/desktop/src-tauri/tauri.conf.json`. De ska vara samma.
- Skriv en rad i `apps/web/lib/content.ts` (`CHANGELOG`) vid varje release.
