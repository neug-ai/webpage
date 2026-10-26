import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { databaseTerminologyGuide } from "./database-terminology.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function integer(env, key, fallback, min, max) {
  if (!env[key]) return fallback;
  if (!/^\d+$/.test(env[key])) throw new Error(`${key} must be an integer`);
  const value = Number(env[key]);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${key} must be between ${min} and ${max}`);
  return value;
}

export function translationConfig(env = process.env) {
  const base = new URL(env.OPENAI_BASE_URL || "https://api.openai.com/v1");
  if (base.username || base.password || base.search || base.hash) throw new Error("Translation API URL must not contain credentials, query or fragment");
  if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname))) {
    throw new Error("Translation API requires HTTPS (HTTP is allowed only for local tests)");
  }
  const endpoint = base.href.replace(/\/+$/, "");
  const model = env.OPENAI_MODEL || "qwen-plus";
  let thinking;
  if (env.OPENAI_ENABLE_THINKING && env.OPENAI_ENABLE_THINKING !== "auto") {
    if (!["true", "false"].includes(env.OPENAI_ENABLE_THINKING)) throw new Error("OPENAI_ENABLE_THINKING must be auto, true or false");
    thinking = env.OPENAI_ENABLE_THINKING === "true";
  } else if (/^qwen/i.test(model) && /(?:^|\.)aliyuncs\.com$/.test(base.hostname)) {
    // Qwen 3.7 defaults to thinking. Translation does not require reasoning output.
    thinking = false;
  }
  return {
    endpoint: endpoint.endsWith("/chat/completions") ? endpoint : `${endpoint}/chat/completions`,
    model, thinking,
    timeoutMs: integer(env, "TRANSLATION_TIMEOUT_MS", 180_000, 1, 600_000),
    attempts: integer(env, "TRANSLATION_MAX_ATTEMPTS", 3, 1, 5),
    maxBatchChars: integer(env, "TRANSLATION_BATCH_CHARS", 6000, 256, 16000),
  };
}

function systemMessage(kind) {
  return `${kind === "meta"
    ? "Translate the string values in this TypeScript metadata object from English to Simplified Chinese. Keep every key, object shape, punctuation mark, and non-string expression unchanged. Return only valid TypeScript."
    : "Translate every string value in this JSON object from English to Simplified Chinese. Keep every key and the JSON object shape unchanged. Preserve Markdown punctuation and whitespace boundaries in each value. Return only valid JSON."}

