import type { RegisteredTool } from '../tools/types.js';
import type { ConnectorService } from './service.js';
import { vercelTools } from './vercel/tools.js';

export interface ConnectorToolsOptions {
  projectId: string;
  /** Projektroten används av verktyg som får läsa ett värde från en fil i projektet. */
  projectRoot: string;
  service: ConnectorService;
  fetchImpl?: typeof fetch;
  /** Endast för tester och lokala fejkservrar. */
  vercelApiBaseUrl?: string;
}

/**
 * Verktygen som de anslutna connectors ger i ett projekt.
 *
 * Verktyget registreras bara när connectorn är påslagen *och* en token finns i valvet. Saknas
 * token beter sig agenten som om verktyget inte finns, i stället för att få ett halvt fungerande
 * anrop. Token lämnar aldrig den här funktionen.
 */
export function connectorTools(options: ConnectorToolsOptions): RegisteredTool[] {
  const tools: RegisteredTool[] = [];

  const vercel = options.service.view(options.projectId, 'vercel');
  if (vercel.state.status === 'connected') {
    const token = options.service.token('vercel');
    if (token) {
      tools.push(
        ...vercelTools({
          token,
          projectRoot: options.projectRoot,
          ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
          ...(options.vercelApiBaseUrl ? { baseUrl: options.vercelApiBaseUrl } : {}),
          onError: (message) => options.service.recordError(options.projectId, 'vercel', message),
        }),
      );
    }
  }

  return tools;
}
