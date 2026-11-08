# Integritet

Freevobe är lokal-first. Koden, promptarna, skillsen och modellerna stannar på din dator.

## Vad som aldrig lämnar datorn

- **Kod och filer** läses bara av den lokala agenten och den lokala modellen.
- **Prompter och svar** går till Ollama på `127.0.0.1`. Ingen molntjänst används om du inte själv
  slår på en provider med din egen nyckel.
- **Importerade skills** sparas i `.freevobe/skills/` i projektet. Importen skickar dem aldrig
  vidare till någon tredje part.
- **Hämtade modeller** sparas i Ollamas lokala lagring. Hämtningen går till Ollamas register och
  ingenting annat skickas med.
- **Ingen telemetri.** Det finns ingen kodväg som skickar analysdata, och ingen inloggning.

## Vad som kan lämna datorn – och bara när du säger ja

- **Github-import** hämtar ett repo du själv pekat ut, med `git clone --depth 1`. Bara
  markdownfilerna läses, och den tillfälliga kopian raderas direkt efter skanningen.
- **Webb och externa API:er** kräver godkännande per anrop och visas med adress i
  godkännandekortet.
- **Bild-, video- och ljudproviders** är avstängda tills du aktiverar dem och anger din egen
  nyckel; varje anrop visar pris och kräver godkännande.
- **Gives Back** tar bara emot antalet prompter. Innehållet i chatten når aldrig dit.

## Skydd mot osäkra skills

Importerade skills säkerhetsskannas innan de får väljas (se
[skills-import](skills-import.md)). Farliga instruktioner blockeras som standard. I prompten
behandlas skill-text som data, aldrig som systeminstruktioner, och alla verktygsanrop kräver
samma godkännande som vanligt.

Agenten läser aldrig hemlighetsfiler som `.env`, `.ssh` eller `*.pem` – varken direkt eller via
en skill.

## Radera allt

- Skills: ta bort `.freevobe/skills/` (eller enskilda filer i skills-dialogen).
- Granskningslogg: ta bort `.freevobe/audit/`.
- Modeller: `ollama rm <modell>`.
- Hela appens data: avinstallera Freevobe och ta bort projektets `.freevobe/`-mapp.

Ingenting av detta finns hos oss – det finns bara på din dator.
