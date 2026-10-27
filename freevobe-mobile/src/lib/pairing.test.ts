import { describe, expect, it } from 'vitest';
import {
  assessEndpointSecurity,
  isValidToken,
  normalizeHostUrl,
  PairingError,
  parsePairingPayload,
} from './pairing';

const TOKEN = 'fvb_9f3c1d7a4b2e6085';

describe('normalizeHostUrl', () => {
  it('lägger till protokoll och standardport', () => {
    expect(normalizeHostUrl({ host: '192.168.1.20' })).toBe('http://192.168.1.20:4319');
    expect(normalizeHostUrl({ host: '192.168.1.20', port: '5000' })).toBe('http://192.168.1.20:5000');
  });

  it('behåller protokoll och port som klistras in', () => {
    expect(normalizeHostUrl({ host: 'https://hemma.local:8443' })).toBe('https://hemma.local:8443');
    // En angiven port i fältet vinner över den som stod i adressen.
    expect(normalizeHostUrl({ host: 'http://10.0.0.5:1234', port: '4319' })).toBe(
      'http://10.0.0.5:4319',
    );
  });

  it('tar bort avslutande snedstreck och mellanslag', () => {
    expect(normalizeHostUrl({ host: '  10.0.0.5/  ' })).toBe('http://10.0.0.5:4319');
  });

  it('vägrar tomma och ogiltiga adresser', () => {
    expect(() => normalizeHostUrl({ host: '   ' })).toThrow(PairingError);
    expect(() => normalizeHostUrl({ host: '10.0.0.5', port: '99999' })).toThrow(PairingError);
    expect(() => normalizeHostUrl({ host: '10.0.0.5', port: 'abc' })).toThrow(PairingError);
  });
});

describe('parsePairingPayload', () => {
  it('läser JSON-nyttolasten från QR-koden', () => {
    const parsed = parsePairingPayload(
      JSON.stringify({ url: 'http://192.168.1.20:4319', token: TOKEN, name: 'studio-pc' }),
    );
    expect(parsed).toEqual({ url: 'http://192.168.1.20:4319', token: TOKEN, label: 'studio-pc' });
  });

  it('läser freevobe://-länken', () => {
    const parsed = parsePairingPayload(`freevobe://pair?host=10.0.0.7&port=4319&token=${TOKEN}`);
    expect(parsed.url).toBe('http://10.0.0.7:4319');
    expect(parsed.token).toBe(TOKEN);
  });

  it('läser "adress token" från en inklistrad rad', () => {
    const parsed = parsePairingPayload(`192.168.1.30:4319 ${TOKEN}`);
    expect(parsed.url).toBe('http://192.168.1.30:4319');
    expect(parsed.token).toBe(TOKEN);
  });

  it('vägrar en QR-kod utan token och en för kort kod', () => {
    expect(() => parsePairingPayload(JSON.stringify({ url: 'http://10.0.0.5' }))).toThrow(PairingError);
    expect(() => parsePairingPayload(JSON.stringify({ url: 'http://10.0.0.5', token: 'kort' }))).toThrow(
      PairingError,
    );
  });

  it('vägrar tomt innehåll', () => {
    expect(() => parsePairingPayload('   ')).toThrow(PairingError);
  });
});

describe('isValidToken', () => {
  it('kräver minst 16 tecken utan blanksteg', () => {
    expect(isValidToken(TOKEN)).toBe(true);
    expect(isValidToken('kort')).toBe(false);
    expect(isValidToken('har blanksteg i sig')).toBe(false);
  });
});

describe('assessEndpointSecurity', () => {
  it('godkänner loopback utan varning', () => {
    const result = assessEndpointSecurity('http://127.0.0.1:4319');
    expect(result.level).toBe('loopback');
    expect(result.requiresConfirmation).toBe(false);
    expect(result.blocked).toBe(false);
  });

  it('varnar men tillåter okrypterat lokalt nätverk', () => {
    const result = assessEndpointSecurity('http://192.168.1.20:4319');
    expect(result.level).toBe('insecure-lan');
    expect(result.requiresConfirmation).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.message).toContain('okrypterad');
  });

  it('tillåter https utan varning', () => {
    const result = assessEndpointSecurity('https://fri.example:443');
    expect(result.level).toBe('secure');
    expect(result.blocked).toBe(false);
  });

  it('blockerar http mot en adress utanför nätverket', () => {
    const result = assessEndpointSecurity('http://8.8.8.8:4319');
    expect(result.level).toBe('insecure-remote');
    expect(result.blocked).toBe(true);
  });

  it('blockerar en ogiltig adress', () => {
    expect(assessEndpointSecurity('inte en url').blocked).toBe(true);
  });
});
