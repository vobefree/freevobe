import type { SkillFormatSource } from './ipc.js';

/** Risknivå för en importerad skill. `dangerous` kräver ett uttryckligt "jag förstår risken". */
export type SkillRiskLevel = 'safe' | 'warning' | 'dangerous';

/** En enskild träff från säkerhetsskannern. `code` är stabil och översätts i gränssnittet. */
export interface SkillSecurityFinding {
  code: string;
  level: 'warning' | 'dangerous';
  /** Kort textutdrag runt träffen, aldrig hela filen. */
  excerpt: string;
  /** 1-baserad rad i markdownen. */
  line: number;
}

/** Resultatet av säkerhetsskannern som körs innan en skill får importeras. */
export interface SkillSecurityReport {
  level: SkillRiskLevel;
  /** 100 = inget hittat. Varje träff drar ner poängen. */
  score: number;
  findings: SkillSecurityFinding[];
  /** Externa adresser som skillen hänvisar till. */
  urls: string[];
  /** Skript som skillen hänvisar till (språk i kodblock eller filnamn). Kopieras aldrig. */
  scripts: string[];
  scannedChars: number;
}

/**
 * En skill som hittats i en annan agents filer och normaliserats till Freevobe-format.
 * `markdown` är den färdiga filen – förhandsgranskningen visar samma text som sparas.
 */
export interface SkillImportItem {
  /** Projektrelativ sökväg i källan. */
  path: string;
  source: SkillFormatSource;
  kind: 'skill' | 'document';
  name: string;
  description: string;
  tools: string[];
  triggers: string[];
  globs: string[];
  alwaysApply: boolean;
  body: string;
  markdown: string;
  /** Noteringar från normaliseringen, t.ex. att beskrivningen gissades. */
  warnings: string[];
  sourceRepo?: string;
  /** Författare från frontmattern, eller repo-ägaren när skillen kom från GitHub. */
  author?: string;
  /** Klickbar källa: repo-adressen med filsökvägen, eller den lokala sökvägen. */
  sourceUrl?: string;
  /** Säkerhetsbedömning som avgör om posten får importeras. */
  security: SkillSecurityReport;
  /** Sätts när namnet redan finns bland projektets, användarens eller de inbyggda skillsen. */
  conflict: { with: 'builtin' | 'project' | 'user'; description: string } | null;
}

export interface SkillImportScan {
  /** Absolut sökväg, eller `owner/repo` när källan klonades från GitHub. */
  target: string;
  bySource: { source: SkillFormatSource; count: number }[];
  items: SkillImportItem[];
  /** Markdown utan känt format – visas så att inget försvinner i tysthet. */
  unknown: string[];
  ignored: number;
}

export interface SkillImportApplyItem {
  name: string;
  description: string;
  tools: string[];
  triggers: string[];
  globs: string[];
  alwaysApply: boolean;
  body: string;
  source: SkillFormatSource;
  sourcePath: string;
  sourceRepo?: string;
  author?: string;
  sourceUrl?: string;
}

export interface SkillImportApplyResult {
  created: string[];
  files: string[];
}
