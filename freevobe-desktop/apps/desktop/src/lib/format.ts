import { AUTO_APPROVE_CATEGORIES } from '@freevobe/protocol';
import type {
  AgentErrorCode,
  AgentPhase,
  ApprovalCategory,
  PermissionMode,
  RiskLevel,
} from '@freevobe/protocol';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 45) return 'nyss';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min sedan`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h sedan`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d sedan`;
  return new Date(timestamp).toLocaleDateString('sv-SE');
}

export function clockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export const PHASE_LABELS: Record<AgentPhase, string> = {
  idle: 'Redo',
  connecting: 'Ansluter',
  'building-context': 'Bygger kontext',
  thinking: 'Tänker',
  'waiting-approval': 'Väntar på dig',
  'executing-tool': 'Kör verktyg',
  reflecting: 'Reflekterar',
  writing: 'Skriver',
  testing: 'Testar',
  done: 'Klar',
};

export const PERMISSION_LABELS: Record<PermissionMode, string> = {
  ask: 'Fråga alltid',
  'auto-edit': 'Auto-redigera',
  'auto-run': 'Auto-kör',
  'full-auto': 'Full auto',
};

export const PERMISSION_DESCRIPTIONS: Record<PermissionMode, string> = {
  ask: 'Varje filändring och varje kommando visas för dig först.',
  'auto-edit': 'Filändringar sparas efter att du sett diffen. Kommandon kräver godkännande.',
  'auto-run': 'Filändringar och kommandon körs utan frågor. Farliga kommandon stoppas fortfarande.',
  'full-auto':
    'Agenten arbetar självständigt. Farliga kommandon och skrivningar utanför projektet stoppas ändå.',
};

export const AUTO_APPROVE_LABELS: Record<ApprovalCategory, string> = {
  file_write: 'Filändringar',
  command: 'Kommandon',
  test: 'Tester',
  git: 'Git-operationer',
  network: 'Nätverksanrop',
  mcp: 'MCP-verktyg',
  browser: 'Webbläsare',
  other: 'Övrigt',
};

export const AUTO_APPROVE_DESCRIPTIONS: Record<ApprovalCategory, string> = {
  file_write: 'Skapa, ändra och ta bort filer i projektet utan att fråga.',
  command: 'Köra vanliga terminalkommandon utan att fråga.',
  test: 'Köra projektets testkommando utan att fråga.',
  git: 'Skapa commits och byta branch utan att fråga.',
  network: 'Hämta webbsidor utan att fråga (hemligheter blockeras ändå).',
  mcp: 'Anropa redan godkända MCP-servrar utan att fråga varje gång.',
  browser: 'Kräver alltid ett personligt ja och går inte att auto-godkänna.',
  other: 'Kräver alltid ett personligt ja och går inte att auto-godkänna.',
};

/** Kategorier som faktiskt går att slå på i gränssnittet. */
export const TOGGLEABLE_AUTO_APPROVE = AUTO_APPROVE_CATEGORIES;

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Låg risk',
  medium: 'Medelrisk',
  high: 'Hög risk',
};

export const ERROR_LABELS: Record<AgentErrorCode, string> = {
  ollama_unavailable: 'Ollama svarar inte',
  model_missing: 'Modellen saknas',
  tool_not_found: 'Verktyget finns inte',
  tool_invalid_args: 'Ogiltiga argument',
  tool_failed: 'Verktyget misslyckades',
  policy_blocked: 'Blockerat av säkerhetsregeln',
  approval_rejected: 'Du avvisade åtgärden',
  loop_limit: 'Varvgränsen nåddes',
  aborted: 'Avbruten',
  context_budget_exceeded: 'Kontexten blev för stor',
  transport_error: 'Anslutningsfel',
  verification_failed: 'Verifieringen kunde inte köras',
  internal_error: 'Internt fel',
};

export function shortPath(path: string, maxLength = 42): string {
  if (path.length <= maxLength) return path;
  const parts = path.split('/');
  const file = parts.pop() ?? path;
  const head = parts.shift() ?? '';
  return `${head}/…/${file}`;
}
