import type {
  ConnectorDefinition,
  ConnectorDisconnectResult,
  ConnectorSecretStorageInfo,
  ConnectorState,
  ConnectorToolDescriptor,
  ConnectorView,
} from '@freevobe/protocol';
import type { Repositories } from '../store/repositories.js';
// Endast typer: butiken instansieras av anroparen (hubben), inte här.
import { connectorDefinition, isConnectorId, listConnectorDefinitions } from './registry.js';
import type { ConnectorSecretStore } from './secrets.js';

export interface ConnectConnectorInput {
  secret?: string;
  accountLabel?: string;
}

export interface ConnectorServiceOptions {
  repositories: Repositories;
  secrets: ConnectorSecretStore;
}

/**
 * Connector-registret.
 *
 * Token är global för maskinen (en GitHub-token gäller alla projekt), medan *valet* att använda
 * connectorn är per projekt. Det gör att ett projekt kan köra med Vercel medan ett annat är helt
 * lokalt – utan att användaren behöver klistra in samma token igen.
 *
 * Tjänsten lämnar aldrig ut en token. Den enda hemlighetsinformation som går ut är en maskerad
 * ledtråd, och den kommer från valvet – inte från anropet.
 */
export class ConnectorService {
  private readonly repositories: Repositories;
  private readonly secrets: ConnectorSecretStore;

  constructor(options: ConnectorServiceOptions) {
    this.repositories = options.repositories;
    this.secrets = options.secrets;
  }

  get storage(): ConnectorSecretStorageInfo {
    return this.secrets.info();
  }

  catalog(): ConnectorDefinition[] {
    return listConnectorDefinitions();
  }

  list(projectId: string): ConnectorView[] {
    const states = new Map(
      this.repositories.connectors.list(projectId).map((entry) => [entry.connectorId, entry]),
    );
    const hints = this.secrets.hints();
    return listConnectorDefinitions().map((definition) =>
      this.buildView(definition, states.get(definition.id) ?? null, hints[definition.id]),
    );
  }

  view(projectId: string, connectorId: string): ConnectorView {
    const definition = this.requireDefinition(connectorId);
    const state = this.repositories.connectors.get(projectId, connectorId);
    return this.buildView(definition, state ?? null, this.secrets.hint(connectorId));
  }

  /**
   * Ansluter en connector för ett projekt. Token sparas krypterat och lämnar aldrig servern.
   * Verifieringen mot tjänstens API görs av connectorverktygen i senare steg – här sparas bara
   * uppgiften och projektets val.
   */
  connect(
    projectId: string,
    connectorId: string,
    input: ConnectConnectorInput = {},
  ): ConnectorView {
    const definition = this.requireDefinition(connectorId);
    if (definition.availability !== 'available') {
      throw new Error('Connector är inte tillgänglig än. Den visas som "kommer snart".');
    }
    if (definition.builtin) {
      // Lokal git kräver ingen nyckel; anslutningen är alltid på.
      this.repositories.connectors.upsert(projectId, { connectorId, enabled: true });
      return this.view(projectId, connectorId);
    }
    if (!definition.acceptsToken) {
      throw new Error('Connector ansluts med OAuth, vilket inte är aktiverat än.');
    }

    const secret = (input.secret ?? '').trim();
    if (!secret) throw new Error('Token saknas. Klistra in en token för att ansluta.');
    if (secret.length < 8) throw new Error('Token är för kort för att vara giltig.');

    const { hint } = this.secrets.set(connectorId, secret);
    this.repositories.connectors.upsert(projectId, {
      connectorId,
      enabled: true,
      accountLabel: input.accountLabel?.trim() || null,
      lastError: null,
    });
    const state = this.repositories.connectors.get(projectId, connectorId);
    return this.buildView(definition, state ?? null, hint);
  }

