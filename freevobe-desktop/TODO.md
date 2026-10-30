# TODO och öppna punkter

Det här är den ärliga listan över vad som är klart, vad som är halvfärdigt och vad som medvetet är avstängt.
Statusen gäller version 0.2.0 (2026-10-29).

## Klart och verifierat

- [x] Monorepo med strikt TypeScript, ESLint, Prettier och delade typer i `@freevobe/protocol`.
- [x] Ollama-klient mot det OpenAI-kompatibla API:et med streaming, tool calling, modellupptäckt och tydliga fel.
- [x] Agent-loop med kontextbygge, verktygsanrop, reflektion, varvgräns och avbrott.
- [x] Alla inbyggda verktyg (filer, terminal, tester, git, web, webbläsare, `ask_user`).
- [x] Godkännandepolicy med fyra behörighetslägen och hårda blockeringar.
- [x] Auto-godkännande per kategori (filer, kommandon, tester, git, nätverk, MCP) med bibehållna hårda block.
      Se [Behörigheter](docs/permissions.md).
- [x] Plan/Act: planen läggs fram i Plan-läget, godkänns av användaren och blir ett kontrakt som grindar
      filändringar i Execute-läget. Se [Plan/Act](docs/plan-act.md).
- [x] Diff för varje filändring, i godkännandet och som historik.
- [x] Kontextmotor: repo map, lokala embeddings, import- och symbolanalys, pin:ade filer, budget.
- [x] Skills (tio färdiga), projektregler, projektminne och hooks.
- [x] MCP-klient för stdio, HTTP och SSE med per-projekt-aktivering och varningar.
- [x] Subagents: explorer, implementer, tester, reviewer, documenter.
- [x] SQLite-lagret (sessioner, meddelanden, projekt, index, minne, uppgifter, godkännandelogg, checkpoints).
- [x] Checkpoints och ångra: filinnehåll sparas före varje agentändring, tidslinje i högerpanelen, återställning
      med konfliktskydd och commit till Git på begäran. Se [Checkpoints](docs/checkpoints.md).
- [x] Verifieringsmotorn: typkontroll, lint och tester körs automatiskt efter en körning som ändrat filer, med
      rapport per steg i panelen, verktyget `run_verification` och historik i databasen. Se
      [Verifiering](docs/verification.md).
- [x] Agent-server över HTTP + SSE på 127.0.0.1 med token, origin-skydd och CORS för loopback.
- [x] Skrivbordsgränssnittet: paneler, chatt, editor (Monaco), diff, terminal, godkännanden, loggar, tester, MCP-status,
      onboarding, kommandopalett, inställningar, skills-, minne- och doctor-dialoger.
- [x] Gives Back i chatten (avstängd som standard) med egen komponent, lokal påverkanslogg i SQLite och tester.
      Se [Gives Back](docs/gives-back.md).
- [x] Connectors med token i ett krypterat lokalt valv, per projekt. Vercel-connectorn har verktyg för projekt,
      preview-deploy, loggar, env-variabler och domäner – produktion kräver alltid ett extra godkännande.
      Se [Connectors](docs/connectors.md).
- [x] Gränssnittet på tolv språk (`i18n`), med språkvalsmeny i inställningarna och `npm run i18n:check` i CI.
- [x] Doctor-läge både i appen och som CLI (`npm run doctor`).
- [x] Publik webbplats (Next.js, statisk export) med Gives Back-sektion och utan annonskod.
- [x] Tauri-skal med konfiguration, capabilities, agentövervakning, ikoner och sidecar-skript.
- [x] E2E-tester med Playwright: vertikal skiva över HTTP och genom gränssnittet.
- [x] CI- och release-workflows för GitHub Actions.

## Kvar att göra

### Signering och distribution

- [ ] **Windows Authenticode**: köp ett certifikat och lägg det som `WINDOWS_CERTIFICATE` + `WINDOWS_CERTIFICATE_PASSWORD`. Workflowen importerar det, signerar och verifierar signaturen. (`TAURI_SIGNING_PRIVATE_KEY` behövs bara för själva uppdateringsartefakterna.)
- [ ] **Apple notarization**: lägg in `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY` och antingen `APPLE_ID` + `APPLE_PASSWORD` + `APPLE_TEAM_ID` eller en App Store Connect-nyckel (`APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_P8_BASE64`).
- [ ] **Android-signering**: skapa ett nyckellager och lägg in `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` och `ANDROID_KEY_PASSWORD` – annars signeras APK:n med debugnyckeln.
- [ ] **Linux**: publicera `.deb` till ett eget APT-repo om du vill ha `apt install freevobe`.
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

### Nästa stora steg (Freevobe MAX)

- [ ] **Smart Context Engine** – inkrementell komprimering av samtalet med bevarade beslut.
- [ ] **Git worktrees**, sessionspersistens utöver SQLite, LSP, Review Mode, Hooks 2.0, modellrouting,
      projekttemplates och mobil-API.
- [ ] **Fler connectors**: Supabase, GitHub, Netlify, Railway, Stripe, Resend, Cloudflare och Neon ligger som
      "kommer snart" – Vercel (steg 2) är klart, övriga följer samma mönster.

### Kvalitet och prestanda

- [ ] **Verifiering i monorepo**: varje paket med egna skript får ett eget steg (idag genomsöks bara projektets rot),
      och bygget kan schemaläggas efter var N:te körning i stället för att alltid hoppas över.

- [ ] Riktiga embeddings i stället för den lokala hash-baserade vektorn (t.ex. en liten ONNX-modell lokalt).
- [ ] Inkrementell indexering vid filändringar (idag indexeras projektet vid öppning och på begäran).
- [ ] Fler modeller: en molntransport bakom samma `ChatTransport`-gränssnitt, med uttryckligt samtycke per projekt.
- [ ] Terminalpanelen använder en enkel textvy; byt till xterm.js för interaktiva kommandon (REPL, vakter).
- [ ] Fler tester för subagents och hooks i skarpa projekt (idag täcks de av enhetstester med injicerad transport).
- [ ] Granska MCP-servrarnas resurs- och promptstöd i gränssnittet (idag visas de i status men används inte i chatten).

### Kända begränsningar

- Plan/Act-kontraktet gäller filvägar, inte innehåll, och grindar bara filändringar – kommando som rör andra filer
  fångas av behörighetsläget. En plan måste läggas fram av modellen.
- Verktygsanrop som modellen skriver som text i stället för i `tool_calls` tolkas (naken JSON, ```json-staket och
  `<tool_call>`), även när modellen uppger verktygsstöd. Anropet tas bort ur chatten och körs som vanligt, men
  texten strömmar fram en kort stund innan den töms – modeller som blandar prosa och JSON i samma svar får sin
  prosatext kvar som meddelande.
- Kontextmotorn skickar filhuvuden och symboler för stora filer; mycket stora filer kapas och märks som trunkerade.
- Webbläsarautomation kräver att Playwrights webbläsare är nedladdade (`npx playwright install chromium`).
