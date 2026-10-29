import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ConnectorSecretStorageInfo } from '@freevobe/protocol';
import { mask } from '../security/secrets.js';

const VAULT_FILE = 'connectors.vault.json';
const KEY_FILE = 'connectors.key';
const VAULT_VERSION = 1;
const VAULT_CIPHER = 'aes-256-gcm';
const IV_BYTES = 12;

interface VaultEntry {
  iv: string;
  tag: string;
  data: string;
  /** Maskerad ledtråd, beräknad vid skrivtillfället så att den kan visas utan att dekryptera. */
  hint: string;
  updatedAt: number;
}

interface VaultFile {
  version: number;
  /** Skrivs i filen så att ett framtida format kan upptäckas innan något dekrypteras. */
  cipher: string;
  entries: Record<string, VaultEntry>;
}

/**
 * Lagrar connector-tokens krypterat på användarens maskin.
 *
 * Nyckeln är 32 slumpade byte i en egen fil med rättigheten 0600, och butiken är AES-256-GCM.
 * Ingen token skrivs någonsin i klartext, hamnar i databasen eller skickas till modellen – agenten
 * får bara veta att en connector är ansluten och en maskerad ledtråd.
 *
 * OS-keychain (macOS Keychain, Windows Credential Manager, libsecret) är nästa härdning:
 * gränssnittet här är medvetet litet (get/set/delete/hint/info) så att bytet bara rör den här filen.
 */
export class ConnectorSecretStore {
  private readonly dir: string;
  private cachedKey: Buffer | null = null;

  constructor(home: string) {
    this.dir = path.resolve(home);
  }

  get vaultPath(): string {
    return path.join(this.dir, VAULT_FILE);
  }

  get keyPath(): string {
    return path.join(this.dir, KEY_FILE);
  }

  private ensureDir(): void {
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    // mkdir respekterar inte mode på alla plattformar när mappen redan finns.
    try {
      fs.chmodSync(this.dir, 0o700);
    } catch {
      // Windows saknar POSIX-rättigheter – filen skyddas av användarens profil.
    }
  }

  private key(): Buffer {
    if (this.cachedKey) return this.cachedKey;
    this.ensureDir();
    try {
      const existing = fs.readFileSync(this.keyPath);
      if (existing.length !== 32) throw new Error('Nyckelfilen har fel längd.');
      this.cachedKey = existing;
      return existing;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (fs.existsSync(this.vaultPath)) {
      throw new Error(
        'Nyckelfilen saknas men ett valv finns. Återanslut dina connectors – de gamla tokens kan inte läsas.',
      );
    }
    const created = crypto.randomBytes(32);
    fs.writeFileSync(this.keyPath, created, { mode: 0o600 });
    this.restrictPermissions(this.keyPath);
    this.cachedKey = created;
    return created;
  }

  private restrictPermissions(file: string): void {
    try {
      fs.chmodSync(file, 0o600);
    } catch {
      // Se ensureDir: Windows hanterar åtkomsten via användarprofilen.
    }
  }

  private readVault(): VaultFile {
    try {
      const raw = fs.readFileSync(this.vaultPath, 'utf8');
      const parsed = JSON.parse(raw) as VaultFile;
      if (
        parsed.version !== VAULT_VERSION ||
        parsed.cipher !== VAULT_CIPHER ||
        typeof parsed.entries !== 'object'
      ) {
        throw new Error('Valvet har en okänd version.');
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { version: VAULT_VERSION, cipher: VAULT_CIPHER, entries: {} };
      }
      throw new Error(
        `Kunde inte läsa connector-valvet: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private writeVault(vault: VaultFile): void {
    this.ensureDir();
    const temporary = `${this.vaultPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(vault, null, 2)}\n`, { mode: 0o600 });
    this.restrictPermissions(temporary);
    fs.renameSync(temporary, this.vaultPath);
    this.restrictPermissions(this.vaultPath);
  }

  /** Sparar (eller roterar) en token. Returnerar den maskerade ledtråden. */
  set(connectorId: string, secret: string): { hint: string } {
    const value = secret.trim();
    if (value.length < 8) throw new Error('Token är för kort för att vara giltig.');
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const hint = mask(value);

    const vault = this.readVault();
    vault.entries[connectorId] = {
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      data: encrypted.toString('base64'),
      hint,
      updatedAt: Date.now(),
    };
    this.writeVault(vault);
    return { hint };
  }

  /** Läser en token. Används bara av den connector som ska anropa tjänsten – aldrig av prompten. */
  get(connectorId: string): string | null {
    const entry = this.readVault().entries[connectorId];
    if (!entry) return null;
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.key(),
        Buffer.from(entry.iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(entry.tag, 'base64'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(entry.data, 'base64')),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error(
        `Kunde inte dekryptera token för ${connectorId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  hint(connectorId: string): string | undefined {
    return this.readVault().entries[connectorId]?.hint;
  }

  /** Alla maskerade ledtrådar i en läsning – listan över connectors läser valvet en gång. */
  hints(): Record<string, string> {
    return Object.fromEntries(
      Object.entries(this.readVault().entries).map(([id, entry]) => [id, entry.hint]),
    );
  }

  has(connectorId: string): boolean {
    return Boolean(this.readVault().entries[connectorId]);
  }

  delete(connectorId: string): boolean {
    const vault = this.readVault();
    if (!vault.entries[connectorId]) return false;
    delete vault.entries[connectorId];
    this.writeVault(vault);
    return true;
  }

  /** Endast för tester och diagnostik: antalet sparade tokens (aldrig deras innehåll). */
  count(): number {
    return Object.keys(this.readVault().entries).length;
  }

  info(): ConnectorSecretStorageInfo {
    const exists = fs.existsSync(this.vaultPath);
    let restricted = false;
    if (process.platform !== 'win32') {
      try {
        const mode = fs.statSync(this.dir).mode & 0o777;
        restricted = (mode & 0o077) === 0;
      } catch {
        restricted = false;
      }
    }
    return {
      backend: 'encrypted-file',
      cipher: 'aes-256-gcm',
      path: this.vaultPath,
      keychain: false,
      restrictedPermissions: exists ? restricted : true,
    };
  }
}
