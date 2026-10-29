import { AUTO_APPROVE_CATEGORIES } from '@freevobe/protocol';
import type {
  AgentErrorCode,
  AgentPhase,
  ApprovalCategory,
  PermissionMode,
  RiskLevel,
} from '@freevobe/protocol';
import i18n, { currentLocale } from '../i18n';

/** Formaterar tal enligt valt språk (t.ex. tusentalsavgränsare). */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(currentLocale()).format(value);
}

/** Datum enligt valt språk. Faller tillbaka på ISO-datum om Intl inte klarar taggen. */
export function formatDate(
  timestamp: number | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  const locale = currentLocale();
  try {
    return new Intl.DateTimeFormat(locale, options ?? { dateStyle: 'medium' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  const rounded = value >= 10 || index === 0 ? Math.round(value) : Number(value.toFixed(1));
  return `${formatNumber(rounded)} ${units[index]}`;
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 45) return i18n.t('time.justNow');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return i18n.t('time.minutes', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return i18n.t('time.hours', { count: hours });
  const days = Math.round(hours / 24);
  if (days < 30) return i18n.t('time.days', { count: days });
  return formatDate(timestamp);
}

export function clockTime(timestamp: number): string {
  return formatDate(timestamp, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Etikettabeller som läses vid varje anrop. Komponenter som renderar dem använder useTranslation,
 * så de ritas om direkt när språket byts – ingen omstart behövs.
 */
function labelMap<T extends string>(path: (key: T) => string): Record<T, string> {
  return new Proxy({} as Record<T, string>, {
    get: (_target, property) =>
      typeof property === 'string' ? i18n.t(path(property as T)) : undefined,
    has: () => true,
  });
}

export const PHASE_LABELS: Record<AgentPhase, string> = labelMap<AgentPhase>(
  (phase) => `phase.${phase}`,
);

export const PERMISSION_LABELS: Record<PermissionMode, string> = labelMap<PermissionMode>(
  (mode) => `permission.${mode}`,
);

export const PERMISSION_DESCRIPTIONS: Record<PermissionMode, string> = labelMap<PermissionMode>(
  (mode) => `permission.desc.${mode}`,
);

export const AUTO_APPROVE_LABELS: Record<ApprovalCategory, string> = labelMap<ApprovalCategory>(
  (category) => `autoApprove.${category}`,
);

export const AUTO_APPROVE_DESCRIPTIONS: Record<ApprovalCategory, string> =
  labelMap<ApprovalCategory>((category) => `autoApprove.desc.${category}`);

/** Kategorier som faktiskt går att slå på i gränssnittet. */
export const TOGGLEABLE_AUTO_APPROVE = AUTO_APPROVE_CATEGORIES;

export const RISK_LABELS: Record<RiskLevel, string> = labelMap<RiskLevel>(
  (level) => `risk.${level}`,
);

export const ERROR_LABELS: Record<AgentErrorCode, string> = labelMap<AgentErrorCode>(
  (code) => `error.${code}`,
);

export function shortPath(path: string, maxLength = 42): string {
  if (path.length <= maxLength) return path;
  const parts = path.split('/');
  const file = parts.pop() ?? path;
  const head = parts.shift() ?? '';
  return `${head}/…/${file}`;
}
