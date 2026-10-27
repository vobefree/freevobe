# TODO och öppna punkter

Det här är den ärliga listan över vad som är klart, vad som är halvfärdigt och vad som medvetet är avstängt.
Statusen gäller version 0.1.0 (2026-10-27).

## Klart och verifierat

- [x] Monorepo med strikt TypeScript, ESLint, Prettier och delade typer i `@vibeforge/protocol`.
- [x] Ollama-klient mot det OpenAI-kompatibla API:et med streaming, tool calling, modellupptäckt och tydliga fel.
- [x] Agent-loop med kontextbygge, verktygsanrop, reflektion, varvgräns och avbrott.
- [x] Alla inbyggda verktyg (filer, terminal, tester, git, web, webbläsare, `ask_user`).
- [x] Godkännandepolicy med fyra behörighetslägen och hårda blockeringar.
- [x] Diff för varje filändring, i godkännandet och som historik.
- [x] Kontextmotor: repo map, lokala embeddings, import- och symbolanalys, pin:ade filer, budget.
- [x] Skills (tio färdiga), projektregler, projektminne och hooks.
- [x] MCP-klient för stdio, HTTP och SSE med per-projekt-aktivering och varningar.
- [x] Subagents: explorer, implementer, tester, reviewer, documenter.
- [x] SQLite-lagret (sessioner, meddelanden, projekt, index, minne, uppgifter, godkännandelogg).
- [x] Agent-server över HTTP + SSE på 127.0.0.1 med token, origin-skydd och CORS för loopback.
- [x] Skrivbordsgränssnittet: paneler, chatt, editor (Monaco), diff, terminal, godkännanden, loggar, tester, MCP-status,
      onboarding, kommandopalett, inställningar, skills-, minne- och doctor-dialoger.
- [x] Sponsorplatsen i chatten (avstängd som standard) med egen komponent och tester.
- [x] Doctor-läge både i appen och som CLI (`npm run doctor`).
- [x] Publik webbplats (Next.js, statisk export) med reserverade annonsplatser.
- [x] Tauri-skal med konfiguration, capabilities, agentövervakning, ikoner och sidecar-skript.
- [x] E2E-tester med Playwright: vertikal skiva över HTTP och genom gränssnittet.
- [x] CI- och release-workflows för GitHub Actions.

## Kvar att göra

### Signering och distribution

- [ ] **Windows Authenticode**: köp ett certifikat och sätt `TAURI_SIGNING_PRIVATE_KEY` för uppdateringsartefakter.
- [ ] **Apple notarization**: `APPLE_CERTIFICATE`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` som hemligheter.
- [ ] **Linux**: publicera `.deb` till ett eget APT-repo om du vill ha `apt install vibeforge`.
- [ ] **Verifiera Rust-skalet**: `apps/desktop/src-tauri` är skrivet men aldrig kompilerat i den här miljön (ingen
      Rust-toolchain fanns). Kör `npm run tauri build` och åtgärda eventuella versionsproblem i `Cargo.toml`.
- [ ] **Sidecaren**: `npm run sidecar:build` använder Node SEA. Verifiera att binären startar på alla tre plattformar och
      att skalet hittar den i resurskatalogen.

### Auto-uppdatering

- [ ] Sätt `plugins.updater.active = true` i `apps/desktop/src-tauri/tauri.conf.json`.
- [ ] Generera nyckelpar med `npm run tauri signer generate` och lägg in den publika nyckeln i `pubkey`.
- [ ] Peka `endpoints` mot en riktig release-server (GitHub Releases fungerar, men en egen server ger kanaler).
- [ ] Testa en riktig uppdatering mellan två versioner innan den slås på för användare.

### Telemetri och Pro

- [ ] Telemetri är avstängt (`telemetry: false`) och kan inte slås på från gränssnittet. Om den någonsin aktiveras ska
      den vara opt-in, lokalt aggregerad och dokumenterad i integritetspolicyn.
- [ ] Pro-funktioner: delade skills mellan projekt, team-minne, granskningshistorik över tid och fjärrstyrda agenter.
- [ ] Licensiering: signerade nycklar lokalt, ingen telefons hem.

### Kvalitet och prestanda

- [ ] Riktiga embeddings i stället för den lokala hash-baserade vektorn (t.ex. en liten ONNX-modell lokalt).
- [ ] Inkrementell indexering vid filändringar (idag indexeras projektet vid öppning och på begäran).
- [ ] Fler modeller: en molntransport bakom samma `ChatTransport`-gränssnitt, med uttryckligt samtycke per projekt.
- [ ] Terminalpanelen använder en enkel textvy; byt till xterm.js för interaktiva kommandon (REPL, vakter).
- [ ] Fler tester för subagents och hooks i skarpa projekt (idag täcks de av enhetstester med injicerad transport).
- [ ] Granska MCP-servrarnas resurs- och promptstöd i gränssnittet (idag visas de i status men används inte i chatten).

### Kända begränsningar

- Modeller utan tool calling kan bara användas i chatten. Appen varnar tydligt, men en textbaserad reservväg för
  verktygsanrop finns bara delvis (`parseTextualToolCalls`).
- Kontextmotorn skickar filhuvuden och symboler för stora filer; mycket stora filer kapas och märks som trunkerade.
- Webbläsarautomation kräver att Playwrights webbläsare är nedladdade (`npx playwright install chromium`).
