/**
 * Server-only xAI (SpaceXAI) film tagging.
 * Keeps the API key off the client; pure parse/merge stay in lib/core.
 */

import {
  buildTagPrompt,
  chunkTagRequests,
  extractJsonFromLlmText,
  fillMissingWithHeuristics,
  parseLlmPlayTags,
  tagPlaysHeuristic,
  type FilmTagResponse,
  type PlayTagRequest,
  type PlayTagResult,
} from "@/lib/core/llm-tagging";

const XAI_BASE = "https://api.x.ai/v1";
const DEFAULT_MODEL = "grok-4.5";

export function getXaiApiKey(): string | undefined {
  const key = typeof process !== "undefined" ? process.env.XAI_API_KEY : undefined;
  const trimmed = key?.trim();
  return trimmed ? trimmed : undefined;
}

export function isXaiConfigured(): boolean {
  return Boolean(getXaiApiKey());
}

export function getXaiModel(): string {
  const m = typeof process !== "undefined" ? process.env.XAI_MODEL?.trim() : undefined;
  return m || DEFAULT_MODEL;
}

type XaiChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Call xAI OpenAI-compatible chat completions; return assistant text.
 * Injectable `fetchImpl` for tests.
 */
export async function xaiChatCompletion(
  messages: XaiChatMessage[],
  options: {
    apiKey?: string;
    model?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<string> {
  const apiKey = options.apiKey ?? getXaiApiKey();
  if (!apiKey) throw new Error("XAI_API_KEY is not configured");

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 45_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(`${XAI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model ?? getXaiModel(),
        temperature: 0.2,
        messages,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`xAI HTTP ${res.status}: ${body.slice(0, 240)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("xAI response missing message content");
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

async function tagBatchWithLlm(
  batch: PlayTagRequest[],
  fetchImpl?: typeof fetch,
): Promise<PlayTagResult[]> {
  const { system, user } = buildTagPrompt(batch);
  const text = await xaiChatCompletion(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { fetchImpl },
  );
  const payload = extractJsonFromLlmText(text);
  const allowed = new Set(batch.map((b) => b.playId));
  return parseLlmPlayTags(payload, allowed);
}

/**
 * Tag plays with xAI when configured; otherwise pure heuristics.
 * On LLM failure, falls back to heuristics for the whole request (never silent).
 */
export async function tagPlays(
  requests: PlayTagRequest[],
  options: { fetchImpl?: typeof fetch; forceHeuristic?: boolean } = {},
): Promise<FilmTagResponse> {
  if (requests.length === 0) {
    return { mode: "heuristic", results: [] };
  }

  if (options.forceHeuristic || !isXaiConfigured()) {
    return {
      mode: "heuristic",
      results: tagPlaysHeuristic(requests),
      warning: options.forceHeuristic
        ? undefined
        : "XAI_API_KEY not set — used local heuristics",
    };
  }

  const batches = chunkTagRequests(requests);
  const collected: PlayTagResult[] = [];
  const errors: string[] = [];

  for (const batch of batches) {
    try {
      const partial = await tagBatchWithLlm(batch, options.fetchImpl);
      collected.push(...fillMissingWithHeuristics(batch, partial));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      // Per-batch fallback so one failure doesn't drop the film
      collected.push(...tagPlaysHeuristic(batch));
    }
  }

  if (errors.length === batches.length) {
    return {
      mode: "heuristic",
      results: collected,
      warning: `LLM unavailable (${errors[0]}); used local heuristics`,
    };
  }

  if (errors.length > 0) {
    return {
      mode: "llm",
      results: collected,
      warning: `Partial LLM failure on ${errors.length}/${batches.length} batches; those used heuristics`,
    };
  }

  return { mode: "llm", results: collected };
}
