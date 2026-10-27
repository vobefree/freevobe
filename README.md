# Freevobe

Freevobe är en lokal-first AI-kodagent: modellen körs via Ollama på din egen dator och koden lämnar
den inte utan att du uttryckligen godkänner det. Repot innehåller produktens tre delar, en mapp per
del.

| Mapp | Del | Vad den gör |
|---|---|---|
| [`vibeforge/`](vibeforge) | **Freevobe Desktop** | Skrivbordsappen och den lokala agent-servern (port 4319). Planerar, läser kod, skriver filer, kör kommandon, testar och committar – efter ditt godkännande. |
| [`freevobe-mobile/`](freevobe-mobile) | **Freevobe Mobile** | Telefonappen (Expo, SDK 58). Följer körningar, svarar på godkännanden, läser diffar och loggar och notiserar när något väntar på dig. |
| [`freevobe/`](freevobe) | **Freevobe-sidan** | Marknadssidan och nedladdningen (Next.js 15, statisk och beroendesnål). |

Telefonen kan köras i demoläge utan dator, men för riktig användning krävs att skrivbordsappen körs på
samma nätverk och att du parar ihop dem med QR-koden från skrivbordet.

## Snabbstart per del

```bash
# Freevobe Desktop (agent-server + skrivbordsapp)
cd vibeforge && npm install && npm run dev

# Freevobe Mobile (Expo – visar QR-kod för Expo Go)
cd freevobe-mobile && npm install && npm start

# Freevobe-sidan
cd freevobe && npm install && npm run dev      # http://localhost:4300
```

Detaljerad dokumentation finns i respektive mapps README, till exempel
[mobilappens](freevobe-mobile/README.md) – där står också exakt vilka endpoints skrivbordet måste
exponera.

## Testa och kontrollera

Varje del har sina egna kommandon; CI kör samma saker vid varje push (se
[`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

```bash
cd freevobe-mobile && npm test && npm run typecheck && npm run lint
cd vibeforge      && npm run typecheck && npm run lint && npm test
cd freevobe       && npm test && npm run typecheck
```

Sådant som kräver en riktig enhet eller nedladdade webbläsare – Playwright-sviten i `vibeforge` och
appens pushnotiser – körs inte i CI utan lokalt.

## Säkerhet

- Allt är lokalt: agenten, modellen och databasen. Ingen telemetri, ingen inloggning, inget molnkonto.
- Skrivbordet lyssnar på ditt lokala nätverk och skyddas av en parningskod som skickas i huvudet
  `x-freevobe-token`. I v1 går trafiken okrypterad över nätet, så anslut bara från nätverk du litar på.
- Mobilappen vägrar ansluta till adresser utanför det lokala nätverket och varnar innan den kopplar
  upp mot ett nätverk du inte äger.
