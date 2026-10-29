/**
 * Liten Vercel-klient ovanpå REST-API:t.
 *
 * Klienten är medvetet tunn: den normaliserar svaren till det agenten behöver och ser till att
 * token aldrig hamnar i ett felmeddelande, en logg eller ett verktygssvar. Allt som skickas ut
 * till modellen är projekts namn, id:n, statusar och URL:er.
 */

const DEFAULT_BASE_URL = 'https://api.vercel.com';
const REQUEST_TIMEOUT_MS = 30_000;

export interface VercelClientOptions {
  token: string;
  /** Team som anropet görs för. Utelämnas för personliga konton. */
  teamId?: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export interface VercelGitLink {
  type: string;
  org?: string;
  repo?: string;
  repoId?: number | string;
  productionBranch?: string;
}

export interface VercelProject {
  id: string;
  name: string;
  framework?: string | null;
  link?: VercelGitLink | null;
  createdAt?: number;
  updatedAt?: number;
}

export interface VercelDeployment {
  id: string;
  url: string;
  name?: string;
  readyState?: string;
  target?: string | null;
  createdAt?: number;
  inspectorUrl?: string;
}

export interface VercelEnvVar {
  id: string;
  key: string;
  target?: string[];
  type?: string;
}

export interface VercelDomain {
  name: string;
  verified?: boolean;
  redirect?: string | null;
}

/** Fel från Vercel. Meddelandet innehåller status och Vercels egen text – aldrig token. */
export class VercelApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(code ? `${message} (${code})` : message);
    this.name = 'VercelApiError';
    this.status = status;
    if (code) this.code = code;
  }
}

interface VercelErrorBody {
  error?: { code?: string; message?: string };
  message?: string;
}

function projectSummary(project: Record<string, unknown>): VercelProject {
  return {
    id: String(project.id ?? ''),
    name: String(project.name ?? ''),
    ...(typeof project.framework === 'string' ? { framework: project.framework } : {}),
    ...(project.link ? { link: project.link as VercelGitLink } : {}),
    ...(typeof project.createdAt === 'number' ? { createdAt: project.createdAt } : {}),
    ...(typeof project.updatedAt === 'number' ? { updatedAt: project.updatedAt } : {}),
  };
}

function deploymentSummary(deployment: Record<string, unknown>): VercelDeployment {
  return {
    id: String(deployment.id ?? deployment.uid ?? ''),
    url: String(deployment.url ?? ''),
    ...(typeof deployment.name === 'string' ? { name: deployment.name } : {}),
    ...(typeof deployment.readyState === 'string' ? { readyState: deployment.readyState } : {}),
    ...(deployment.target === null || typeof deployment.target === 'string'
      ? { target: deployment.target as string | null }
      : {}),
    ...(typeof deployment.createdAt === 'number' ? { createdAt: deployment.createdAt } : {}),
    ...(typeof deployment.inspectorUrl === 'string'
      ? { inspectorUrl: deployment.inspectorUrl }
      : {}),
  };
}

function envVarSummary(entry: Record<string, unknown>): VercelEnvVar {
  return {
    id: String(entry.id ?? ''),
    key: String(entry.key ?? ''),
    ...(Array.isArray(entry.target) ? { target: entry.target.map(String) } : {}),
    ...(typeof entry.type === 'string' ? { type: entry.type } : {}),
  };
}

function domainSummary(entry: Record<string, unknown>): VercelDomain {
  return {
    name: String(entry.name ?? ''),
    ...(typeof entry.verified === 'boolean' ? { verified: entry.verified } : {}),
    ...(entry.redirect === null || typeof entry.redirect === 'string'
      ? { redirect: entry.redirect as string | null }
      : {}),
  };
}

