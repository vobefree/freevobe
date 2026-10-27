import { execFile } from 'node:child_process';

export interface GitResult {
  output: string;
  exitCode: number;
}

/**
 * Kör ett git-kommando med execFile (ingen skal-tolkning, inga injiceringsmöjligheter) och
 * returnerar alltid ett resultat i stället för att kasta.
 */
export function executeGit(cwd: string, args: string[], timeoutMs = 30_000): Promise<GitResult> {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      { cwd, timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        const output = `${stdout}${stderr}`;
        if (error) {
          const code =
            typeof (error as NodeJS.ErrnoException & { code?: number }).code === 'number'
              ? Number((error as { code: number }).code)
              : 1;
          resolve({ output: output || error.message, exitCode: Number.isFinite(code) ? code : 1 });
          return;
        }
        resolve({ output, exitCode: 0 });
      },
    );
  });
}

export async function isGitRepository(cwd: string): Promise<boolean> {
  const { exitCode } = await executeGit(cwd, ['rev-parse', '--is-inside-work-tree']);
  return exitCode === 0;
}
