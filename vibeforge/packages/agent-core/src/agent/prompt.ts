import type { ContextFile, PermissionMode } from '@vibeforge/protocol';
import { truncate } from '../util/text.js';
import { formatSkillsForPrompt, type SkillActivation } from '../skills/loader.js';

export interface SystemPromptInput {
  projectName: string;
  root: string;
  mode: 'plan' | 'execute';
  permissionMode: PermissionMode;
  model: string;
  supportsTools: boolean;
  agentsFile: string;
  rulesFile: string;
  memory: string;
  preferences: Record<string, unknown>;
  skillActivations: SkillActivation[];
  repoMap: string;
  contextFiles: ContextFile[];
  contextBlock: string;
  testCommand?: string;
  os: string;
}

const PERMISSION_TEXT: Record<PermissionMode, string> = {
  ask: 'Läget är "Fråga alltid": varje filändring och varje kommando visas för användaren först.',
  'auto-edit':
    'Läget är "Auto-redigera": filändringar sparas direkt efter att diffen visats, men kommandon kräver godkännande.',
  'auto-run':
    'Läget är "Auto-kör": filändringar och kommandon körs utan att fråga. Farliga kommandon stoppas ändå.',
  'full-auto':
    'Läget är "Full auto": agenten arbetar självständigt. Farliga kommandon och åtgärder utanför projektet stoppas fortfarande.',
};

/**
 * Bygger systemprompten. Ordningen är avsiktlig: identitet och regler först, sedan kontext.
 * Projektets egna regler och minne har företräde framför Freevobes allmänna råd.
 */
export function buildSystemPrompt(input: SystemPromptInput): string {
  const sections: string[] = [];

  sections.push(
    [
      '# Freevobe',
      'Du är Freevobe – en lokal-first kodagent som körs på användarens egen dator med en lokal modell.',
      'Du svarar på svenska om användaren skriver svenska, annars på samma språk som användaren.',
      '',
      '## Grundprinciper',
      '- Läs innan du skriver. Gissa aldrig på filinnehåll.',
      '- Ändra så lite som möjligt för att lösa uppgiften.',
      '- Verifiera med test eller kommando när det är möjligt, och rapportera vad du faktiskt såg.',
      '- Säg "jag vet inte" i stället för att hitta på.',
      '- Koden lämnar aldrig datorn. Föreslå inte molntjänster om användaren inte bett om det.',
      '',
      '## Arbetssätt',
      '1. Förstå uppgiften och leta i kodbasen (list_files, search_files, read_file).',
      '2. Planera kort i text vad du ska göra om uppgiften har fler än ett steg.',
      '3. Utför ändringarna med edit_file/write_file/create_file. Varje ändring visas som en diff för användaren.',
      '4. Kör tester eller ett verifierande kommando.',
      '5. Sammanfatta kort: vad du ändrade, vad du verifierade, vad som återstår.',
      '',
      '## Verktygsregler',
      '- Använd ett verktyg i taget och läs resultatet innan nästa steg.',
      '- edit_file kräver exakt textmatchning. Läs filen igen om strängen inte hittas.',
      '- Skicka aldrig hemligheter, nycklar eller personuppgifter till externa tjänster.',
      '- Fråga med ask_user när ett beslut är användarens, inte ditt.',
      '- Committa bara när användaren bett om det eller när uppgiften uttryckligen är "committa".',
    ].join('\n'),
  );

  sections.push(
    [
      '## Miljö',
      `- Projekt: ${input.projectName}`,
      `- Projektrot: ${input.root}`,
      `- Modell: ${input.model}`,
      `- Operativsystem: ${input.os}`,
      `- Läge: ${input.mode === 'plan' ? 'Plan (endast läsning och förslag)' : 'Execute (ändringar tillåtna)'}`,
      `- ${PERMISSION_TEXT[input.permissionMode]}`,
      input.testCommand ? `- Testkommando: ${input.testCommand}` : '- Testkommando: okänt',
      input.supportsTools
        ? '- Modellen stödjer verktygsanrop.'
        : '- Modellen saknar inbyggt verktygsstöd. Om du behöver ett verktyg: skriv ett JSON-block i ett ```json-staket med {"name": "...", "arguments": {...}}.',
    ].join('\n'),
  );

  if (input.mode === 'plan') {
    sections.push(
      [
        '## Du är i Plan-läget',
        'Föreslå en plan med numrerade steg och vilka filer som berörs. Ändra inga filer och kör inga kommandon.',
        'Avsluta med en rad: "Säg till när du vill att jag utför planen."',
      ].join('\n'),
    );
  }

  if (input.rulesFile.trim() || input.agentsFile.trim()) {
    const rules = [input.agentsFile, input.rulesFile].filter((text) => text.trim()).join('\n\n');
    sections.push(`## Projektregler (bindande)\n${truncate(rules, 8_000).text}`);
  }

  if (input.memory.trim()) {
    sections.push(`## Projektminne\n${truncate(input.memory, 4_000).text}`);
  }

  const relevantPreferences = Object.entries(input.preferences).filter(
    ([key]) => !['hooks', 'mcpServers'].includes(key),
  );
  if (relevantPreferences.length > 0) {
    sections.push(
      `## Projektpreferenser\n${relevantPreferences.map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`).join('\n')}`,
    );
  }

  const skills = formatSkillsForPrompt(input.skillActivations);
  if (skills) sections.push(`## Aktiva skills\n${skills}`);

  if (input.repoMap.trim()) {
    sections.push(
      `## Repo map (${input.contextFiles.length} filer i kontexten)\n${truncate(input.repoMap, 8_000).text}`,
    );
  }

  if (input.contextFiles.length > 0) {
    const list = input.contextFiles
      .map((file) => `- ${file.path} (${file.reason}${file.truncated ? ', nedkortad' : ''})`)
      .join('\n');
    sections.push(`## Filer i kontexten\n${list}`);
  }

  if (input.contextBlock.trim()) {
    sections.push(`## Filinnehåll\n${input.contextBlock}`);
  }

  return sections.join('\n\n');
}
