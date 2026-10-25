import { DEFAULT_MODEL_ID, NEMOTRON_MODELS, resolveModel, TOKEN_FACTORY_BASE_URL } from "./models";
import type { ChatMessage, CompletionResult } from "./rubric";

/** One live completion. A JSON retry in the rubric can make a second call. */
export const TOKEN_FACTORY_TIMEOUT_MS = 55_000;

export interface JudgeRuntime {
  keyConfigured: boolean;
  defaultMode: "live" | "mock";
  defaultModel: string;
  models: { id: string; label: string; detail: string }[];
}

export function judgeRuntime(): JudgeRuntime {
  const keyConfigured = Boolean(process.env.NEBIUS_API_KEY?.trim());
  const forced = process.env.JUDGE_MODE?.trim().toLowerCase();
  const defaultMode =
    forced === "live" ? "live" : forced === "mock" ? "mock" : keyConfigured ? "live" : "mock";
  return {
    keyConfigured,
    defaultMode,
    defaultModel: process.env.NEBIUS_MODEL?.trim() || DEFAULT_MODEL_ID,
    models: NEMOTRON_MODELS.map(({ id, label, detail }) => ({
      id,
      label,
      detail,
    })),
  };
}

export function resolveRequestMode(requested: unknown): "live" | "mock" {
  const runtime = judgeRuntime();
  if (requested === "mock") return "mock";
  if (requested === "live") {
    if (!runtime.keyConfigured) {
      throw new Error("Add NEBIUS_API_KEY on the server, or switch the judge to mock mode.");
    }
    return "live";
  }
  return runtime.defaultMode === "live" && runtime.keyConfigured ? "live" : "mock";
}

export interface JsonSchemaFormat {
  name: string;
  strict?: boolean;
  schema: Record<string, unknown>;
}

export interface CompletionOptions {
  maxTokens?: number;
  timeoutMs?: number;
  /** Token Factory structured output. Falls back to json_object when Super rejects the schema. */
  jsonSchema?: JsonSchemaFormat;
  /** Ask Nemotron to skip its reasoning channel so the JSON fits in the token cap. */
  disableThinking?: boolean;
}

export async function completeWithNebius(
  modelId: string,
  messages: ChatMessage[],
  options?: CompletionOptions,
): Promise<CompletionResult> {
  const apiKey = process.env.NEBIUS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("NEBIUS_API_KEY is not set.");
  }

  const model = resolveModel(modelId);
  const base = tokenFactoryBaseUrl();
  const timeoutMs = options?.timeoutMs ?? TOKEN_FACTORY_TIMEOUT_MS;
  const payload = {
    model: model.id,
    temperature: options?.disableThinking ? 0 : 0.1,
    max_tokens: options?.maxTokens ?? 4096,
    messages,
  };
  const response = await postJsonCompletion(base, apiKey, payload, timeoutMs, options);
  if (!response.ok) {
    throw new Error(cleanProviderError(await response.text(), response.status));
  }

  const data = (await response.json()) as {
    choices?: {
      message?: {
        content?: unknown;
        reasoning_content?: unknown;
        reasoning?: unknown;
      };
    }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const message = data.choices?.[0]?.message;
  const content = readMessageContent(message);
  if (!content) {
    throw new Error("Token Factory returned an empty scorecard.");
  }

  return {
    content,
    usage: {
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
    },
  };
}

export function tokenFactoryBaseUrl(): string {
  return (process.env.NEBIUS_BASE_URL?.trim() || TOKEN_FACTORY_BASE_URL).replace(/\/$/, "");
}

async function postJsonCompletion(
  base: string,
  apiKey: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
  options?: CompletionOptions,
): Promise<Response> {
  const thinking = options?.disableThinking
    ? { extra_body: { chat_template_kwargs: { enable_thinking: false } } }
    : {};
  const schema = options?.jsonSchema
    ? {
        response_format: {
          type: "json_schema",
          json_schema: {
            name: options.jsonSchema.name,
            strict: options.jsonSchema.strict ?? true,
            schema: options.jsonSchema.schema,
          },
        },
      }
    : null;
  const attempts: Record<string, unknown>[] = [];
  if (schema) attempts.push({ ...payload, ...schema, ...thinking });
  attempts.push({ ...payload, response_format: { type: "json_object" }, ...thinking });
  if (options?.disableThinking || schema) {
    attempts.push({ ...payload, response_format: { type: "json_object" } });
  }
  attempts.push(payload);

  let lastDetail = "";
  let lastStatus = 500;
  for (let index = 0; index < attempts.length; index += 1) {
    const response = await postCompletion(base, apiKey, attempts[index], timeoutMs);
    if (response.ok || response.status !== 400) return response;
    lastStatus = response.status;
    lastDetail = await response.text();
    const canRelax = /response_format|json_schema|json_object|extra_body|chat_template|enable_thinking|additional propert|unrecognized|not supported/i.test(
      lastDetail,
    );
    if (!canRelax || index === attempts.length - 1) {
      throw new Error(cleanProviderError(lastDetail, lastStatus));
    }
  }
  throw new Error(cleanProviderError(lastDetail, lastStatus));
}

async function postCompletion(
  base: string,
  apiKey: string,
  body: unknown,
  timeoutMs: number,
): Promise<Response> {
  try {
    return await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (isTimeout(error)) {
      throw new Error(
        `Nebius Token Factory timed out after ${Math.round(timeoutMs / 1000)} seconds.`,
      );
    }
    const message = error instanceof Error ? error.message : "The Token Factory request failed.";
    throw new Error(redactSecrets(message));
  }
}

function readMessageContent(
  message:
    | {
        content?: unknown;
        reasoning_content?: unknown;
        reasoning?: unknown;
        reasoning_details?: unknown;
      }
    | undefined,
): string {
  const content = coerceText(message?.content).trim();
  const reasoning = coerceText(
    message?.reasoning_content ?? message?.reasoning ?? message?.reasoning_details,
  ).trim();
  if (content.includes("{") && reasoning.includes("{") && content !== reasoning) {
    return `${content}\n${reasoning}`;
  }
  if (content.includes("{")) return content;
  if (reasoning.includes("{")) return reasoning;
  return content || reasoning;
}

function coerceText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function redactSecrets(value: string): string {
  const secret = process.env.NEBIUS_API_KEY?.trim();
  return secret ? value.replaceAll(secret, "[redacted]") : value;
}

function cleanProviderError(body: string, status: number): string {
  const compact = redactSecrets(body).replace(/\s+/g, " ").trim().slice(0, 400);
  if (status === 401 || status === 403) {
    return "Nebius Token Factory rejected NEBIUS_API_KEY. Check the key and that it can call Nemotron.";
  }
  if (status === 404) {
    return `Nebius Token Factory could not find that model at this base URL. ${compact}`;
  }
  if (status === 429) {
    return "Nebius Token Factory rate-limited the scorecard request. Wait a moment and try again.";
  }
  return `Nebius Token Factory returned ${status}. ${compact || "No error body."}`;
}
