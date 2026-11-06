// Minimal Google Gemini client (REST, generateContent) with JSON output.
// Docs: https://ai.google.dev/api/generate-content
const BASE = "https://generativelanguage.googleapis.com/v1beta";
const TIMEOUT_MS = 15_000; // per model; a hung request moves on to the next model

// Tried in order: a model that is busy (503), rate limited (429) or retired (404)
// is skipped and the next one is used. GEMINI_MODEL goes first when set.
const DEFAULT_MODELS = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3-flash-preview", "gemini-3.5-flash-lite", "gemini-3.8-flash"];

export function geminiModels(): string[] {
  const preferred = process.env.GEMINI_MODEL?.trim();
  return preferred ? [preferred, ...DEFAULT_MODELS.filter((m) => m !== preferred)] : DEFAULT_MODELS;
}

/** The model the app tries first (shown in the UI). */
export const GEMINI_MODEL = geminiModels()[0];

export class GeminiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

/** Gemini's response schema format (an OpenAPI subset). */
export type GeminiSchema = {
  type: "OBJECT" | "ARRAY" | "STRING" | "BOOLEAN" | "NUMBER" | "INTEGER";
  description?: string;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  items?: GeminiSchema;
  enum?: string[];
};

export const text = (t: string): Part => ({ text: t });
export const image = (bytes: Buffer, mime: string): Part => ({ inline_data: { mime_type: mime, data: bytes.toString("base64") } });

type JSONOpts = { system: string; parts: Part[]; schema: GeminiSchema; temperature?: number };

/**
 * Ask Gemini for a JSON object matching `schema`, falling back across models
 * when one is busy or retired. Returns the parsed (unvalidated) value and the model that answered.
 */
export async function geminiJSON(opts: JSONOpts): Promise<{ value: unknown; model: string }> {
  let last: GeminiError | null = null;
  for (const model of geminiModels()) {
    try {
      return { value: await callModel(model, opts), model };
    } catch (e) {
      if (!(e instanceof GeminiError) || ![404, 429, 500, 503].includes(e.status)) throw e;
      last = e; // busy, rate limited or retired: try the next model
    }
  }
  throw last ?? new GeminiError("No Gemini model was available.", 503);
}

async function callModel(model: string, opts: JSONOpts): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY is not set.", 401);

  let res: Response;
  try {
    res = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: opts.parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: opts.schema,
          temperature: opts.temperature ?? 0.2,
        },
      }),
    });
  } catch (e) {
    // Timed out or the connection failed: let the caller try the next model.
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new GeminiError(timedOut ? `Gemini (${model}) took too long to answer.` : `Couldn't reach Gemini: ${e instanceof Error ? e.message : e}`, 503);
  }

  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; status?: string };
    promptFeedback?: { blockReason?: string };
    candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
  };

  if (!res.ok) {
    const msg = json.error?.message ?? res.statusText;
    if (res.status === 429) throw new GeminiError(`Gemini rate limit reached (free tier). Wait a minute and try again.`, 429);
    if (res.status === 503) throw new GeminiError("Gemini is overloaded right now. Try again in a moment.", 503);
    if (res.status === 400 && /API key/i.test(msg)) throw new GeminiError("The Gemini API key was rejected. Check GEMINI_API_KEY.", 401);
    if (res.status === 404) throw new GeminiError(`Gemini model "${model}" isn't available for this key.`, 404);
    throw new GeminiError(`Gemini error ${res.status}: ${msg}`, res.status);
  }
  if (json.promptFeedback?.blockReason) throw new GeminiError(`Gemini blocked the request (${json.promptFeedback.blockReason}).`, 422);

  const out = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!out) throw new GeminiError(`Gemini returned no content (${json.candidates?.[0]?.finishReason ?? "unknown reason"}).`, 502);
  try {
    return JSON.parse(out);
  } catch {
    throw new GeminiError("Gemini returned text that isn't valid JSON.", 502);
  }
}
