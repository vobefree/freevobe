import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONNECTOR_IDS } from '@freevobe/protocol';
import { FreevobeDatabase } from '../store/db.js';
import { createRepositories, type Repositories } from '../store/repositories.js';
import { CONNECTOR_DEFINITIONS, connectorScopeIds, listConnectorDefinitions } from './registry.js';
import { ConnectorSecretStore } from './secrets.js';
import { ConnectorService } from './service.js';

const TOKEN = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';

let home: string;
let db: FreevobeDatabase;
let repositories: Repositories;
let secrets: ConnectorSecretStore;
let service: ConnectorService;
let projectA: string;
let projectB: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'freevobe-connectors-'));
  db = new FreevobeDatabase({ file: ':memory:' });
  repositories = createRepositories(db);
  secrets = new ConnectorSecretStore(home);
  service = new ConnectorService({ repositories, secrets });
  projectA = repositories.projects.upsert(path.join(home, 'a'), 'A').id;
  projectB = repositories.projects.upsert(path.join(home, 'b'), 'B').id;
});

afterEach(() => {
  db.close();
  fs.rmSync(home, { recursive: true, force: true });
});

describe('connector-katalogen', () => {
  it('täcker alla id:n och har unika nycklar', () => {
    expect(listConnectorDefinitions().map((entry) => entry.id)).toEqual([...CONNECTOR_IDS]);
    expect(new Set(CONNECTOR_IDS).size).toBe(CONNECTOR_IDS.length);
  });

  it('kräver att destruktiva verktyg alltid har godkännande', () => {
    for (const definition of CONNECTOR_DEFINITIONS) {
      for (const tool of definition.tools) {
        if (tool.destructive) expect(tool.requiresApproval).toBe(true);
        expect(tool.id.startsWith(`${definition.id}_`)).toBe(true);
      }
    }
  });

  it('ger varje anslutningsbar connector minst en obligatorisk behörighet', () => {
    for (const definition of CONNECTOR_DEFINITIONS) {
      if (definition.builtin || definition.availability === 'coming-soon') continue;
      expect(definition.scopes.some((scope) => scope.required)).toBe(true);
      expect(definition.acceptsToken).toBe(true);
      expect(definition.tools.length).toBeGreaterThan(0);
    }
  });

  it('har en gemensam, avgränsad lista med behörighets-id:n', () => {
    const ids = connectorScopeIds();
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('ConnectorSecretStore', () => {
  it('krypterar token och kan läsa tillbaka den', () => {
    const { hint } = secrets.set('github', TOKEN);
    expect(hint).not.toBe(TOKEN);
    expect(hint).toContain('…');
    expect(secrets.get('github')).toBe(TOKEN);
    expect(secrets.has('github')).toBe(true);
    expect(secrets.hints()).toEqual({ github: hint });
  });

  it('skriver aldrig token i klartext på disk', () => {
    secrets.set('vercel', 'vercel_token_1234567890');
    const raw = fs.readFileSync(secrets.vaultPath, 'utf8');
    expect(raw).not.toContain('vercel_token_1234567890');
    expect(raw).toContain('aes');
    expect(raw).toContain('…');
  });

  it('begränsar filrättigheterna till ägaren', () => {
    secrets.set('github', TOKEN);
    if (process.platform === 'win32') return;
    const vaultMode = fs.statSync(secrets.vaultPath).mode & 0o777;
    const keyMode = fs.statSync(secrets.keyPath).mode & 0o777;
    expect(vaultMode).toBe(0o600);
    expect(keyMode).toBe(0o600);
    expect(secrets.info().restrictedPermissions).toBe(true);
  });

  it('avvisar för korta tokens och kan radera', () => {
    expect(() => secrets.set('github', 'kort')).toThrow(/för kort/);
    secrets.set('github', TOKEN);
    expect(secrets.delete('github')).toBe(true);
    expect(secrets.has('github')).toBe(false);
    expect(secrets.delete('github')).toBe(false);
  });

  it('säger till när nyckeln försvunnit men valvet finns kvar', () => {
    secrets.set('github', TOKEN);
    fs.rmSync(secrets.keyPath);
    const broken = new ConnectorSecretStore(home);
    expect(() => broken.get('github')).toThrow(/Nyckelfilen saknas/);
  });
});

describe('ConnectorService', () => {
  it('visar hela katalogen med status per projekt', () => {
    const views = service.list(projectA);
    expect(views).toHaveLength(CONNECTOR_IDS.length);
    const git = views.find((entry) => entry.definition.id === 'git');
    expect(git?.state.status).toBe('connected');
    expect(git?.state.secretHint).toBeUndefined();
    const github = views.find((entry) => entry.definition.id === 'github');
    expect(github?.state.status).toBe('disconnected');
  });

  it('ansluter med token och lämnar bara ut en maskerad ledtråd', () => {
    const view = service.connect(projectA, 'github', { secret: TOKEN, accountLabel: 'vobefree' });
    expect(view.state.status).toBe('connected');
    expect(view.state.accountLabel).toBe('vobefree');
    expect(view.state.secretHint).toBeTruthy();
    expect(view.state.secretHint).not.toBe(TOKEN);
    expect(JSON.stringify(view)).not.toContain(TOKEN);
  });

  it('kräver en token och avvisar okända connectors', () => {
    expect(() => service.connect(projectA, 'github', {})).toThrow(/Token saknas/);
    expect(() => service.connect(projectA, 'github', { secret: 'kort' })).toThrow(/för kort/);
    expect(() => service.connect(projectA, 'nope', { secret: TOKEN })).toThrow(/finns inte/);
    expect(() => service.connect(projectA, 'netlify', { secret: TOKEN })).toThrow(
      /inte tillgänglig/,
    );
  });

  it('håller valet per projekt men token per maskin', () => {
    service.connect(projectA, 'vercel', { secret: 'vercel_token_1234567890' });
    const other = service.list(projectB).find((entry) => entry.definition.id === 'vercel');
    expect(other?.state.status).toBe('connected');

    service.setEnabled(projectA, 'vercel', false);
    const disabled = service.view(projectA, 'vercel');
    expect(disabled.state.status).toBe('disconnected');
    expect(disabled.state.enabled).toBe(false);
    // Token ligger kvar: projektet kan slås på igen utan att klistra in den på nytt.
    expect(secrets.has('vercel')).toBe(true);
    expect(secrets.get('vercel')).toBe('vercel_token_1234567890');
    expect(service.view(projectB, 'vercel').state.status).toBe('connected');
  });

  it('kopplar bort, raderar token och rapporterar återkallade behörigheter', () => {
    service.connect(projectA, 'github', { secret: TOKEN });
    const result = service.disconnect(projectA, 'github');
    expect(result.view.state.status).toBe('disconnected');
    expect(result.revokedScopes).toContain('repository:read');
    expect(result.revokedScopes).toEqual(
      service
        .catalog()
        .find((c) => c.id === 'github')
        ?.scopes.map((s) => s.id),
    );
    expect(secrets.has('github')).toBe(false);
    expect(service.view(projectB, 'github').state.status).toBe('disconnected');
  });

  it('låter inbyggd git vara ansluten utan nyckel', () => {
    const view = service.connect(projectA, 'git');
    expect(view.state.status).toBe('connected');
    expect(secrets.count()).toBe(0);
    expect(() => service.disconnect(projectA, 'git')).toThrow(/Inbyggda/);
  });

  it('räknar bara verktyg från anslutna connectors och nämner inga tokens i kontexten', () => {
    expect(service.enabledTools(projectA).map((tool) => tool.id)).toEqual(
      expect.arrayContaining(['git_status']),
    );
    expect(service.enabledTools(projectA).some((tool) => tool.id.startsWith('vercel'))).toBe(false);

    service.connect(projectA, 'vercel', { secret: 'vercel_token_1234567890' });
    expect(service.enabledTools(projectA).some((tool) => tool.id === 'vercel_deploy')).toBe(true);

    const summary = service.contextSummary(projectA);
    expect(summary).toContain('vercel_deploy');
    expect(summary).not.toContain('vercel_token_1234567890');
  });

  it('beskriver lagringen utan att avslöja nyckeln', () => {
    const info = service.storage;
    expect(info.backend).toBe('encrypted-file');
    expect(info.cipher).toBe('aes-256-gcm');
    expect(info.path.endsWith('connectors.vault.json')).toBe(true);
    expect(info.keychain).toBe(false);
  });
});
