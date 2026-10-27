# MCP

VibeForge är en full MCP-klient (Model Context Protocol). Servrar läggs till per projekt, kan aktiveras och inaktiveras
individuellt och deras verktyg dyker upp som vanliga agentverktyg.

## Transporter

| Transport | Används för                             | Konfiguration            |
| --------- | --------------------------------------- | ------------------------ |
| `stdio`   | Lokala servrar (`npx`, python, binärer) | `command`, `args`, `env` |
| `http`    | Servrar med streamable HTTP             | `url`                    |
| `sse`     | Äldre SSE-servrar                       | `url`                    |

## Konfiguration

Servrarna sparas i `.vibeforge/mcp.json` i projektet under nyckeln `mcpServers` (samma form som hos andra klienter, så
filen kan delas). Varje server behöver ett unikt `id`:

```json
{
  "mcpServers": [
    {
      "id": "filesystem",
      "name": "filesystem",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
      "enabled": true,
      "requireApproval": true,
      "warnings": ["Läser och skriver filer i projektmappen."]
    },
    {
      "id": "github",
      "name": "github",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "" },
      "enabled": false,
      "requireApproval": true,
      "warnings": ["Kräver en personlig åtkomsttoken med repo-scope."]
    },
    {
      "id": "postgres",
      "name": "postgres",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"],
      "enabled": false,
      "requireApproval": true,
      "warnings": ["Ger läs- och skrivåtkomst till databasen."]
    },
    {
      "id": "playwright",
      "name": "playwright",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-playwright"],
      "enabled": false,
      "requireApproval": true,
      "warnings": ["Startar en webbläsare och kan navigera till externa adresser."]
    },
    {
      "id": "search",
      "name": "web-search",
      "transport": "http",
      "url": "https://example.com/mcp",
      "enabled": false,
      "requireApproval": true,
      "warnings": ["Skickar dina sökfrågor till en extern tjänst."]
    },
    {
      "id": "remote-sse",
      "name": "legacy-sse",
      "transport": "sse",
      "url": "https://example.com/sse",
      "enabled": false,
      "requireApproval": true,
      "warnings": ["Äldre SSE-transport – kräver stöd i servern."]
    }
  ]
}
```

Fälten `enabled`, `requireApproval` och `warnings` visas i MCP-dialogen och i MCP-fliken till höger.

## Säkerhet

- Nya servrar är inaktiva tills du aktiverar dem.
- `requireApproval: true` (standard) innebär att det första anropet till en server visas som ett godkännandekort.
  Godkännandet gäller per server och session.
- Miljövariabler skrivs **inte** i konfigurationsfilen med värden; ange nycklarna och sätt värdena i din miljö. På så sätt
  hamnar inga hemligheter i git.
- Varningar visas för varje server: filsystem, nätverk, databas, webbläsare.
- En server som kraschar kopplas ner och felmeddelandet visas i statuslistan – körningen fortsätter utan den.

## Felsökning

```bash
# Testa en server för hand innan du lägger in den i VibeForge
npx -y @modelcontextprotocol/server-filesystem .

# Se vad VibeForge hittade (projectId hämtas från /api/projects)
curl -s -H "x-vibeforge-token: $(cat ~/.vibeforge/token)" \
  "http://127.0.0.1:4319/api/projects/<projectId>/mcp"
```

Vanliga orsaker till att en server inte ansluter:

1. Kommandot finns inte i `PATH` (använd en absolut sökväg i `command`).
2. Miljövariabeln med åtkomsttoken är tom.
3. Servern skriver loggar på stdout som inte är JSON-RPC (då tolkas de som trasiga meddelanden).
4. Nätverksservern kräver en header som inte stöds – använd stdio-varianten om den finns.
