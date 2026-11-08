import fs from 'node:fs/promises';
import path from 'node:path';
import type { SkillFormatSource } from '@freevobe/protocol';

/**
 * Granskningslogg för skills. Varje gång en skill aktiveras skrivs en rad, så att användaren i
 * efterhand kan se vilken skill som låg bakom ett svar och var den kom ifrån.
 *
 * Loggen ligger lokalt i projektet och skickas aldrig någonstans. Den innehåller inget av
 * projektets innehåll – bara skillens namn, källa och vilket ord som aktiverade den.
 */

export interface SkillAuditEntry {
  /** ISO-tidpunkt. */
  at: string;
  runId: string;
  skill: string;
  source: 'builtin' | 'project' | 'user';
  /** Ursprungsagent när skillen importerats. */
  importedFrom?: SkillFormatSource;
  sourceUrl?: string;
  reason: 'explicit' | 'trigger';
  trigger?: string;
}

const AUDIT_DIR = path.join('.freevobe', 'audit');
const AUDIT_FILE = 'skills.jsonl';
const MAX_LINES_READ = 2_000;

function auditPath(root: string): string {
  return path.join(path.resolve(root), AUDIT_DIR, AUDIT_FILE);
}

/** Lägger till rader i loggen. Fel sväljs – en misslyckad logg får aldrig stoppa en körning. */
export async function appendSkillAudit(root: string, entries: SkillAuditEntry[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    const file = auditPath(root);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const payload = entries.map((entry) => JSON.stringify(entry)).join('\n');
    await fs.appendFile(file, `${payload}\n`, 'utf8');
  } catch {
    // Loggen är diagnostik, inte en förutsättning för körningen.
  }
}

/** Läser de senaste raderna, nyast först. Trasiga rader hoppas över. */
export async function readSkillAudit(root: string, limit = 50): Promise<SkillAuditEntry[]> {
  const max = Math.max(1, Math.min(limit, 500));
  let raw: string;
  try {
    raw = await fs.readFile(auditPath(root), 'utf8');
  } catch {
    return [];
  }

  const lines = raw.split('\n').filter((line) => line.trim() !== '');
  const entries: SkillAuditEntry[] = [];
  for (const line of lines.slice(-Math.max(max, 200))) {
    try {
      const parsed = JSON.parse(line) as SkillAuditEntry;
      if (typeof parsed.skill === 'string') entries.push(parsed);
    } catch {
      // En trasig rad ska inte göra resten oläslig.
    }
  }
  void MAX_LINES_READ;
  return entries.reverse().slice(0, max);
}
