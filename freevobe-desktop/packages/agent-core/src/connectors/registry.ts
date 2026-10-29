import type { ConnectorDefinition, ConnectorId } from '@freevobe/protocol';

/**
 * Katalogen över connectors. Servern äger strukturen (vilka behörigheter och verktyg som finns),
 * UI:t äger texten (namn, beskrivning och behörighetsetiketter översätts per språk).
 *
 * Ingenting här innehåller hemligheter. `implemented: false` betyder att verktyget är planerat:
 * det syns i gränssnittet men kan inte anropas förrän steget som inför det är klart.
 */
export const CONNECTOR_DEFINITIONS: readonly ConnectorDefinition[] = [
  {
    id: 'git',
    icon: 'GI',
    authType: 'local',
    availability: 'available',
    builtin: true,
    acceptsToken: false,
    scopes: [],
    tools: [
      { id: 'git_status', destructive: false, requiresApproval: false, implemented: true },
      { id: 'git_diff', destructive: false, requiresApproval: false, implemented: true },
      { id: 'git_branch', destructive: false, requiresApproval: true, implemented: true },
      { id: 'git_commit', destructive: false, requiresApproval: true, implemented: true },
    ],
  },
  {
    id: 'github',
    icon: 'GH',
    authType: 'oauth',
    availability: 'available',
    builtin: false,
    acceptsToken: true,
    tokenUrl: 'https://github.com/settings/personal-access-tokens/new',
    scopes: [
      { id: 'repository:read', required: true },
      { id: 'repository:write', required: true },
      { id: 'pull_requests:write', required: false },
      { id: 'issues:write', required: false },
      { id: 'releases:write', required: false },
      { id: 'checks:read', required: false },
    ],
    tools: [
      { id: 'github_list_repos', destructive: false, requiresApproval: false, implemented: false },
      { id: 'github_create_repo', destructive: false, requiresApproval: true, implemented: false },
      { id: 'github_create_pr', destructive: false, requiresApproval: true, implemented: false },
      { id: 'github_merge_pr', destructive: true, requiresApproval: true, implemented: false },
      { id: 'github_create_issue', destructive: false, requiresApproval: true, implemented: false },
      {
        id: 'github_create_release',
        destructive: false,
        requiresApproval: true,
        implemented: false,
      },
      { id: 'github_get_checks', destructive: false, requiresApproval: false, implemented: false },
    ],
  },
  {
    id: 'vercel',
    icon: 'VE',
    authType: 'token',
    availability: 'available',
    builtin: false,
    acceptsToken: true,
    tokenUrl: 'https://vercel.com/account/tokens',
    scopes: [
      { id: 'projects:read', required: true },
      { id: 'projects:write', required: false },
      { id: 'deployments:read', required: true },
      { id: 'deployments:write', required: true },
      { id: 'env:write', required: false },
      { id: 'domains:write', required: false },
    ],
    tools: [
      {
        id: 'vercel_list_projects',
        destructive: false,
        requiresApproval: false,
        implemented: true,
      },
      { id: 'vercel_get_project', destructive: false, requiresApproval: false, implemented: true },
      {
        id: 'vercel_create_project',
        destructive: false,
        requiresApproval: true,
        implemented: true,
      },
      { id: 'vercel_deploy', destructive: false, requiresApproval: true, implemented: true },
      {
        id: 'vercel_get_deployments',
        destructive: false,
        requiresApproval: false,
        implemented: true,
      },
      {
        id: 'vercel_get_deployment_logs',
        destructive: false,
        requiresApproval: false,
        implemented: true,
      },
      { id: 'vercel_get_env_vars', destructive: false, requiresApproval: false, implemented: true },
      { id: 'vercel_set_env_var', destructive: false, requiresApproval: true, implemented: true },
      { id: 'vercel_delete_env_var', destructive: true, requiresApproval: true, implemented: true },
      { id: 'vercel_get_domains', destructive: false, requiresApproval: false, implemented: true },
      { id: 'vercel_add_domain', destructive: false, requiresApproval: true, implemented: true },
    ],
  },
  {
    id: 'supabase',
    icon: 'SB',
    authType: 'token',
    availability: 'available',
    builtin: false,
    acceptsToken: true,
    tokenUrl: 'https://supabase.com/dashboard/account/tokens',
    scopes: [
      { id: 'projects:read', required: true },
      { id: 'projects:write', required: false },
      { id: 'database:read', required: true },
      { id: 'database:write', required: true },
      { id: 'secrets:rotate', required: false },
    ],
    tools: [
      {
        id: 'supabase_list_projects',
        destructive: false,
        requiresApproval: false,
        implemented: false,
      },
      {
        id: 'supabase_get_project',
        destructive: false,
        requiresApproval: false,
        implemented: false,
      },
      {
        id: 'supabase_create_project',
        destructive: false,
        requiresApproval: true,
        implemented: false,
      },
      {
        id: 'supabase_get_project_config',
        destructive: false,
        requiresApproval: false,
        implemented: false,
      },
      {
        id: 'supabase_get_health',
        destructive: false,
        requiresApproval: false,
        implemented: false,
      },
      { id: 'supabase_run_sql', destructive: false, requiresApproval: true, implemented: false },
      {
        id: 'supabase_create_table',
        destructive: false,
        requiresApproval: true,
        implemented: false,
      },
      {
        id: 'supabase_list_tables',
        destructive: false,
        requiresApproval: false,
        implemented: false,
      },
      {
        id: 'supabase_get_env_keys',
        destructive: false,
        requiresApproval: false,
        implemented: false,
      },
      { id: 'supabase_rotate_keys', destructive: true, requiresApproval: true, implemented: false },
    ],
  },
  {
    id: 'netlify',
    icon: 'NE',
    authType: 'oauth',
    availability: 'coming-soon',
    builtin: false,
    acceptsToken: false,
    scopes: [
      { id: 'sites:write', required: true },
      { id: 'deployments:write', required: true },
      { id: 'env:write', required: false },
    ],
    tools: [],
  },
  {
    id: 'railway',
    icon: 'RA',
    authType: 'token',
    availability: 'coming-soon',
    builtin: false,
    acceptsToken: false,
    scopes: [
      { id: 'projects:read', required: true },
      { id: 'deployments:write', required: true },
    ],
    tools: [],
  },
  {
    id: 'stripe',
    icon: 'ST',
    authType: 'api_key',
    availability: 'coming-soon',
    builtin: false,
    acceptsToken: false,
    scopes: [{ id: 'payments:read', required: true }],
    tools: [],
  },
  {
    id: 'resend',
    icon: 'RE',
    authType: 'api_key',
    availability: 'coming-soon',
    builtin: false,
    acceptsToken: false,
    scopes: [
      { id: 'emails:send', required: true },
      { id: 'domains:read', required: false },
    ],
    tools: [],
  },
  {
    id: 'cloudflare',
    icon: 'CF',
    authType: 'api_key',
    availability: 'coming-soon',
    builtin: false,
    acceptsToken: false,
    scopes: [
      { id: 'zones:read', required: true },
      { id: 'workers:write', required: true },
    ],
    tools: [],
  },
  {
    id: 'neon',
    icon: 'NO',
    authType: 'api_key',
    availability: 'coming-soon',
    builtin: false,
    acceptsToken: false,
    scopes: [
      { id: 'projects:read', required: true },
      { id: 'database:write', required: true },
    ],
    tools: [],
  },
];

const BY_ID = new Map<ConnectorId, ConnectorDefinition>(
  CONNECTOR_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export function listConnectorDefinitions(): ConnectorDefinition[] {
  return [...CONNECTOR_DEFINITIONS];
}

export function connectorDefinition(id: string): ConnectorDefinition | null {
  return BY_ID.get(id as ConnectorId) ?? null;
}

export function isConnectorId(value: string): value is ConnectorId {
  return BY_ID.has(value as ConnectorId);
}

/** Alla behörighets-id:n som katalogen använder. UI:t översätter dem; testet kontrollerar dem. */
export function connectorScopeIds(): string[] {
  return [
    ...new Set(CONNECTOR_DEFINITIONS.flatMap((entry) => entry.scopes.map((s) => s.id))),
  ].sort();
}