  /**
   * Kopplar bort connectorn: token raderas från maskinen och projektets val nollställs.
   * Behörigheterna som inte längre används returneras så att UI:t kan visa dem.
   */
  disconnect(projectId: string, connectorId: string): ConnectorDisconnectResult {
    const definition = this.requireDefinition(connectorId);
    if (definition.builtin) {
      throw new Error('Inbyggda connectors kan inte kopplas bort.');
    }
    const hadSecret = this.secrets.delete(connectorId);
    this.repositories.connectors.remove(projectId, connectorId);
    return {
      view: this.view(projectId, connectorId),
      revokedScopes: hadSecret ? definition.scopes.map((scope) => scope.id) : [],
    };
  }

  /** Slår av eller på connectorn i ett projekt. Token ligger kvar men används inte. */
  setEnabled(projectId: string, connectorId: string, enabled: boolean): ConnectorView {
    const definition = this.requireDefinition(connectorId);
    if (definition.builtin) return this.view(projectId, connectorId);
    this.repositories.connectors.upsert(projectId, { connectorId, enabled });
    return this.view(projectId, connectorId);
  }

  /**
   * Läser connectorns token. Anropas bara av connectorverktygen när de ska prata med tjänsten –
   * aldrig av prompten, loggarna eller HTTP-rutterna.
   */
  token(connectorId: string): string | null {
    this.requireDefinition(connectorId);
    return this.secrets.get(connectorId);
  }

  /** Registrerar ett fel som ska synas i UI:t, utan att läcka något om token. */
  recordError(projectId: string, connectorId: string, message: string): ConnectorView {
    const definition = this.requireDefinition(connectorId);
    this.repositories.connectors.upsert(projectId, { connectorId, lastError: message });
    return this.buildView(
      definition,
      this.repositories.connectors.get(projectId, connectorId),
      this.secrets.hint(connectorId),
    );
  }

  /** Verktygen som faktiskt får användas i projektet just nu. */
  enabledTools(projectId: string): ConnectorToolDescriptor[] {
    return this.list(projectId)
      .filter((entry) => entry.state.status === 'connected')
      .flatMap((entry) => entry.definition.tools);
  }

  /**
   * Rad för agentens kontext: vilka connectors som är på och vilka verktyg de ger. Innehåller
   * inga tokens – bara namn, läge och verktygs-id:n.
   */
  contextSummary(projectId: string): string {
    const connected = this.list(projectId).filter((entry) => entry.state.status === 'connected');
    if (connected.length === 0) return 'Inga connectors är aktiva i det här projektet.';
    return connected
      .map(
        (entry) =>
          `${entry.definition.id}${entry.state.accountLabel ? ` (${entry.state.accountLabel})` : ''}: ${
            entry.definition.tools.map((tool) => tool.id).join(', ') || 'inga verktyg'
          }`,
      )
      .join('\n');
  }

  private buildView(
    definition: ConnectorDefinition,
    state: {
      enabled: boolean;
      accountLabel?: string;
      lastError?: string;
      updatedAt: number;
    } | null,
    secretHint: string | undefined,
  ): ConnectorView {
    const hasSecret = definition.builtin || Boolean(secretHint);
    const enabled = definition.builtin ? true : (state?.enabled ?? true);
    const status: ConnectorState['status'] = !hasSecret
      ? state?.lastError
        ? 'error'
        : 'disconnected'
      : enabled
        ? 'connected'
        : 'disconnected';

    return {
      definition,
      state: {
        connectorId: definition.id,
        status,
        enabled,
        ...(secretHint ? { secretHint } : {}),
        ...(state?.accountLabel ? { accountLabel: state.accountLabel } : {}),
        ...(state?.lastError ? { lastError: state.lastError } : {}),
        updatedAt: state?.updatedAt ?? 0,
      },
    };
  }

  private requireDefinition(connectorId: string): ConnectorDefinition {
    if (!isConnectorId(connectorId)) {
      throw new Error(`Connector "${connectorId}" finns inte.`);
    }
    const definition = connectorDefinition(connectorId);
    if (!definition) throw new Error(`Connector "${connectorId}" finns inte.`);
    return definition;
  }
}
