/**
 * Parning mellan telefonen och skrivbordet: tolkning av det skrivbordet visar (QR-kod, kod eller
 * adress) samt en säkerhetsbedömning av adressen.
 *
 * Filen är avsiktligt ren och utan nätverk eller React, eftersom det är här felaktig indata ska
 * fångas – och för att den ska kunna enhetstestas rakt av.
 */

export interface ParsedPairing {
  url: string;
  token: string;
  label?: string;
}

export class PairingError extends Error {
  readonly field: 'payload' | 'host' | 'token';

  constructor(field: 'payload' | 'host' | 'token', message: string) {
    super(message);
    this.name = 'PairingError';
    this.field = field;
  }
}

const DEFAULT_PORT = '4319';

/** Token ska vara en hemlighet, inte en gissning: minst 16 tecken utan blanksteg. */
export function isValidToken(token: string): boolean {
  return token.trim().length >= 16 && !/\s/.test(token.trim());
}

export function assertValidToken(token: string): string {
  const trimmed = token.trim();
  if (!isValidToken(trimmed)) {
    throw new PairingError(
      'token',
      'Parningskoden ser fel ut. Kopiera hela koden från Freevobe Desktop (minst 16 tecken).',
    );
  }
  return trimmed;
}

/**
 * Adressen normaliseras till `http://host:port` utan avslutande snedstreck. Saknas port används
 * skrivbordets standardport.
 */
export function normalizeHostUrl(input: {
  host: string;
  port?: string;
  scheme?: 'http' | 'https';
  defaultPort?: string;
}): string {
  const raw = input.host.trim();
  if (raw === '') throw new PairingError('host', 'Ange datorns adress, t.ex. 192.168.1.20.');

  // Tillåter att hela adressen klistras in, med eller utan protokoll.
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `${input.scheme ?? 'http'}://${raw}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new PairingError('host', `"${raw}" är inte en giltig adress.`);
  }

  const port = input.port?.trim() || parsed.port || input.defaultPort || DEFAULT_PORT;
  if (!/^\d{1,5}$/.test(port) || Number(port) > 65535) {
    throw new PairingError('host', `"${port}" är inte en giltig port.`);
  }

  if (!parsed.hostname) throw new PairingError('host', `"${raw}" saknar datornamn.`);
  return `${parsed.protocol}//${parsed.hostname}:${port}`;
}

/**
 * Skrivbordet visar en QR-kod och en kod. Båda bär samma sak: adress och token. Vi accepterar
 * JSON-nyttolasten från QR-koden och en `freevobe://pair?...`-länk, så att både kamera, urklipp och
 * handskriven kod fungerar.
 */
export function parsePairingPayload(payload: string): ParsedPairing {
  const trimmed = payload.trim();
  if (trimmed === '') throw new PairingError('payload', 'Inget att läsa av.');

  const asJson = tryParseJson(trimmed);
  if (asJson) {
    const url = firstString(asJson.url) ?? firstString(asJson.baseUrl) ?? firstString(asJson.address);
    const token = firstString(asJson.token) ?? firstString(asJson.pairingToken);
    if (!url || !token) {
      throw new PairingError('payload', 'QR-koden saknar adress eller parningskod.');
    }
    return {
      url: normalizeHostUrl({ host: url }),
      token: assertValidToken(token),
      ...(firstString(asJson.name) ?? firstString(asJson.label)
        ? { label: (firstString(asJson.name) ?? firstString(asJson.label)) as string }
        : {}),
    };
  }

  if (/^freevobe:\/\//i.test(trimmed)) {
    const query = trimmed.slice(trimmed.indexOf('?') + 1);
    const params = new URLSearchParams(query);
    const url = params.get('url') ?? params.get('host');
    const token = params.get('token');
    if (!url || !token) throw new PairingError('payload', 'Länken saknar adress eller parningskod.');
    const label = params.get('name') ?? params.get('label');
    return {
      url: normalizeHostUrl({ host: url, port: params.get('port') ?? undefined }),
      token: assertValidToken(token),
      ...(label ? { label } : {}),
    };
  }

  // Sista utvägen: "host:port token" som en rad, så att koden kan klistras in för hand.
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return {
      url: normalizeHostUrl({ host: parts[0] }),
      token: assertValidToken(parts[1]),
    };
  }

  throw new PairingError('payload', 'Kunde inte tolka parningen. Skanna QR-koden igen.');
}

function tryParseJson(value: string): Record<string, unknown> | null {
  if (!value.startsWith('{')) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function firstString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

// ---------------------------------------------------------------------------
// Säkerhetsbedömning
// ---------------------------------------------------------------------------

export type EndpointSecurityLevel = 'secure' | 'loopback' | 'insecure-lan' | 'insecure-remote';

export interface EndpointSecurity {
  level: EndpointSecurityLevel;
  /** Sant när användaren måste bekräfta att trafiken är okrypterad. */
  requiresConfirmation: boolean;
  /** Sant när adressen inte får användas alls i v1. */
  blocked: boolean;
  message: string;
}

const LOOPBACK = /^(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[::1\]|::1)$/i;
const PRIVATE_IPV4 = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/;

/**
 * Bedömer hur säker en adress är. Skrivbordet talar HTTP på det lokala nätet och v1 skickar därför
 * parningstoken okrypterad över nätet – det står i README och appen varnar innan användaren kopplar
 * upp mot något annat än sin egen dator.
 */
export function assessEndpointSecurity(url: string): EndpointSecurity {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      level: 'insecure-remote',
      requiresConfirmation: true,
      blocked: true,
      message: `"${url}" är inte en giltig adress.`,
    };
  }

  if (parsed.protocol === 'https:') {
    return {
      level: 'secure',
      requiresConfirmation: false,
      blocked: false,
      message: 'Trafiken är krypterad med HTTPS.',
    };
  }

  const host = parsed.hostname;
  if (LOOPBACK.test(host)) {
    return {
      level: 'loopback',
      requiresConfirmation: false,
      blocked: false,
      message: 'Anslutningen stannar på datorn själv.',
    };
  }

  const isLan = PRIVATE_IPV4.test(host) || /\.local$/i.test(host);
  if (isLan) {
    return {
      level: 'insecure-lan',
      requiresConfirmation: true,
      blocked: false,
      message:
        'Trafiken går okrypterad över ditt lokala nätverk. Para bara ihop med datorer du litar på – och undvik öppna nätverk.',
    };
  }

  return {
    level: 'insecure-remote',
    requiresConfirmation: true,
    blocked: true,
    message:
      'Adressen ligger utanför ditt lokala nätverk. I v1 ansluter appen bara till en dator på samma nätverk – använd en VPN eller HTTPS-tunnel i stället.',
  };
}
