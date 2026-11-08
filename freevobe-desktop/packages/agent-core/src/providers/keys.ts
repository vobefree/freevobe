import type { ProviderId } from '@freevobe/protocol';
import { ConnectorSecretStore } from '../connectors/secrets.js';

/**
 * Provider-nycklar lagras i samma krypterade valv som connectors använder, men under ett eget
 * nyckelprefix. Då finns bara ett ställe att skydda, säkerhetskopiera och rensa, och en
 * provider-nyckel kan aldrig förväxlas med en connector-token.
 */
const PREFIX = 'provider:';

/** Providers nycklar läses bara av den provider som ska anropa tjänsten – aldrig av prompten. */
export class ProviderKeyStore {
  private readonly vault: ConnectorSecretStore;

  constructor(home: string, vault?: ConnectorSecretStore) {
    this.vault = vault ?? new ConnectorSecretStore(home);
  }

  set(id: ProviderId, key: string): { hint: string } {
    const value = key.trim();
    // Samma gräns som valvet, men med ett tydligare fel: en kort sträng är nästan alltid ett
    // ofullständigt inklistrat värde.
    if (value.length < 16) throw new Error('API-nyckeln är för kort för att vara giltig.');
    return this.vault.set(`${PREFIX}${id}`, value);
  }

  get(id: ProviderId): string | null {
    return this.vault.get(`${PREFIX}${id}`);
  }

  hint(id: ProviderId): string | undefined {
    return this.vault.hint(`${PREFIX}${id}`);
  }

  has(id: ProviderId): boolean {
    return this.vault.has(`${PREFIX}${id}`);
  }

  clear(id: ProviderId): boolean {
    return this.vault.delete(`${PREFIX}${id}`);
  }

  info(): ReturnType<ConnectorSecretStore['info']> {
    return this.vault.info();
  }
}
