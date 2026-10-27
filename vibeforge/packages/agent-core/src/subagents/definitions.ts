import type { SubagentKind } from '@vibeforge/protocol';

export interface SubagentDefinition {
  kind: SubagentKind;
  label: string;
  description: string;
  systemPrompt: string;
  /** Verktyg subagenten får använda. Tomt = alla utom de som är markerade som destruktiva. */
  allowedTools: string[];
  /** Lässubagenter får köras parallellt med varandra och med huvudagenten. */
  readOnly: boolean;
  maxIterations: number;
  /** Hur mycket kontext subagenten får bygga (tecken). Isolerad kontext är poängen. */
  contextBudgetChars: number;
}

const COMMON_RULES = [
  'Du är en subagent i VibeForge. Du ser bara din egen uppgift – inte huvudagentens samtal.',
  'Arbeta självständigt och läs kod i stället för att gissa.',
  'Du får inte committa, pusha, radera filer utanför uppgiften eller köra kommandon som ändrar systemet.',
  'Avsluta alltid med ett kort svar (max 15 rader) under rubriken "Sammanfattning" med det huvudagenten behöver veta.',
].join('\n');

export const SUBAGENT_DEFINITIONS: Record<SubagentKind, SubagentDefinition> = {
  explorer: {
    kind: 'explorer',
    label: 'Utforskare',
    description: 'Undersöker kodbasen och sammanfattar hur något hänger ihop.',
    systemPrompt: [
      'Du är Utforskaren. Din uppgift är att förstå kod och rapportera tillbaka, inte att ändra något.',
      '',
      'Arbetssätt:',
      '1. Sök brett (search_files) för att hitta ingångarna.',
      '2. Läs de viktigaste filerna (read_file) och följ anropen ett par led.',
      '3. Sammanfatta: vilka filer som är centrala, hur de hänger ihop, var en ändring bör göras.',
      '',
      'Rapportera fil:rad-referenser. Ändra aldrig en fil.',
      '',
      COMMON_RULES,
    ].join('\n'),
    allowedTools: ['list_files', 'read_file', 'search_files', 'git_status', 'git_diff'],
    readOnly: true,
    maxIterations: 8,
    contextBudgetChars: 30_000,
  },
  implementer: {
    kind: 'implementer',
    label: 'Implementerare',
    description: 'Skriver koden för en avgränsad del av uppgiften.',
    systemPrompt: [
      'Du är Implementeraren. Du får skriva och ändra kod, men bara inom den del av uppgiften du fått.',
      'Följ projektets regler och befintliga mönster. Varje ändring visas som en diff för användaren.',
      'Kör inte tester på eget initiativ – det gör Tester-subagenten.',
      '',
      'Avsluta med "Sammanfattning": vilka filer du ändrade och varför.',
      '',
      COMMON_RULES,
    ].join('\n'),
    allowedTools: [
      'list_files',
      'read_file',
      'search_files',
      'create_file',
      'edit_file',
      'write_file',
      'git_diff',
    ],
    readOnly: false,
    maxIterations: 12,
    contextBudgetChars: 30_000,
  },
  tester: {
    kind: 'tester',
    label: 'Testare',
    description: 'Kör tester, analyserar fel och föreslår rättningar.',
    systemPrompt: [
      'Du är Testaren. Din uppgift är att ta reda på vad som faktiskt fungerar.',
      'Kör testerna, läs felutdatan och hitta orsaken. Föreslå en minimal rättning.',
      'Rapportera exakt vilket kommando du körde och vad resultatet blev.',
      '',
      'Avsluta med "Sammanfattning": grönt/rött, vilka tester som fallerar och den mest sannolika orsaken.',
      '',
      COMMON_RULES,
    ].join('\n'),
    allowedTools: [
      'list_files',
      'read_file',
      'search_files',
      'run_tests',
      'run_terminal_command',
      'git_diff',
    ],
    readOnly: false,
    maxIterations: 8,
    contextBudgetChars: 24_000,
  },
  reviewer: {
    kind: 'reviewer',
    label: 'Granskare',
    description: 'Granskar en diff och hittar buggar, risker och förbättringar.',
    systemPrompt: [
      'Du är Granskaren. Du bedömer en diff och letar efter det som är fel – inte efter beröm.',
      '',
      'Leta efter: säkerhetsproblem, felhantering som saknas, kanter som inte täcks, prestanda, tester som saknas,',
      'brott mot projektets regler.',
      '',
      'Formatera varje fynd som: allvar (kritisk/viktig/mindre), fil:rad, vad, varför, förslag.',
      'Om du inte hittar något allvarligt: säg det rakt ut.',
      '',
      COMMON_RULES,
    ].join('\n'),
    allowedTools: [
      'list_files',
      'read_file',
      'search_files',
      'git_diff',
      'git_status',
      'run_tests',
    ],
    readOnly: true,
    maxIterations: 8,
    contextBudgetChars: 32_000,
  },
  documenter: {
    kind: 'documenter',
    label: 'Dokumenterare',
    description: 'Skriver och uppdaterar dokumentation.',
    systemPrompt: [
      'Du är Dokumenteraren. Du skriver dokumentation som matchar nuvarande kod.',
      'Läs koden innan du beskriver den. Skriv på svenska, kod och identifierare på engelska.',
      'Uppdatera hellre befintlig dokumentation än att skapa nya filer.',
      '',
      'Avsluta med "Sammanfattning": vilka dokument du ändrade.',
      '',
      COMMON_RULES,
    ].join('\n'),
    allowedTools: [
      'list_files',
      'read_file',
      'search_files',
      'create_file',
      'edit_file',
      'write_file',
    ],
    readOnly: false,
    maxIterations: 10,
    contextBudgetChars: 30_000,
  },
};

export function getSubagentDefinition(kind: SubagentKind): SubagentDefinition {
  return SUBAGENT_DEFINITIONS[kind];
}

export function listSubagents(): SubagentDefinition[] {
  return Object.values(SUBAGENT_DEFINITIONS);
}

/** Bygger uppgiftsbeskrivningen som subagenten får. Ingen historik, bara uppgiften och ledtrådar. */
export function buildSubagentTask(kind: SubagentKind, task: string, hints?: string[]): string {
  const definition = getSubagentDefinition(kind);
  const lines = [`# Uppgift för ${definition.label}`, task.trim()];
  if (hints && hints.length > 0) {
    lines.push('', '## Ledtrådar från huvudagenten', ...hints.map((hint) => `- ${hint}`));
  }
  lines.push('', 'Svara kort och avsluta med rubriken "Sammanfattning".');
  return lines.join('\n');
}
