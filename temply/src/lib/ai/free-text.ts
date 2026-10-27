import { envValue } from "@/lib/settings";
import { GeminiError, geminiConfigured, geminiText } from "./gemini";

/**
 * All text-AI i Temply går genom gratistjänster. Ingen betalmodell kan nås –
 * varken med eller utan nyckel.
 *
 * Ordningen är medvetet "gratis först":
 * 1. Kilo Gateway (ingen nyckel) – svarar utan inloggning, 200 anrop/timme per
 *    IP. Standard är `minimax/minimax-m3.1-flash:free`, med `kilo-auto/free`
 *    som reserv.
 * 2. Pollinations (ingen nyckel) – sista utvägen när Kilo är nere. Strypt till
 *    ett svar var 30:e sekund per IP, så den används bara när inget annat går.
 * 3. Google Gemini (GEMINI_API_KEY) – gratisnivån, bara Flash-modellerna.
 * 4. OpenRouter (OPENROUTER_API_KEY) – alltid `openrouter/free` eller `:free`.
 *
 * Nycklarna ligger sist eftersom en nyckel kan sitta på ett projekt med
 * fakturering. Då debiteras även Flash-modellerna, och ett gratisbygge ska
 * aldrig kunna råka kosta pengar. `FREE_AI_KEYLESS=0` stänger av de nyckelfria
 * vägarna för den som hellre vill använda sin egen nyckel.
 *
 * Saknas allt svarar den lokala motorn i varje funktion.
 */

export type FreeTextInput = {
  system?: string;
  prompt: string;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

/** Gratisvägarna, i den ordning de provas. */
export type FreeProvider = "kilo" | "pollinations" | "gemini" | "openrouter";

export type FreeTextResult = { text: string; provider: FreeProvider };

type ChatResponse = {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  error?: { message?: string };
};

const KILO_URL = "https://ai-gateway.kilo.ai/api/v1/chat/completions";
const POLLINATIONS_URL = "https://text.pollinations.ai/";

/** De nyckelfria vägarna kan stängas av, men är på som standard. */
export function keylessEnabled(): boolean {
  return envValue("FREE_AI_KEYLESS") !== "0";
}

export function freeTextConfigured(): boolean {
  return keylessEnabled() || geminiConfigured() || Boolean(envValue("OPENROUTER_API_KEY"));
}

/** Endast gratismodeller – ett betalmodellnamn faller tillbaka till free-routern. */
export function openRouterModel(): string {
  const configured = envValue("OPENROUTER_MODEL").trim();
  if (configured === "openrouter/free" || configured.endsWith(":free")) return configured;
  return "openrouter/free";
}

/**
 * Kilo har flera gratis modeller men bara några som svarar med innehåll i ett
 * svep. Auto-routern väljer ibland en resonemangsmodell som bränner hela
 * tokenbudgeten på att tänka och lämnar `content: null`, så en snabb
 * flash-modell är standard och de andra är reserver.
 */
const KILO_DEFAULT = "minimax/minimax-m3.1-flash:free";

export function kiloModel(): string {
  const configured = envValue("KILO_MODEL").trim();
  if (configured === "kilo-auto/free" || configured.endsWith(":free")) return configured;
  return KILO_DEFAULT;
}

function kiloModels(): string[] {
  return [...new Set([kiloModel(), KILO_DEFAULT, "kilo-auto/free"])];
}

function messages(input: FreeTextInput): { role: string; content: string }[] {
  return [
    ...(input.system ? [{ role: "system", content: input.system }] : []),
    { role: "user", content: input.prompt },
  ];
}

function failure(error: unknown, fallback: string): GeminiError {
  if (error instanceof GeminiError) return error;
  if (error instanceof Error && error.name === "AbortError") return new GeminiError("AI:n tog för lång tid");
  return new GeminiError(fallback);
}

async function kiloText(input: FreeTextInput): Promise<string> {
  const deadline = Date.now() + (input.timeoutMs ?? 30_000);
  let lastError: unknown = new GeminiError("Kilo svarade inte");

  for (const model of kiloModels()) {
    const remaining = deadline - Date.now();
    if (remaining < 3_000) break;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      const res = await fetch(KILO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: input.temperature ?? 0.5,
          // Reserverade tokens: en resonemangsmodell ska hinna skriva klart.
          max_tokens: Math.max(input.maxTokens ?? 1600, 1200),
          ...(input.json ? { response_format: { type: "json_object" } } : {}),
          messages: messages(input),
        }),
        signal: controller.signal,
        cache: "no-store",
      });
      const json = (await res.json()) as ChatResponse;
      if (!res.ok) {
        lastError = new GeminiError(json.error?.message || `Kilo ${res.status}`, res.status === 429 ? 429 : 502);
        continue;
      }
      const text = json.choices?.[0]?.message?.content?.trim();
      if (text) return text;
      lastError = new GeminiError("Tomt svar från Kilo");
    } catch (error) {
      lastError = failure(error, "Kunde inte nå Kilo");
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof GeminiError ? lastError : new GeminiError("Kunde inte nå Kilo");
}

