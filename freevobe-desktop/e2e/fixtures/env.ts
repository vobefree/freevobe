/**
 * E2E-miljön: portar och adresser till testservern, den fejkade Ollama-instansen och modellen.
 *
 * Portarna går att flytta med miljövariabler (samma som `playwright.config.ts` läser), så att
 * sviten kan köras vid sidan av en installerad Freevobe-app som redan äger standardportarna.
 */
export const AGENT_PORT = Number(process.env.FREEVOBE_E2E_AGENT_PORT ?? 4319);
export const FAKE_OLLAMA_PORT = Number(process.env.FREEVOBE_E2E_OLLAMA_PORT ?? 4399);
export const WEB_PORT = Number(process.env.FREEVOBE_E2E_WEB_PORT ?? 1420);

export const AGENT = `http://127.0.0.1:${AGENT_PORT}`;
export const FAKE_OLLAMA = `http://127.0.0.1:${FAKE_OLLAMA_PORT}`;
export const MODEL = 'freevobe-fake-coder:latest';
