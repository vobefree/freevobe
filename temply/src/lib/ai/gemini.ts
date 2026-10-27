/**
 * Gemini via Google AI Studio. Gratisnivån räcker för Theme Health-analys och
 * butiksinsikter: en request per analys, inga bakgrundsjobb.
 *
 * Nyckel: GEMINI_API_KEY (eller GOOGLE_API_KEY). Modell: GEMINI_MODEL, annars
 * den rekommenderade flash-modellen med fallback till den rörliga aliasen.
 */

import { envValue } from "@/lib/settings";

/** Nycklar och modell kan sättas i adminpanelen (settings) eller i miljön. */
function endpoint(): string {
  return `${envValue("GEMINI_API_BASE") || "https://generativelanguage.googleapis.com"}/v1beta/models`;
}

/**
 * Modeller som ingår i Googles gratisnivå. Pro-modellerna (och Gemini 4 Argon)
 * kräver betald fakturering och får aldrig användas här.
 */
const FREE_FLASH = /^gemini-(flash-latest|\d+(\.\d+)?-flash(-lite)?(-preview)?)$/;

export function freeGeminiModel(name: string | undefined | null): string | null {
  const clean = (name ?? "").trim().toLowerCase();
  if (!clean) return null;
  return FREE_FLASH.test(clean) ? clean : null;
}

export function geminiModels(): string[] {
  const configured = freeGeminiModel(envValue("GEMINI_MODEL"));
  return [...new Set([configured || "gemini-3.8-flash", "gemini-flash-latest"])];
}

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export function geminiConfigured(): boolean {
  return Boolean(envValue("GEMINI_API_KEY") || envValue("GOOGLE_API_KEY"));
}

export function geminiModel(): string {
  return geminiModels()[0];
}

type GenerateInput = {
  system?: string;
  prompt: string;
  /** Returnera JSON i stället för prosa. */
  json?: boolean;
  /** JSON-schema enligt Gemini-formatet, t.ex. { type: "OBJECT", properties: ... }. */
  schema?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  error?: { message?: string; status?: string };
  promptFeedback?: { blockReason?: string };
};

function key(): string {
  const value = envValue("GEMINI_API_KEY") || envValue("GOOGLE_API_KEY");
  if (!value) throw new GeminiError("GEMINI_API_KEY saknas", 503);
  return value;
}

/**
 * Anropar generateContent. Provar nästa modell om den första är okänd för
 * projektet (404) eller tillfälligt otillgänglig (429/5xx).
 */
export async function geminiText(input: GenerateInput): Promise<string> {
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: input.prompt }] }],
    ...(input.system ? { systemInstruction: { parts: [{ text: input.system }] } } : {}),
    generationConfig: {
      temperature: input.temperature ?? 0.4,
      maxOutputTokens: input.maxTokens ?? 2400,
      ...(input.json ? { responseMimeType: "application/json" } : {}),
      ...(input.schema ? { responseSchema: input.schema } : {}),
    },
  });

  let lastError = new GeminiError("Gemini svarade inte");
  for (const model of geminiModels().filter(Boolean)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 25_000);
    try {
      const res = await fetch(`${endpoint()}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key() },
        body,
        signal: controller.signal,
        cache: "no-store",
      });
      const json = (await res.json()) as GeminiResponse;
      if (!res.ok) {
        const message = json.error?.message || `Gemini ${res.status}`;
        lastError = new GeminiError(message, res.status === 429 ? 429 : 502);
        if (res.status === 404 || res.status === 429 || res.status >= 500) continue;
        throw lastError;
      }
      const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
      if (text) return text;
      lastError = new GeminiError(
        json.promptFeedback?.blockReason
          ? `Gemini blockerade svaret (${json.promptFeedback.blockReason})`
          : "Tomt svar från Gemini",
      );
    } catch (error) {
      if (error instanceof GeminiError) {
        lastError = error;
        continue;
      }
      lastError = new GeminiError(error instanceof Error && error.name === "AbortError" ? "Gemini tog för lång tid" : "Kunde inte nå Gemini");
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

/** Plockar ut JSON även om modellen råkat lägga den i en kodblockmarkering. */
export function parseGeminiJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new GeminiError("Gemini returnerade ogiltig JSON");
  }
}
