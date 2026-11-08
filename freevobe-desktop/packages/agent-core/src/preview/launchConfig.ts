import fs from 'node:fs/promises';
import path from 'node:path';
import type { PreviewKind } from '@freevobe/protocol';

/**
 * `.freevobe/launch.json` beskriver hur previewn startades: vilket kommando, vilken port och
 * vilken adress. Filen skrivs vid varje start, ligger i projektets egen state-mapp och är det
 * närmaste vi kommer en launch-konfiguration utan att gissa.
 */

export const LAUNCH_CONFIG_RELATIVE_PATH = '.freevobe/launch.json';

export interface LaunchConfigInput {
  root: string;
  kind: PreviewKind;
  command: string | null;
  args: string[];
  url: string | null;
  port: number | null;
}

export interface LaunchConfig {
  version: 1;
  kind: PreviewKind;
  command: string | null;
  args: string[];
  url: string | null;
  port: number | null;
  autoStart: true;
  updatedAt: string;
}

export function buildLaunchConfig(input: LaunchConfigInput, now = new Date()): LaunchConfig {
  return {
    version: 1,
    kind: input.kind,
    command: input.command,
    args: [...input.args],
    url: input.url,
    port: input.port,
    autoStart: true,
    updatedAt: now.toISOString(),
  };
}

/** Skriver konfigurationen och returnerar den relativa sökvägen. */
export async function writeLaunchConfig(
  input: LaunchConfigInput,
): Promise<{ path: string; config: LaunchConfig }> {
  const root = path.resolve(input.root);
  const absolute = path.join(root, '.freevobe', 'launch.json');
  const config = buildLaunchConfig(input);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return { path: LAUNCH_CONFIG_RELATIVE_PATH, config };
}
