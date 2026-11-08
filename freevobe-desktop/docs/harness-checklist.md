# Skarp slutkontroll av harness

Den här checklistan verifierar kedjan på din egen dator, med riktig Ollama och ett riktigt
projekt. Testerna i repot använder injicerade transporter och kan därför inte bevisa att
modellen faktiskt svarar, att dev-servern startar eller att preview renderas.

## 0. Förberedelser

```bash
ollama --version
ollama list
node --version    # >= 22.5
```

Starta agenten och appen:

```bash
npm ci
npm run dev
```

Öppna sedan appen, välj projekt och kontrollera att modellistan fylls.

## 1. Modeller och router

```bash
# Hämtar modeller som redan finns, utan att hämta något
curl -s http://127.0.0.1:4319/api/ollama | head -c 400

# Routerns beslut för en typisk koduppgift
curl -s "http://127.0.0.1:4319/api/router?prompt=fixa%20buggen%20i%20index.ts"
```

Förväntat: `ok: true` med en lokal modell som har verktygsstöd, eller `ok: false` med en
rekommendation där `preview.requiresApproval` är `true`.

Prova också en mediebeställning (`gör en bild av en katt`). Utan påslagen Google-provider ska
svaret vara `no-media-provider` – inte en tyst körning.

## 2. Hämtning med checksumma

Hämta bara en modell du faktiskt vill ha. Kontrollera först vad som skulle hämtas:

```bash
curl -s "http://127.0.0.1:4319/api/router?prompt=skriv%20en%20hemsida" | python3 -m json.tool
```

Hämta sedan med ett uttryckligt ja (SSE strömmar framstegen):

```bash
curl -N -X POST http://127.0.0.1:4319/api/models/pull \
  -H 'content-type: application/json' \
  -d '{"model":"qwen2.5-coder:7b","approved":true,"expectedDigest":null}'
```

Förväntat: `event: progress` flera gånger och sist `event: done` med
`verification.status: "unverified"` när ingen förväntad checksumma angavs. Utan `approved: true`
ska ingen hämtning ske.

## 3. Hela flödet: från beställning till preview

1. Öppna ett tomt projekt.
2. Skriv: `Gör en hemsida till en frisör`.
3. Följ körningen i Control Room.

Förväntat:

- Faserna `gather → act → verify → deliver` syns i ordning.
- Minst en fil skapas (diff och checkpoint).
- Verifieringen körs bara om filer ändrats; är den röd startas ingen preview.
- Previewpanelen öppnas med sidan, och adressen är `http://127.0.0.1:…`.

## 4. Uppgiftslista och subagent

Be modellen: `Dela upp arbetet i en uppgiftslista och låt en explorer hitta ingångspunkten.`
Förväntat: `todo_write` fyller uppgiftslistan och `run_subagent` returnerar en sammanfattning.

## 5. Stängning och städning

- Stäng projektet: preview-servern ska sluta svara på sin port.
- Kontrollera att ingenting lyssnar utåt: `lsof -iTCP -sTCP:LISTEN -P | grep -E 'node|ollama'`
  ska bara visa loopback.
- Radera allt lokalt: `.freevobe/` i projektet och Freevobe-home i hemkatalogen.

## Om något inte stämmer

- Ingen modell i listan: `ollama serve` och kontrollera `ollamaBaseUrl` i inställningarna.
- Preview startar inte: projektet behöver `scripts.dev` eller `index.html`.
- Verifieringen hoppas över: `verifyAfterRun` är avstängt, eller inga filer ändrades.
