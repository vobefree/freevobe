import fs from 'node:fs/promises';
import path from 'node:path';
import { VIBEFORGE_MEMORY_FILE } from '@vibeforge/protocol';
import { pathExists } from '../util/walk.js';
import { now } from '../util/ids.js';

export type MemoryKind =
  'architecture' | 'decision' | 'bug' | 'test-command' | 'style' | 'preference';

export interface MemoryEntry {
  kind: MemoryKind;
  text: string;
  createdAt: number;
}

const SECTION_TITLES: Record<MemoryKind, string> = {
  architecture: 'Arkitektur',
  decision: 'Tekniska val',
  bug: 'Kända buggar',
  'test-command': 'Testkommandon',
  style: 'Kodstil',
  preference: 'Användarpreferenser',
};

/**
 * Projektminnet är en vanlig Markdown-fil på disk (`.vibeforge/memory.md`), så att det kan
 * läsas, redigeras och versionshanteras utan Freevobe. Ingen databas emellan.
 */
export class ProjectMemory {
  private readonly file: string;

  constructor(root: string) {
    this.file = path.join(path.resolve(root), VIBEFORGE_MEMORY_FILE);
  }

  get filePath(): string {
    return this.file;
  }

  async read(): Promise<string> {
    if (!(await pathExists(this.file))) return '';
    try {
      return await fs.readFile(this.file, 'utf8');
    } catch {
      return '';
    }
  }

  /** Tolkar `## Rubrik` + `- punkt` till poster. Rubriker vi inte känner igen hoppas över. */
  async entries(): Promise<MemoryEntry[]> {
    const content = await this.read();
    const entries: MemoryEntry[] = [];
    let current: MemoryKind | null = null;

    for (const line of content.split('\n')) {
      const heading = line.match(/^##\s+(.+?)\s*$/);
      if (heading) {
        const title = heading[1] ?? '';
        current =
          (Object.entries(SECTION_TITLES).find(
            ([, value]) => value === title,
          )?.[0] as MemoryKind) ?? null;
        continue;
      }
      const bullet = line.match(/^[-*]\s+(.+)$/);
      if (bullet && current) {
        entries.push({ kind: current, text: (bullet[1] ?? '').trim(), createdAt: 0 });
      }
    }

    return entries;
  }

  /** Lägger till en punkt under rätt rubrik och skapar rubriken om den saknas. */
  async remember(kind: MemoryKind, text: string): Promise<void> {
    const trimmed = text.trim();
    if (trimmed === '') return;

    const content = (await this.read()) || `# Projektminne\n`;
    const title = SECTION_TITLES[kind];
    const lines = content.split('\n');
    const headingIndex = lines.findIndex((line) => line.trim() === `## ${title}`);
    const bullet = `- ${trimmed}`;

    if (headingIndex === -1) {
      const updated = `${content.replace(/\s*$/, '')}\n\n## ${title}\n${bullet}\n`;
      await this.write(updated);
      return;
    }

    let insertAt = headingIndex + 1;
    while (insertAt < lines.length && !lines[insertAt]?.startsWith('## ')) {
      insertAt += 1;
    }
    // Trimma bort tomma rader i slutet av sektionen.
    let lastContent = insertAt - 1;
    while (lastContent > headingIndex && (lines[lastContent] ?? '').trim() === '') lastContent -= 1;
    lines.splice(lastContent + 1, 0, bullet);

    await this.write(lines.join('\n'));
  }

  async replace(content: string): Promise<void> {
    await this.write(content);
  }

  private async write(content: string): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
  }

  /** Kort sammanfattning som kan injiceras i systemprompten. */
  async summary(maxChars = 4_000): Promise<string> {
    const content = (await this.read()).trim();
    if (content === '') return '';
    return content.length <= maxChars
      ? content
      : `${content.slice(0, maxChars)}\n… (minnet är nedkortat)`;
  }
}

export function memoryTimestamp(): number {
  return now();
}
