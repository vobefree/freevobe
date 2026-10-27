import { randomUUID, createHash } from 'node:crypto';

export function createId(prefix?: string): string {
  const id = randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

export function hashSha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function shortHash(input: string | Buffer, length = 12): string {
  return hashSha256(input).slice(0, length);
}

export function now(): number {
  return Date.now();
}
