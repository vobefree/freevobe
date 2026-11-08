import { describe, expect, it } from 'vitest';
import { isSensitivePath, sensitivePathRefusal } from './sensitive.js';

describe('isSensitivePath', () => {
  it('känner igen hemlighetsfiler', () => {
    for (const candidate of [
      '.env',
      '.env.local',
      'config/.env.production',
      'id_rsa',
      'keys/id_ed25519',
      '.ssh/config',
      '.aws/credentials',
      'certs/server.pem',
      'tls/client.key',
      'secrets.json',
      'ops/credentials.yaml',
      '.netrc',
      '.npmrc',
    ]) {
      expect(isSensitivePath(candidate), candidate).toBe(true);
    }
  });

  it('lämnar vanliga filer i fred', () => {
    for (const candidate of [
      'src/app.ts',
      'env.ts',
      'src/environment.ts',
      'docs/keys.md',
      'packages/agent-core/src/security/sensitive.ts',
      'public/logo.png',
    ]) {
      expect(isSensitivePath(candidate), candidate).toBe(false);
    }
  });

  it('tillåter mallar som inte innehåller hemligheter', () => {
    expect(isSensitivePath('.env.example')).toBe(false);
    expect(isSensitivePath('.env.sample')).toBe(false);
    expect(isSensitivePath('.env.template')).toBe(false);
  });

  it('hanterar Windows-sökvägar', () => {
    expect(isSensitivePath('C:\\projekt\\.env')).toBe(true);
    expect(isSensitivePath('src\\index.ts')).toBe(false);
  });

  it('förklarar avslaget begripligt', () => {
    expect(sensitivePathRefusal('src/app.ts')).toBeNull();
    const message = sensitivePathRefusal('.env');
    expect(message).toContain('.env');
    expect(message).toContain('hemligheter');
  });
});