/** Publik URL till en deployment. Vercel returnerar värden utan schema. */
export function deploymentUrl(url: string): string {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export interface CreateDeploymentInput {
  /** Projektets id eller namn. */
  project: string;
  target: 'preview' | 'production';
  /** Git-ref (gren eller commit). Standard är projektets produktionsgren. */
  ref?: string;
}

export class VercelClient {
  private readonly token: string;
  private readonly teamId: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(options: VercelClientOptions) {
    if (!options.token.trim()) throw new Error('Vercel-token saknas.');
    this.token = options.token.trim();
    this.teamId = options.teamId?.trim() || undefined;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  private url(pathname: string, query: Record<string, string | number | undefined> = {}): string {
    const target = new URL(`${this.baseUrl}${pathname}`);
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === '') continue;
      target.searchParams.set(key, String(value));
    }
    if (this.teamId) target.searchParams.set('teamId', this.teamId);
    return target.toString();
  }

  private async request<T>(
    method: string,
    pathname: string,
    options: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> {
    const response = await this.fetchImpl(this.url(pathname, options.query), {
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: 'application/json',
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status === 204) return undefined as T;

    const raw = await response.text();
    let parsed: unknown = undefined;
    if (raw.trim() !== '') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = undefined;
      }
    }

    if (!response.ok) {
      const body = (parsed ?? {}) as VercelErrorBody;
      const message =
        body.error?.message ??
        body.message ??
        `Vercel svarade ${response.status} ${response.statusText}`.trim();
      throw new VercelApiError(response.status, message, body.error?.code);
    }

    return (parsed ?? {}) as T;
  }

  async listProjects(limit = 20): Promise<VercelProject[]> {
    const data = await this.request<{ projects?: Array<Record<string, unknown>> }>(
      'GET',
      '/v9/projects',
      { query: { limit } },
    );
    return (data.projects ?? []).map(projectSummary);
  }

  async getProject(idOrName: string): Promise<VercelProject> {
    const data = await this.request<Record<string, unknown>>(
      'GET',
      `/v9/projects/${encodeURIComponent(idOrName)}`,
    );
    const project = projectSummary(data);
    if (!project.name) {
      throw new VercelApiError(404, `Vercel-projektet "${idOrName}" hittades inte.`);
    }
    return project;
  }

  async createProject(input: { name: string; framework?: string }): Promise<VercelProject> {
    const data = await this.request<Record<string, unknown>>('POST', '/v11/projects', {
      body: {
        name: input.name,
        ...(input.framework ? { framework: input.framework } : {}),
      },
    });
    return projectSummary(data);
  }

  /**
   * Skapar en deployment från projektets git-länk. Vercel bygger själv, så inga filer lämnar
   * datorn härifrån – det som skickas är projekt, mål och en git-ref.
   */
  async createDeployment(input: CreateDeploymentInput): Promise<VercelDeployment> {
    const project = await this.getProject(input.project);
    const link = project.link;
    if (!link?.type) {
      throw new VercelApiError(
        400,
        `Projektet "${project.name}" är inte kopplat till ett git-repo i Vercel. Koppla repot i Vercel-dashboarden (Project → Settings → Git) och försök igen.`,
      );
    }
    if (!link.repoId && !(link.org && link.repo)) {
      throw new VercelApiError(
        400,
        `Vercel-projektet "${project.name}" saknar repo-uppgifter i sin git-länk.`,
      );
    }

    const ref = input.ref ?? link.productionBranch;
    if (!ref) {
      throw new VercelApiError(
        400,
        'Ingen git-ref angavs och projektet har ingen produktionsgren. Skicka "ref" (t.ex. "main").',
      );
    }

    const gitSource = link.repoId
      ? { type: link.type, repoId: link.repoId, ref }
      : { type: link.type, org: link.org, repo: link.repo, ref };

    const data = await this.request<Record<string, unknown>>('POST', '/v13/deployments', {
      body: {
        name: project.name,
        project: project.id,
        ...(input.target === 'production' ? { target: 'production' } : {}),
        gitSource,
      },
    });
    const deployment = deploymentSummary(data);
    if (!deployment.id) throw new VercelApiError(500, 'Vercel returnerade ingen deployment.');
    return deployment;
  }

  async listDeployments(projectId: string, limit = 10): Promise<VercelDeployment[]> {
    const data = await this.request<{ deployments?: Array<Record<string, unknown>> }>(
      'GET',
      '/v6/deployments',
      { query: { projectId, limit } },
    );
    return (data.deployments ?? []).map(deploymentSummary);
  }

  async getDeployment(idOrUrl: string): Promise<VercelDeployment> {
    const data = await this.request<Record<string, unknown>>(
      'GET',
      `/v13/deployments/${encodeURIComponent(idOrUrl)}`,
    );
    return deploymentSummary(data);
  }

  /** Byggloggar som text. Vercel strömmar dem som händelser; vi plockar ut textraderna. */
  async buildLogs(idOrUrl: string, limit = 200): Promise<string> {
    const data = await this.request<unknown>(
      'GET',
      `/v2/deployments/${encodeURIComponent(idOrUrl)}/events`,
      {
        query: { builds: 1, limit },
      },
    );
    const events = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
    const lines: string[] = [];
    for (const event of events) {
      const payload = event.payload as Record<string, unknown> | undefined;
      const text = typeof payload?.text === 'string' ? payload.text : event.text;
      if (typeof text === 'string' && text.trim() !== '') lines.push(text.trimEnd());
    }
    return lines.join('\n');
  }

  /** Miljövariablernas nycklar och miljöer. Värdena hämtas aldrig (ingen decrypt). */
  async listEnvVars(projectId: string): Promise<VercelEnvVar[]> {
    const data = await this.request<{ envs?: Array<Record<string, unknown>> }>(
      'GET',
      `/v9/projects/${encodeURIComponent(projectId)}/env`,
    );
    return (data.envs ?? []).map(envVarSummary);
  }

  async setEnvVar(
    projectId: string,
    input: { key: string; value: string; targets: string[]; type?: 'encrypted' | 'plain' },
  ): Promise<VercelEnvVar> {
    const data = await this.request<Record<string, unknown>>(
      'POST',
      `/v10/projects/${encodeURIComponent(projectId)}/env`,
      {
        body: {
          key: input.key,
          value: input.value,
          type: input.type ?? 'encrypted',
          target: input.targets,
        },
      },
    );
    // Vercel svarar antingen med objektet direkt eller med { created: {...} }.
    const created = Array.isArray(data.created) ? data.created[0] : data.created;
    const entry = (created ?? data) as Record<string, unknown>;
    return envVarSummary(entry);
  }

  async deleteEnvVar(projectId: string, envId: string): Promise<void> {
    await this.request<unknown>(
      'DELETE',
      `/v9/projects/${encodeURIComponent(projectId)}/env/${encodeURIComponent(envId)}`,
    );
  }

  async listDomains(projectId: string): Promise<VercelDomain[]> {
    const data = await this.request<{ domains?: Array<Record<string, unknown>> }>(
      'GET',
      `/v9/projects/${encodeURIComponent(projectId)}/domains`,
    );
    return (data.domains ?? []).map(domainSummary);
  }

  async addDomain(projectId: string, name: string): Promise<VercelDomain> {
    const data = await this.request<Record<string, unknown>>(
      'POST',
      `/v10/projects/${encodeURIComponent(projectId)}/domains`,
      { body: { name } },
    );
    return domainSummary(data);
  }
}
