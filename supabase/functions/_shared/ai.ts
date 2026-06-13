// Shared AI client for Supabase Edge Functions.
//
// Replaces the Lovable AI gateway with direct calls to:
//   - Google Gemini  (OpenAI-compatible endpoint)  — env: GEMINI_API_KEY
//   - Anthropic Claude (Messages API)               — env: ANTHROPIC_API_KEY
//
// Provider is auto-selected from the `model` string:
//   model starting with "claude"  -> Anthropic
//   otherwise                     -> Gemini
//
// Returns an OpenAI-shaped response so existing call sites can keep reading
// `data.choices?.[0]?.message?.content` unchanged.

export const AI_MODELS = {
  // Fast/cheap, good for bulk extraction & structured analysis.
  gemini: "gemini-2.5-flash",
  // High-quality copywriting & conversation. Bump to "claude-sonnet-4-6" for
  // even better quality (higher cost), or keep Haiku for speed/cost.
  claude: "claude-haiku-4-5-20251001",
} as const;

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CallAIOptions {
  model: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Ask the model to return strict JSON (Gemini: response_format; Claude: prompt hint). */
  jsonMode?: boolean;
}

export interface OpenAIShapedResponse {
  choices: Array<{ message: { role: "assistant"; content: string } }>;
}

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function isClaude(model: string): boolean {
  return model.toLowerCase().startsWith("claude");
}

/**
 * Call an LLM and get back an OpenAI-shaped response.
 * Drop-in for the previous `fetch(ai.gateway.lovable.dev)` + `await res.json()`.
 */
export async function callAI(opts: CallAIOptions): Promise<OpenAIShapedResponse> {
  const { model, messages, temperature, maxTokens, jsonMode } = opts;

  if (isClaude(model)) {
    return await callClaude(model, messages, temperature, maxTokens, jsonMode);
  }
  return await callGemini(model, messages, temperature, maxTokens, jsonMode);
}

async function callGemini(
  model: string,
  messages: AIMessage[],
  temperature?: number,
  maxTokens?: number,
  jsonMode?: boolean,
): Promise<OpenAIShapedResponse> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const body: Record<string, unknown> = { model, messages };
  if (temperature !== undefined) body.temperature = temperature;
  if (maxTokens !== undefined) body.max_tokens = maxTokens;
  if (jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error ${res.status}: ${errText}`);
  }

  // Google's OpenAI-compatible endpoint already returns OpenAI shape.
  return (await res.json()) as OpenAIShapedResponse;
}

async function callClaude(
  model: string,
  messages: AIMessage[],
  temperature?: number,
  maxTokens?: number,
  jsonMode?: boolean,
): Promise<OpenAIShapedResponse> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  // Anthropic takes `system` as a top-level field and only user/assistant turns.
  const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content);
  let system = systemParts.join("\n\n");
  if (jsonMode) {
    system += "\n\nReturn ONLY valid JSON. Do not wrap it in markdown code fences.";
  }

  const turns = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens ?? 2048,
    messages: turns,
  };
  if (system.trim()) body.system = system;
  if (temperature !== undefined) body.temperature = temperature;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = Array.isArray(data?.content)
    ? data.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("")
    : "";

  // Normalize to OpenAI shape so existing call sites keep working.
  return { choices: [{ message: { role: "assistant", content } }] };
}
