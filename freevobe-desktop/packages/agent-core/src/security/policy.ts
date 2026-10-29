import type { ApprovalCategory, PermissionMode, RiskLevel, ToolSpec } from '@freevobe/protocol';
import { AUTO_APPROVE_CATEGORIES } from '@freevobe/protocol';
import { normalizeSlashes } from '../util/text.js';
import { resolveProjectPath } from './paths.js';
import { scanForSecrets } from './secrets.js';

export type PolicyDecision =
  | { effect: 'allow'; reason: string }
  | {
      effect: 'require-approval';
      risk: RiskLevel;
      reason: string;
      hardBlock: boolean;
      detail?: string;
    }
  | { effect: 'block'; reason: string; detail?: string };

export interface PolicyContext {
  root: string;
  mode: PermissionMode;
  browserAutomationEnabled: boolean;
  /** Sant när användaren redan godkänt en MCP-server i den här sessionen. */
  mcpServerApproved: (server: string) => boolean;
  /** Kategorier användaren valt att auto-godkänna. Påverkar aldrig hårda block. */
  autoApprove?: Partial<Record<ApprovalCategory, boolean>>;
}

const RISK_ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

export function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_ORDER[a] >= RISK_ORDER[b] ? a : b;
}

interface DangerRule {
  id: string;
  label: string;
  test: (command: string, argv: string[]) => boolean;
  /** block = körs aldrig. approval = kräver användarens uttryckliga ja, även i full-auto. */
  effect: 'block' | 'approval';
  risk: RiskLevel;
}

const ROOT_COMMANDS = ['sudo', 'doas', 'pkexec', 'runas'];

