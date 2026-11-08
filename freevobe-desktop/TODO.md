# TODO och öppna punkter

Det här är den ärliga listan över vad som är klart, vad som är halvfärdigt och vad som medvetet är avstängt.
Statusen gäller version 0.4.0 (2026-11-07).

## Klart och verifierat

- [x] Monorepo med strikt TypeScript, ESLint, Prettier och delade typer i `@freevobe/protocol`.
- [x] Ollama-klient mot det OpenAI-kompatibla API:et med streaming, tool calling, modellupptäckt och tydliga fel.
- [x] Agent-loop med kontextbygge, verktygsanrop, reflektion, varvgräns och avbrott.
- [x] Harness med fyra faser (gather, act, verify, deliver): verifiering och preview körs i samma
      kedja som loopen. Se [Agent harness](docs/harness.md).
- [x] Modellrouter: lokal modell först, molnprovider bara om projektet tillåter det, annars en
      rekommendation om hämtning. Hårdvaruprofil för RAM jämförs med modellens storlek.
- [x] Modellhämtning med `approved`-krav, strömmade framsteg och checksummekontroll efteråt.
- [x] Live-preview: dev-servern eller statiska filer serveras på `127.0.0.1` och visas i panelen.
- [x] Control Room: en samlad tidslinje över modellval, verktyg, godkännanden, diffar, verifiering,
      preview, checkpoints och hämtningar.
- [x] Rekommendationskort i chatten med namn, storlek, källa, checksumma och "Ladda ner & använd";
      hämtningen visar framsteg och checksummans utfall.
- [x] Verktygen `todo_write` och `run_subagent`: uppgiftslista och delegering inifrån loopen.
- [x] Checklista för skarp verifiering mot riktig Ollama och ett riktigt projekt.
- [x] `.freevobe/launch.json` skrivs vid varje preview-start med kommando, port och adress.
- [x] Tauri-CSP tillåter iframe mot loopback; tidigare blockerades previewn av `default-src 'self'`.
- [x] `preview_check`: agenten kan se previewn (text, skärmbild, konsolfel) och rätta visuella fel.
- [x] Claude-lik design med ljust/mörkt/systemtema, tre vylägen och sidchatt.
- [x] Kodeditorn följer temat: Monaco har både ett mörkt och ett ljust tema och byter direkt vid växling.
- [x] Qoder-läge: terminal-likt gränssnitt, kommandopalett med `:w`, `:q`, `:run`, `:test` m.fl.
- [x] Dragbara paneler: byt plats på chatt och editor och dra i avdelaren för höjdfördelning.
- [x] Panelayouten (ordning och höjdfördelning) sparas mellan omstarter.
- [x] Landningssidan visar tema, vylägen och Qoder-läget.
- [x] Alla inbyggda verktyg (filer, terminal, tester, git, web, webbläsare, `ask_user`).
- [x] Godkännandepolicy med fyra behörighetslägen och hårda blockeringar.
- [x] Auto-godkännande per kategori (filer, kommandon, tester, git, nätverk, MCP) med bibehållna hårda block.
      Se [Behörigheter](docs/permissions.md).
- [x] Plan/Act: planen läggs fram i Plan-läget, godkänns av användaren och blir ett kontrakt som grindar
      filändringar i Execute-läget. Se [Plan/Act](docs/plan-act.md).
- [x] Diff för varje filändring, i godkännandet och som historik.
- [x] Kontextmotor: repo map, lokala embeddings, import- och symbolanalys, pin:ade filer, budget.
- [x] Skills (elva färdiga), projektregler, projektminne och hooks.
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
- [x] Providers vid sidan av Ollama: Anthropic (Claude), Google (Gemini) och xAI (Grok) med katalog över
      förmågor, modeller och priser, nycklar i det krypterade valvet och capability-badges i gränssnittet.
      Se [Providers](docs/providers.md).