${databaseTerminologyGuide}`;
}

class TranslationFailure extends Error {
  constructor(message, retryable = true, retryAfter = 0) {
    super(message);
    this.retryable = retryable;
    this.retryAfter = retryAfter;
  }
}

/** Only caller-authored, non-content validation messages may enter diagnostics. */
export class TranslationValidationError extends Error {}

function repairResponseFormat(config, content, kind) {
  // Only opt documented models into the provider's strict schema mode.
  // https://www.alibabacloud.com/help/en/model-studio/qwen-structured-output
  if (kind !== "fragments" || !/^qwen3\.7-(?:plus|max|flash)(?:-|$)/i.test(config.model)
    || !/(?:^|\.)aliyuncs\.com$/.test(new URL(config.endpoint).hostname)) return undefined;
  let fragments;
  try { fragments = JSON.parse(content); } catch { return undefined; }
  if (!fragments || typeof fragments !== "object" || Array.isArray(fragments)) return undefined;
  const keys = Object.keys(fragments);
  return { type: "json_schema", json_schema: { name: "translation_fragments", strict: true,
    schema: { type: "object", properties: Object.fromEntries(keys.map(key => [key, { type: "string" }])),
      required: keys, additionalProperties: false } } };
}

/** One retry layer covers transport, provider output and semantic validation. */
export function createTranslationClient({ env = process.env, cacheDirectory, fetcher = fetch, sleep = pause, logger = console.log, now = Date.now } = {}) {
  const config = translationConfig(env);
  const apiKey = env.OPENAI_API_KEY || env.DASHSCOPE_API_KEY || env.QWEN_API_KEY || "";
  const counters = { requests: 0, hits: 0, retries: 0 };
  function log(event, detail) { logger(JSON.stringify({ event, ...detail })); }
  return {
    config, counters,
    async translate(content, kind, { context = "translation", validate = () => {} } = {}) {
      const payload = { model: config.model, messages: [{ role: "system", content: systemMessage(kind) }, { role: "user", content }],
        temperature: 0.1, max_tokens: 8192, ...(config.thinking === undefined ? {} : { enable_thinking: config.thinking }) };
      const key = digest(JSON.stringify({ version: 2, endpoint: config.endpoint, kind, payload }));
      const cachePath = cacheDirectory && path.join(cacheDirectory, `${key}.json`);
      if (cachePath) {
        try {
          const stat = fs.lstatSync(cachePath);
          if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2_000_000) throw new Error("Invalid cache file");
          const cached = JSON.parse(fs.readFileSync(cachePath, "utf8"));
          if (cached.version !== 2 || cached.key !== key || typeof cached.translation !== "string" || cached.sha256 !== digest(cached.translation)) throw new Error("Invalid cache entry");
          validate(cached.translation);
          counters.hits += 1;
          log("translation.cache_hit", { context, model: config.model });
          return cached.translation;
        } catch (error) {
          if (error.code !== "ENOENT") log("translation.cache_ignored", { context });
        }
      }
      if (!apiKey) throw new Error("OPENAI_API_KEY, DASHSCOPE_API_KEY or QWEN_API_KEY is required for uncached translations");
      let lastError;
      let repair;
      for (let attempt = 1; attempt <= config.attempts; attempt += 1) {
        const started = now();
        let requestId;
        log("translation.request", { context, model: config.model, attempt, timeoutMs: config.timeoutMs, inputChars: content.length, thinking: config.thinking ?? "provider-default" });
        try {
          counters.requests += 1;
          const responseFormat = repair && repairResponseFormat(config, content, kind);
          const response = await fetcher(config.endpoint, {
            method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify(repair ? { ...payload, ...(responseFormat ? { response_format: responseFormat } : {}), messages: [...payload.messages,
              { role: "assistant", content: repair.answer },
              { role: "user", content: `Your previous response failed validation: ${repair.reason}. Correct it and return the complete response only. Keep all original keys with string values, including punctuation-only fragments. Empty strings are allowed only for standalone English articles (a, an, the) that have no Chinese equivalent. Follow the terminology guide. Do not omit, merge or add keys.` },
            ] } : payload), signal: AbortSignal.timeout(config.timeoutMs), redirect: "error",
          });
          requestId = (response.headers.get("x-request-id") || response.headers.get("x-dashscope-request-id") || "").replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 128);
          if (!response.ok) {
            const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
            const after = response.headers.get("retry-after"), seconds = /^\d+$/.test(after || "") ? Number(after) : (Date.parse(after) - now()) / 1000;
            await response.body?.cancel();
            throw new TranslationFailure(`Translation API HTTP ${response.status}`, retryable, Math.min(30_000, Math.max(0, seconds * 1000 || 0)));
          }
          let data;
          try { data = await response.json(); }
          catch (error) {
            if (["TimeoutError", "AbortError"].includes(error.name)) throw error;
            throw new TranslationFailure("Translation API returned invalid JSON");
          }
          const choice = data?.choices?.[0];
          if (choice?.finish_reason === "length") throw new TranslationFailure("Translation output was truncated (finish_reason=length)");
          if (choice?.finish_reason === "content_filter") throw new TranslationFailure("Translation blocked by provider content filter", false);
          if (typeof choice?.message?.content !== "string" || !choice.message.content.trim()) throw new TranslationFailure("Translation API returned empty answer content");
          const translated = choice.message.content.trim().replace(/^```(?:markdown|md|mdx|typescript|ts|json)?\s*/i, "").replace(/\s*```$/, "").trim();
          try { validate(translated); }
          catch (error) {
            if (error instanceof TranslationValidationError) repair = { answer: translated, reason: error.message };
            throw error;
          }
          if (cachePath) {
            const temporary = `${cachePath}.${randomUUID()}.tmp`;
            try {
              fs.mkdirSync(cacheDirectory, { recursive: true, mode: 0o700 });
              fs.writeFileSync(temporary, JSON.stringify({ version: 2, key, sha256: digest(translated), translation: translated }), { flag: "wx", mode: 0o600 });
              fs.renameSync(temporary, cachePath);
            } catch { throw new TranslationFailure("Unable to save translation checkpoint", false); }
            finally { fs.rmSync(temporary, { force: true }); }
          }
          const usage = data.usage || {};
          log("translation.success", { context, model: config.model, attempt, elapsedMs: now() - started, requestId,
            promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens, reasoningTokens: usage.completion_tokens_details?.reasoning_tokens });
          return translated;
        } catch (error) {
          const timedOut = ["TimeoutError", "AbortError"].includes(error.name);
          const message = timedOut ? `Translation request timed out after ${config.timeoutMs}ms`
            : error instanceof TranslationFailure ? error.message
            : error instanceof TranslationValidationError ? `Translation validation failed: ${error.message}`
            : error instanceof TypeError ? "Translation network request failed" : "Translation output/cache validation failed";
          lastError = message;
          log("translation.failure", { context, model: config.model, attempt, elapsedMs: now() - started, requestId, reason: message });
          if (error.retryable === false || attempt === config.attempts) throw new Error(`${context}: ${message} (attempt ${attempt}/${config.attempts})`);
          counters.retries += 1;
          await sleep(Math.max(error.retryAfter || 0, Math.min(8000, 2000 * 2 ** (attempt - 1))));
        }
      }
      throw new Error(`${context}: ${lastError}`);
    },
  };
}