async function pollinationsText(input: FreeTextInput): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 30_000);
  try {
    const res = await fetch(POLLINATIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        ...(input.json ? { json: true } : {}),
        temperature: input.temperature ?? 0.5,
        messages: messages(input),
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new GeminiError(`Pollinations ${res.status}`, res.status === 429 || res.status === 402 ? 429 : 502);
    }
    const raw = (await res.text()).trim();
    if (!raw) throw new GeminiError("Tomt svar från Pollinations");
    // Med json=true kommer objektet redan tolkat. Vi lämnar alltid tillbaka en
    // sträng så att anroparen kan använda samma JSON-avkodning som förut.
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed === "string") return parsed;
      if (parsed && typeof parsed === "object") return JSON.stringify(parsed);
    } catch {
      // Inte JSON – ren text duger lika bra för icke-JSON-anrop.
    }
    return raw;
  } catch (error) {
    throw failure(error, "Kunde inte nå Pollinations");
  } finally {
    clearTimeout(timer);
  }
}

async function openRouterText(input: FreeTextInput): Promise<string> {
  const key = envValue("OPENROUTER_API_KEY");
  if (!key) throw new GeminiError("OPENROUTER_API_KEY saknas", 503);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 30_000);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": envValue("APP_URL") || "https://themefold.se",
        "X-Title": "ThemeFold",
      },
      body: JSON.stringify({
        model: openRouterModel(),
        temperature: input.temperature ?? 0.5,
        max_tokens: input.maxTokens ?? 2400,
        ...(input.json ? { response_format: { type: "json_object" } } : {}),
        messages: messages(input),
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    const json = (await res.json()) as ChatResponse;
    if (!res.ok) throw new GeminiError(json.error?.message || `OpenRouter ${res.status}`, res.status === 429 ? 429 : 502);
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new GeminiError("Tomt svar från OpenRouter");
    return text;
  } catch (error) {
    throw failure(error, "Kunde inte nå AI-providern");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Provar gratisvägarna i ordning och rapporterar vilken som svarade, så att
 * studion kan visa att svaret kom från en gratistjänst.
 */
export async function freeTextWithProvider(input: FreeTextInput): Promise<FreeTextResult> {
  const attempts: { provider: FreeProvider; run: () => Promise<string> }[] = [];
  if (keylessEnabled()) {
    attempts.push({ provider: "kilo", run: () => kiloText(input) });
    attempts.push({ provider: "pollinations", run: () => pollinationsText(input) });
  }
  if (geminiConfigured()) attempts.push({ provider: "gemini", run: () => geminiText(input) });
  if (envValue("OPENROUTER_API_KEY")) attempts.push({ provider: "openrouter", run: () => openRouterText(input) });

  let lastError: unknown = new GeminiError("Ingen gratis AI-provider är konfigurerad", 503);
  for (const attempt of attempts) {
    try {
      return { text: await attempt.run(), provider: attempt.provider };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof GeminiError ? lastError : new GeminiError("Ingen gratis AI-provider svarade");
}

/** Som `freeText`, men bara texten – de flesta anrop behöver ingen provider-info. */
export async function freeText(input: FreeTextInput): Promise<string> {
  return (await freeTextWithProvider(input)).text;
}