function tokens(command: string): string[] {
  return command
    .split(/[\s|;&()<>]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

function looksLikeRootTarget(target: string): boolean {
  const normalized = normalizeSlashes(target.trim().replace(/^['"]|['"]$/g, ''));
  if (
    normalized === '/' ||
    normalized === '/*' ||
    normalized === '~' ||
    normalized === '~/' ||
    normalized === '$home'
  ) {
    return true;
  }
  if (/^\/\*?$/.test(normalized)) return true;
  if (/^[a-z]:[\\/]?$/i.test(normalized)) return true;
  if (normalized.includes('..')) return true;
  if (/^(\/etc|\/usr|\/bin|\/var|\/home|\/users|\/system|\/windows)/i.test(normalized)) return true;
  return false;
}

/** Regler som gäller oavsett behörighetsläge. */
export const DANGER_RULES: DangerRule[] = [
  {
    id: 'privilege-escalation',
    label: 'Kommando som kräver administratörsrättigheter',
    test: (_command, argv) => argv.some((token) => ROOT_COMMANDS.includes(token)),
    effect: 'block',
    risk: 'high',
  },
  {
    id: 'recursive-root-delete',
    label: 'Rekursiv radering av rot, hemkatalog eller förälderkatalog',
    test: (_command, argv) => {
      const rmIndex = argv.findIndex(
        (token) => token === 'rm' || token === 'rmdir' || token === 'del' || token === 'rd',
      );
      if (rmIndex === -1) return false;
      const rest = argv.slice(rmIndex + 1);
      const recursive = rest.some(
        (token) => /^-[a-z]*r/i.test(token) || token === '/s' || token === '/q',
      );
      const targets = rest.filter(
        (token) => !token.startsWith('-') && !token.startsWith('/s') && !token.startsWith('/q'),
      );
      const nonFlagTargets = targets.filter((token) => !token.startsWith('/'));
      return recursive && (nonFlagTargets.length === 0 || nonFlagTargets.some(looksLikeRootTarget));
    },
    effect: 'block',
    risk: 'high',
  },
  {
    id: 'disk-destroy',
    label: 'Formatering eller råskrivning till disk',
    test: (_command, argv) =>
      argv.some((token) =>
        ['format', 'diskpart', 'mkfs', 'mkfs.ext4', 'fdisk', 'wipefs', 'shred'].includes(token),
      ) ||
      argv.some(
        (token) =>
          token.startsWith('of=/dev/') ||
          token.startsWith('/dev/sd') ||
          token.startsWith('/dev/nvme'),
      ),
    effect: 'block',
    risk: 'high',
  },
  {
    id: 'shell-fork-bomb',
    label: 'Fork bomb eller oändlig loop i skalet',
    test: (command) =>
      /:\(\)\s*\{.*\}\s*;?\s*:/.test(command) ||
      /while\s+true\s*;?\s*do\s*:\s*;?\s*done/.test(command),
    effect: 'block',
    risk: 'high',
  },
  {
    id: 'system-power',
    label: 'Stänga av eller starta om maskinen',
    test: (_command, argv) =>
      argv.some((token) => ['shutdown', 'reboot', 'halt', 'poweroff'].includes(token)),
    effect: 'block',
    risk: 'high',
  },
  {
    id: 'port-exposure',
    label: 'Exponera port mot nätet eller starta tunnel',
    test: (command) =>
      /(?:--host|--bind|-H)\s*=?\s*(?:0\.0\.0\.0|\[::\])/.test(command) ||
      /\b(?:0\.0\.0\.0|\[::\]):\d+/.test(command) ||
      /\b(?:ngrok|serveo|localtunnel|cloudflared)\b/.test(command) ||
      /ssh\s+-R\b/.test(command),
    effect: 'approval',
    risk: 'high',
  },
  {
    id: 'secret-exfiltration',
    label: 'Skicka miljövariabler eller hemligheter till en extern tjänst',
    test: (command) => {
      const sends = /\b(?:curl|wget|Invoke-WebRequest|Invoke-RestMethod|nc|ncat|http)\b/i.test(
        command,
      );
      const withEnv = /\$\{?(?:[A-Z_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z_]*)\}?/.test(
        command,
      );
      const printsEnv = /\b(?:printenv|env|set)\b\s*\|/.test(command);
      return sends && (withEnv || printsEnv);
    },
    effect: 'block',
    risk: 'high',
  },
  {
    id: 'history-rewrite',
    label: 'Skriva om git-historik eller tvinga push',
    test: (command) =>
      /\bgit\s+push\b.*(?:--force(?!-with-lease)|-f)\b/.test(command) ||
      /\bgit\s+(?:reset\s+--hard|filter-branch|rebase\s+-i)\b/.test(command),
    effect: 'approval',
    risk: 'high',
  },
  {
    id: 'global-install',
    label: 'Installera program globalt på systemet',
    test: (command) =>
      /\b(?:npm|pnpm|yarn|bun)\s+(?:i|install|add)\s+(?:-g|--global)\b/.test(command) ||
      /\b(?:apt-get|apt|brew|choco|winget|snap|pacman)\s+(?:install|upgrade)\b/.test(command),
    effect: 'approval',
    risk: 'medium',
  },
  {
    id: 'outside-root-write',
    label: 'Skriva till en sökväg utanför projektet',
    test: (command) => {
      const match = command.match(/>{1,2}\s*["']?([^\s"';|]+)/g);
      if (!match) return false;
      return match.some((redirect) => {
        const target = redirect.replace(/^>{1,2}\s*/, '').replace(/^["']|["']$/g, '');
        if (!target) return false;
        if (target.startsWith('&') || target === '/dev/null' || target === 'nul') return false;
        return looksLikeRootTarget(target);
      });
    },
    effect: 'block',
    risk: 'high',
  },
];

export interface CommandRisk {
  decision: PolicyDecision;
  matchedRules: string[];
}

/** Bedömer ett skal-kommando. Returnerar det strängaste utfallet av alla matchande regler. */
export function evaluateCommand(command: string): CommandRisk {
  const argv = tokens(command);
  const matched: string[] = [];
  let decision: PolicyDecision = { effect: 'allow', reason: 'Inga farliga mönster hittades.' };
  let worst: RiskLevel = 'low';
  let hasBlock = false;

  for (const rule of DANGER_RULES) {
    if (!rule.test(command, argv)) continue;
    matched.push(rule.label);
    if (rule.effect === 'block') {
      hasBlock = true;
      worst = maxRisk(worst, rule.risk);
      decision = {
        effect: 'block',
        reason: `Blockerat av säkerhetsregeln "${rule.label}".`,
        detail:
          'Regeln gäller även i läget Full auto. Kör kommandot själv i terminalen om du verkligen vill.',
      };
    } else if (!hasBlock) {
      worst = maxRisk(worst, rule.risk);
      decision = {
        effect: 'require-approval',
        risk: rule.risk,
        reason: `Kräver godkännande: ${rule.label}.`,
        hardBlock: true,
      };
    }
  }

  if (decision.effect === 'require-approval') decision.risk = worst;
  return { decision, matchedRules: matched };
}

/**
 * Sant när ett verktygsanrop ser ut att bära en hemlighet: antingen ett värde som matchar ett
 * känt nyckelmönster, eller ett fält som heter apiKey/token/password med ett långt värde.
 */
export function looksLikeSecretPayload(payload: string): boolean {
  if (scanForSecrets(payload).length > 0) return true;
  return /"[^"\n]*(?:api[_-]?key|apikey|secret|token|password|passwd|credential|authorization)[^"\n]*"\s*:\s*"[^"]{8,}"/i.test(
    payload,
  );
}

const FILE_WRITE_TOOLS = new Set(['write_file', 'edit_file', 'create_file', 'delete_file']);
const BROWSER_TOOLS = new Set([
  'browser_open',
  'browser_read',
  'browser_screenshot',
  'browser_click',
  'browser_fill',
]);
const NETWORK_TOOLS = new Set(['web_fetch']);

export interface ToolEvaluationInput {
  spec: ToolSpec;
  args: Record<string, unknown>;
}

/**
 * Bedömer ett verktygsanrop utifrån behörighetsläge, verktygets farlighetsgrad och säkerhetsregler.
 * Beslutet är alltid "fail closed": okända MCP-verktyg kräver godkännande.
 */
export function evaluateToolCall(
  input: ToolEvaluationInput,
  context: PolicyContext,
): PolicyDecision {
  const { spec, args } = input;

  // 1. Hårda regler som gäller oavsett läge.
  if (spec.name === 'run_terminal_command' || spec.name === 'run_tests') {
    const command = typeof args.command === 'string' ? args.command : '';
    const risk = evaluateCommand(command);
    if (risk.decision.effect !== 'allow') return risk.decision;
  }

  // 2. Sökvägskontroll för filverktyg: utanför projektroten är alltid blockerat.
  if (FILE_WRITE_TOOLS.has(spec.name)) {
    const candidate =
      (typeof args.path === 'string' && args.path) ||
      (typeof args.file === 'string' && args.file) ||
      (typeof args.target === 'string' && args.target) ||
      '';
    if (!candidate) {
      return { effect: 'block', reason: 'Verktygsanropet saknar en sökväg.' };
    }
    const resolved = resolveProjectPath(context.root, candidate);
    if (!resolved.ok) {
      return {
        effect: 'block',
        reason: resolved.reason ?? 'Ogiltig sökväg.',
        detail: 'Freevobe får bara ändra filer i projektet.',
      };
    }
  }

  // 3. Webbläsarautomation kräver alltid användarens ja.
  if (BROWSER_TOOLS.has(spec.name)) {
    if (!context.browserAutomationEnabled) {
      return {
        effect: 'block',
        reason: 'Webbläsarautomation är avstängd i inställningarna.',
        detail: 'Slå på webbläsarautomation i Inställningar → Verktyg för att tillåta detta.',
      };
    }
    return applyCategoryAutoApprove(
      spec,
      {
        effect: 'require-approval',
        risk: 'medium',
        reason: 'Webbläsarautomation kräver alltid ditt godkännande.',
        hardBlock: true,
      },
      context.autoApprove,
    );
  }

  // 4. Nätverksanrop: kontrollera att inga hemligheter skickas ut.
  if (NETWORK_TOOLS.has(spec.name)) {
    const payload = JSON.stringify(args);
    if (looksLikeSecretPayload(payload)) {
      return {
        effect: 'block',
        reason: 'Anropet ser ut att innehålla en hemlighet.',
        detail:
          'Freevobe skickar aldrig nycklar eller lösenord till externa tjänster utan att du granskat dem.',
      };
    }
    if (context.mode === 'full-auto') {
      return {
        effect: 'allow',
        reason: 'Nätverksanrop tillåts i Full auto (inga hemligheter hittades).',
      };
    }
    return applyCategoryAutoApprove(
      spec,
      {
        effect: 'require-approval',
        risk: 'low',
        reason: 'Nätverksanrop kräver godkännande.',
        hardBlock: false,
      },
      context.autoApprove,
    );
  }

  // 5. MCP-verktyg: fail closed.
  if (spec.source === 'mcp') {
    if (!context.mcpServerApproved(spec.origin?.server ?? '')) {
      return {
        effect: 'require-approval',
        risk: 'high',
        reason: `MCP-servern "${spec.origin?.server ?? 'okänd'}" är inte godkänd än.`,
        hardBlock: true,
      };
    }
    if (context.mode === 'full-auto') {
      return { effect: 'allow', reason: 'MCP-verktyg tillåts i Full auto (servern är godkänd).' };
    }
    return applyCategoryAutoApprove(
      spec,
      {
        effect: 'require-approval',
        risk: 'medium',
        reason: 'MCP-verktyg kräver godkännande.',
        hardBlock: false,
      },
      context.autoApprove,
    );
  }

  // 6. Connector-verktyg: läsning följer läget, men ändringar i en extern tjänst kräver alltid
  //    ett personligt ja – även i Full auto. Produktionsdeploy har dessutom ett extra steg i
  //    verktyget självt (vercel_deploy frågar igen när målet är produktion).
  if (spec.source === 'connector') {
    const label = spec.connectorId ? `connectorn "${spec.connectorId}"` : 'en connector';
    if (spec.danger === 'safe' || spec.danger === 'network') {
      if (context.mode === 'full-auto') {
        return { effect: 'allow', reason: `Läsning från ${label} tillåts i Full auto.` };
      }
      return applyCategoryAutoApprove(
        spec,
        {
          effect: 'require-approval',
          risk: 'low',
          reason: `Läsning från ${label} kräver godkännande.`,
          hardBlock: false,
        },
        context.autoApprove,
      );
    }
    return {
      effect: 'require-approval',
      risk: spec.danger === 'execute' ? 'high' : 'medium',
      reason: `Ändringar i ${label} kräver alltid ditt godkännande.`,
      hardBlock: true,
    };
  }

  // 7. Behörighetsläget avgör resten.
  const isWrite = FILE_WRITE_TOOLS.has(spec.name);
  const isExecute = spec.name === 'run_terminal_command' || spec.name === 'run_tests';
  const isVcs = spec.name === 'git_commit' || spec.name === 'git_branch';

  if (spec.alwaysRequiresApproval) {
    return {
      effect: 'require-approval',
      risk: 'low',
      reason: 'Verktyget kräver alltid godkännande.',
      hardBlock: true,
    };
  }

  const modeDecision = evaluateMode(context.mode, { isWrite, isExecute, isVcs });
  return applyCategoryAutoApprove(spec, modeDecision, context.autoApprove);
}

/**
 * Verktygets kategori. Används både för att kunna auto-godkänna en hel kategori i taget och för
 * att förklara för användaren vad ett godkännande gäller.
 */
export function toolCategory(spec: ToolSpec): ApprovalCategory {
  if (spec.source === 'mcp') return 'mcp';
  // Connector-anrop är nätverksanrop; kategorin "network" kan därför auto-godkännas av den som
  // vill – men bara för läsande verktyg, eftersom ändringar alltid är hårda.
  if (spec.source === 'connector') return 'network';
  if (FILE_WRITE_TOOLS.has(spec.name)) return 'file_write';
  if (spec.name === 'run_tests') return 'test';
  if (spec.name === 'run_terminal_command') return 'command';
  if (spec.name === 'git_commit' || spec.name === 'git_branch') return 'git';
  if (NETWORK_TOOLS.has(spec.name)) return 'network';
  if (BROWSER_TOOLS.has(spec.name)) return 'browser';
  return 'other';
}

function evaluateMode(
  mode: PermissionMode,
  kind: { isWrite: boolean; isExecute: boolean; isVcs: boolean },
): PolicyDecision {
  const { isWrite, isExecute, isVcs } = kind;

  switch (mode) {
    case 'ask':
      if (isWrite || isExecute || isVcs) {
        return {
          effect: 'require-approval',
          risk: isWrite ? 'low' : 'medium',
          reason: 'Behörighetsläget är "Fråga alltid".',
          hardBlock: false,
        };
      }
      return { effect: 'allow', reason: 'Läsande verktyg kräver inget godkännande.' };

    case 'auto-edit':
      if (isWrite)
        return { effect: 'allow', reason: 'Läget "Auto-redigera" godkänner filändringar.' };
      if (isExecute || isVcs) {
        return {
          effect: 'require-approval',
          risk: 'medium',
          reason: 'Kommandon kräver godkännande i läget "Auto-redigera".',
          hardBlock: false,
        };
      }
      return { effect: 'allow', reason: 'Läsande verktyg kräver inget godkännande.' };

    case 'auto-run':
      if (isWrite) return { effect: 'allow', reason: 'Läget "Auto-kör" godkänner filändringar.' };
      if (isExecute) return { effect: 'allow', reason: 'Läget "Auto-kör" godkänner kommandon.' };
      if (isVcs) return { effect: 'allow', reason: 'Läget "Auto-kör" godkänner git-operationer.' };
      return { effect: 'allow', reason: 'Tillåtet.' };

    case 'full-auto':
      return {
        effect: 'allow',
        reason: 'Läget "Full auto" (farliga kommandon kontrolleras fortfarande).',
      };

    default: {
      const exhaustive: never = mode;
      return { effect: 'block', reason: `Okänt behörighetsläge: ${String(exhaustive)}` };
    }
  }
}

/**
 * Auto-godkännande per kategori: en kategori användaren slagit på får köra utan att fråga, men
 * bara när policyn annars skulle ha frågat mjukt. Hårda block (farliga kommandon,
 * webbläsarautomation och icke-godkända MCP-servrar) kräver alltid ett personligt ja.
 */
function applyCategoryAutoApprove(
  spec: ToolSpec,
  decision: PolicyDecision,
  autoApprove: Partial<Record<ApprovalCategory, boolean>> | undefined,
): PolicyDecision {
  if (!autoApprove || decision.effect !== 'require-approval' || decision.hardBlock) return decision;
  const category = toolCategory(spec);
  if (!(AUTO_APPROVE_CATEGORIES as readonly ApprovalCategory[]).includes(category)) return decision;
  if (autoApprove[category] !== true) return decision;
  return {
    effect: 'allow',
    reason: `Auto-godkänt av dig: kategorin "${category}".`,
  };
}

export function riskLabel(risk: RiskLevel): string {
  return risk === 'high' ? 'hög risk' : risk === 'medium' ? 'medelrisk' : 'låg risk';
}
