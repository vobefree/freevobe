/**
 * Connectors: frivilliga bryggor till externa tjänster (GitHub, Vercel, Supabase …).
 *
 * Protokollet beskriver bara FORMEN. Alla etiketter översätts i UI:t utifrån id, så att
 * servern aldrig behöver skicka språkberoende text. Hemligheter (tokens) finns aldrig med i
 * någon av dessa typer – de lagras krypterat lokalt och lämnas bara ut som en maskerad ledtråd.
 */

export const CONNECTOR_IDS = [
  'git',
  'github',
  'vercel',
  'supabase',
  'netlify',
  'railway',
  'stripe',
  'resend',
  'cloudflare',
  'neon',
] as const;

export type ConnectorId = (typeof CONNECTOR_IDS)[number];

/** `local` betyder att verktygen redan finns i appen och inte kräver någon nyckel. */
export type ConnectorAuthType = 'oauth' | 'token' | 'api_key' | 'local';

export type ConnectorAvailability = 'available' | 'coming-soon';

export type ConnectorStatus = 'connected' | 'disconnected' | 'error';

/** Behörigheter som connectorn ber om. Id:t är stabilt; texten bor i locale-filerna. */
export interface ConnectorScope {
  id: string;
  /** Sant när connectorn inte fungerar utan behörigheten. */
  required: boolean;
}

export interface ConnectorToolDescriptor {
  /** Verktygets namn i agentens verktygslista, t.ex. `vercel_deploy`. */
  id: string;
  /** Sant för åtgärder som raderar, skriver över eller publicerar. Kräver alltid ett ja. */
  destructive: boolean;
  requiresApproval: boolean;
  /** Sant när verktyget är implementerat. Fram till dess visas det som planerat. */
  implemented: boolean;
}

export interface ConnectorDefinition {
  id: ConnectorId;
  /** Två tecken som visas i kortets ikonplatta, t.ex. `GH`. */
  icon: string;
  authType: ConnectorAuthType;
  availability: ConnectorAvailability;
  /** Inbyggd i appen (lokal git) – ingen anslutning behövs. */
  builtin: boolean;
  /** Sant när användaren kan ansluta med en egen token redan nu. */
  acceptsToken: boolean;
  /** Var användaren skapar en token. */
  tokenUrl?: string;
  scopes: ConnectorScope[];
  tools: ConnectorToolDescriptor[];
}

/** Läget för en connector i ett projekt. Statusen räknas fram, den lagras inte som sanning. */
export interface ConnectorState {
  connectorId: ConnectorId;
  status: ConnectorStatus;
  /** Aktiv i det här projektet. Ett frånkopplat projekt rör inte de andra. */
  enabled: boolean;
  /** Maskerad ledtråd till token, t.ex. `ghp_ab…1234`. Aldrig värdet självt. */
  secretHint?: string;
  accountLabel?: string;
  lastError?: string;
  updatedAt: number;
}

export interface ConnectorView {
  definition: ConnectorDefinition;
  state: ConnectorState;
}

/** Var hemligheterna ligger och hur de skyddas. Visas i UI:t så att det går att granska. */
export interface ConnectorSecretStorageInfo {
  backend: 'encrypted-file';
  cipher: 'aes-256-gcm';
  /** Filsökvägen till den krypterade butiken (aldrig nyckeln). */
  path: string;
  /** Sant när nyckeln ligger i OS:ets keychain. Fram till dess: krypterad fil med 0600. */
  keychain: boolean;
  /** Sant när nyckelfilen och butiken bara är läsbara för användaren. */
  restrictedPermissions: boolean;
}

export interface ConnectorDisconnectResult {
  view: ConnectorView;
  /** De behörigheter som inte längre används – visas för användaren efter frånkoppling. */
  revokedScopes: string[];
}

export interface ConnectorsResponse {
  connectors: ConnectorView[];
  storage: ConnectorSecretStorageInfo;
}