- [x] Multimodal agent: klassificering av `output_type` (`text|code|image|video|audio`), lokal-only-läge som
      stoppar molnanrop med ett tydligt besked och en banner, samt verktygen `generate_image`, `generate_video`,
      `generate_audio`, `analyze_image` och `analyze_video`.
- [x] Media i gränssnittet: resultat i chatten, Media-flik i workspace, kostnadsöversikt med daglig budget och
      hårda säkerhetsregler för medieprompter. Se [Media-flows](docs/media-flows.md).
- [x] Inbyggd skill `media-flows` med tre exempel på hela kedjan från prompt till färdig fil.
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

- [x] Nyckelparet är generat, den publika halvan ligger i `pubkey` och den privata som hemligheten
      `TAURI_SIGNING_PRIVATE_KEY` i CI.
- [x] `endpoints` pekar mot `latest.json` i den senaste GitHub-releasen.
- [x] Workflowen bygger signerade uppdateringsfiler och skriver `latest.json` – från och med 0.2.6.
- [ ] Bevisa kedjan mellan två versioner: installera 0.2.6, publicera sedan 0.2.7 och se att bannern
      dyker upp, att signaturen verifieras och att appen startar om i den nya versionen.
- [ ] Egen server om du vill ha kanaler (beta/stable) i stället för bara `latest`.

### Telemetri och Pro

- [ ] Telemetri är avstängt (`telemetry: false`) och kan inte slås på från gränssnittet. Om den någonsin aktiveras ska
      den vara opt-in, lokalt aggregerad och dokumenterad i integritetspolicyn.
- [ ] Pro-funktioner: delade skills mellan projekt, team-minne, granskningshistorik över tid och fjärrstyrda agenter.
- [ ] Licensiering: signerade nycklar lokalt, ingen telefons hem.

### Nästa stora steg (Freevobe MAX)

- [ ] **Smart Context Engine** – inkrementell komprimering av samtalet med bevarade beslut.
- [ ] **Git worktrees**, sessionspersistens utöver SQLite, LSP, Review Mode, Hooks 2.0,
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

- Preview startar dev-servern med projektets eget `npm run dev`; ett projekt utan dev-skript och
  utan `index.html` kan inte visas. VRAM läses inte (det går inte portabelt), så bara RAM jämförs.
- Control Room, rekommendationskortet, previewpanelen och de nya utseendelägena är
  typkontrollerade och testade i sin logik, men inte visuellt granskade i en riktig app än.
- GitHub Releases är inte publicerad härifrån. Version 0.4.0 är förberedd – version i alla tre
  filerna, changelog och tagg – men själva publiceringen sker när taggen `v0.4.0` pushas, eftersom
  release-workflowen bygger och laddar upp filerna från GitHub Actions.
- Agenten kan granska previewn med `preview_check`, men det finns ingen automatisk
  skärmbildsrunda som startar om loopen vid visuella fel – granskningen sker när modellen väljer
  att anropa verktyget.
- Kedjan är inte körd mot en riktig Ollama och ett riktigt Vite-projekt i den här miljön. Checklistan
  i `docs/harness-checklist.md` beskriver hur du verifierar den på din dator.

- Plan/Act-kontraktet gäller filvägar, inte innehåll, och grindar bara filändringar – kommando som rör andra filer
  fångas av behörighetsläget. En plan måste läggas fram av modellen.
- Verktygsanrop som modellen skriver som text i stället för i `tool_calls` tolkas (naken JSON, ``json-staket och
`<tool_call>`), även när modellen uppger verktygsstöd. Anropet hålls tillbaka medan det strömmar och tas bort ur
chatten innan det körs. Staketets första rad (``json) kan synas, och ett anrop över 4 000 tecken hinner visa sin
  början innan gränsen slår till – då tömmer `assistant_reset` bubblan när anropet körs.
- Kontextmotorn skickar filhuvuden och symboler för stora filer; mycket stora filer kapas och märks som trunkerade.
- Webbläsarautomation kräver att Playwrights webbläsare är nedladdade (`npx playwright install chromium`).
