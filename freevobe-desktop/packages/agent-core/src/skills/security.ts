import type { SkillRiskLevel, SkillSecurityFinding, SkillSecurityReport } from '@freevobe/protocol';

/**
 * Säkerhetsskannern för importerade skills.
 *
 * En skill är instruktioner som hamnar i modellens kontext. Den kan alltså be modellen att
 * ignorera sina regler, läsa hemligheter eller skicka iväg data. Skannern letar efter de mönster
 * som är kända från prompt-injektion och tyst datautlämning – den är ett filter, inte ett bevis:
 * ett "safe" betyder att inget känt mönster hittades, inte att innehållet är ofarligt.
 */

type FindingLevel = 'warning' | 'dangerous';

interface PatternRule {
  code: string;
  level: FindingLevel;
  pattern: RegExp;
}

/** Mönster som alltid är allvarliga: de försöker styra modellen eller köra kod. */
const DANGEROUS_RULES: PatternRule[] = [
  {
    code: 'override_instructions',
    level: 'dangerous',
    pattern:
      /\b(ignore|disregard|forget)\b[^\n]{0,40}\b(previous|prior|above|earlier|all)\b[^\n]{0,20}\b(instructions?|rules?|prompts?)\b/i,
  },
  {
    code: 'override_instructions',
    level: 'dangerous',
    pattern:
      /\b(ignorera|strunta i|glöm)\b[^\n]{0,40}\b(tidigare|ovanstående|alla)\b[^\n]{0,20}\b(instruktioner|regler)\b/i,
  },
  {
    code: 'override_instructions',
    level: 'dangerous',
    pattern: /\b(system\s*prompt|jailbreak|developer\s*mode|do\s+anything\s+now)\b/i,
  },
  {
    code: 'hide_from_user',
    level: 'dangerous',
    pattern:
      /\b(do\s+not|don't|never)\b[^\n]{0,30}\b(tell|inform|show|mention)\b[^\n]{0,30}\b(the\s+)?(user|användaren)\b/i,
  },
  {
    code: 'pipe_to_shell',
    level: 'dangerous',
    pattern: /\b(curl|wget)\b[^\n]{0,200}\|\s*(sudo\s+)?(ba|z|k)?sh\b/i,
  },
  {
    code: 'destructive_command',
    level: 'dangerous',
    pattern: /\brm\s+(-[a-z]*\s+)*(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\b/i,
  },
  { code: 'privileged_command', level: 'dangerous', pattern: /\b(sudo|doas|pkexec)\b/i },
  {
    code: 'dynamic_execution',
    level: 'dangerous',
    pattern: /\b(eval\s*\(|Invoke-Expression|base64\s+(-d|--decode)\b)/i,
  },
  {
    code: 'exfiltration',
    level: 'dangerous',
    pattern:
      /\b(send|post|upload|skicka|ladda\s+upp)\b[^\n]{0,60}\b(env|secret|token|key|credential|hemlighet|nyckel)[^\n]{0,60}https?:\/\//i,
  },
];

/** Mönster som kräver ett medvetet val men inte är direkta angrepp. */
const WARNING_RULES: PatternRule[] = [
  {
    code: 'credential_access',
    level: 'warning',
    pattern:
      /(\.env\b|id_rsa|id_ed25519|\.ssh\b|\.aws\/credentials|\.netrc|\.npmrc|\.git-credentials|private\s+key|ssh-keys?)/i,
  },
  {
    code: 'credential_access',
    level: 'warning',
    pattern: /\b(api[_-]?key|password|passwd|secret|token)\b\s*[:=]\s*["']?[^\s"']{8,}/i,
  },
  {
    code: 'network_install',
    level: 'warning',
    pattern: /\b(npx|pip\s+install|npm\s+install\s+-g|brew\s+install)\b/i,
  },
  {
    code: 'script_reference',
    level: 'warning',
    pattern: /```\s*(bash|sh|shell|zsh|fish|python|py|node|js|javascript|powershell|ps1)\b/i,
  },
];

/** Externa adresser. Lokala adresser räknas inte – de lämnar inte datorn. */
const URL_PATTERN = /\bhttps?:\/\/[^\s<>()[\]"'`]+/gi;
const LOCAL_HOST = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?(\/|$)/i;

/** Skript som nämns i klartext, t.ex. `scripts/install.sh`. */
const SCRIPT_FILE_PATTERN = /\b[\w./-]+\.(sh|bash|zsh|py|js|mjs|cjs|ps1|bat|cmd)\b/gi;
const CODE_FENCE_LANGUAGE =
  /```\s*(bash|sh|shell|zsh|fish|python|py|node|js|javascript|typescript|ts|powershell|ps1)\b/gi;

const MAX_FINDINGS = 40;
const MAX_EXCERPT = 140;
const BASE64_BLOB = /[A-Za-z0-9+/]{120,}={0,2}/;

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let cursor = 0; cursor < index && cursor < text.length; cursor += 1) {
    if (text[cursor] === '\n') line += 1;
  }
  return line;
}

function excerptAt(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 20);
  const end = Math.min(text.length, index + length + 20);
  const raw = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return raw.length > MAX_EXCERPT ? `${raw.slice(0, MAX_EXCERPT - 1)}…` : raw;
}

function uniquePush(target: string[], value: string): void {
  if (value && !target.includes(value)) target.push(value);
}

export interface SecurityScanOptions {
  /** Max antal träffar som rapporteras. Standard 40. */
  maxFindings?: number;
}

/**
 * Skannar en skills markdown. Returnerar risknivå, poäng, träffar, externa adresser och de
 * skript som nämns. Skannern läser bara text – den kör ingenting.
 */
export function scanSkillSecurity(
  text: string,
  options: SecurityScanOptions = {},
): SkillSecurityReport {
  const limit = Math.max(1, options.maxFindings ?? MAX_FINDINGS);
  const findings: SkillSecurityFinding[] = [];
  const urls: string[] = [];
  const scripts: string[] = [];

  const add = (code: string, level: FindingLevel, index: number, length: number) => {
    if (findings.length >= limit) return;
    if (findings.some((entry) => entry.code === code && entry.line === lineOf(text, index))) return;
    findings.push({
      code,
      level,
      excerpt: excerptAt(text, index, length),
      line: lineOf(text, index),
    });
  };

  for (const rule of [...DANGEROUS_RULES, ...WARNING_RULES]) {
    const matcher = new RegExp(
      rule.pattern.source,
      rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`,
    );
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(text)) !== null) {
      add(rule.code, rule.level, match.index, match[0].length);
      if (match[0].length === 0) matcher.lastIndex += 1;
    }
  }

  // Dolt innehåll: osynliga tecken och långa base64-block används för att gömma instruktioner
  // som människan inte ser men modellen läser.
  const hiddenChars = [...text].filter((char) =>
    /[\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/.test(char),
  ).length;
  if (hiddenChars >= 3) {
    add(
      'hidden_characters',
      'dangerous',
      text.search(/[\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/),
      1,
    );
  }
  const base64 = BASE64_BLOB.exec(text);
  if (base64) add('encoded_blob', 'warning', base64.index, base64[0].length);

  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0].replace(/[.,;:]+$/, '');
    if (LOCAL_HOST.test(url)) continue;
    uniquePush(urls, url);
    add('external_url', 'warning', match.index, url.length);
  }

  for (const match of text.matchAll(SCRIPT_FILE_PATTERN)) {
    uniquePush(scripts, match[0].replace(/^\.\//, ''));
  }
  for (const match of text.matchAll(CODE_FENCE_LANGUAGE)) {
    uniquePush(scripts, `${(match[1] ?? '').toLowerCase()} (kodblock)`);
  }

  const dangerous = findings.filter((entry) => entry.level === 'dangerous').length;
  const warnings = findings.length - dangerous;
  const score = Math.max(0, 100 - dangerous * 40 - warnings * 10);
  const level: SkillRiskLevel = dangerous > 0 ? 'dangerous' : warnings > 0 ? 'warning' : 'safe';

  return { level, score, findings, urls, scripts, scannedChars: text.length };
}

/** Slår ihop flera rapporter, t.ex. när en skill består av flera filer. */
export function mergeSecurityReports(reports: SkillSecurityReport[]): SkillSecurityReport {
  const findings = reports.flatMap((report) => report.findings).slice(0, MAX_FINDINGS);
  const urls = [...new Set(reports.flatMap((report) => report.urls))];
  const scripts = [...new Set(reports.flatMap((report) => report.scripts))];
  const dangerous = findings.some((entry) => entry.level === 'dangerous');
  const level: SkillRiskLevel = dangerous ? 'dangerous' : findings.length > 0 ? 'warning' : 'safe';
  const score = reports.length === 0 ? 100 : Math.min(...reports.map((report) => report.score));
  return {
    level,
    score,
    findings,
    urls,
    scripts,
    scannedChars: reports.reduce((sum, report) => sum + report.scannedChars, 0),
  };
}
