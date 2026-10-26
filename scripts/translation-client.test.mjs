import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { createTranslationClient, translationConfig, TranslationValidationError } from "./lib/translation-client.mjs";
import { batchTranslationFragments, createMarkdownTranslationPlan, restoreMarkdownTranslation, splitProtectedMarkdown, translateDocument, translateMarkdownSection, translateMeta } from "./translate-neug-docs.mjs";
import { fileURLToPath } from "node:url";

const homes = [];
afterEach(() => { for (const home of homes.splice(0)) fs.rmSync(home, { recursive: true, force: true }); });
const success = (content, extra = {}) => new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }], ...extra }), { headers: { "x-request-id": "test-request" } });
function fixture(overrides = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "webpage-translation-client-")); homes.push(home);
  const logs = [], delays = [];
  const env = { OPENAI_API_KEY: "private-test-token", OPENAI_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1", OPENAI_MODEL: "qwen3.7-plus", ...overrides };
  const make = (fetcher, options = {}) => createTranslationClient({ env, cacheDirectory: path.join(home, "cache"), fetcher,
    logger: (line) => logs.push(line), sleep: async (ms) => delays.push(ms), ...options });
  return { home, env, logs, delays, make };
}

test("configuration disables Qwen thinking without sending unsupported parameters to unrelated providers", () => {
  assert.equal(translationConfig({ OPENAI_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1", OPENAI_MODEL: "qwen3.7-plus" }).thinking, false);
  assert.equal(translationConfig({ OPENAI_MODEL: "gpt-test" }).thinking, undefined);
  assert.equal(translationConfig({ OPENAI_ENABLE_THINKING: "true" }).thinking, true);
  assert.throws(() => translationConfig({ TRANSLATION_MAX_ATTEMPTS: "9" }), /between/);
  assert.throws(() => translationConfig({ TRANSLATION_TIMEOUT_MS: "NaN" }), /integer/);
  assert.throws(() => translationConfig({ OPENAI_BASE_URL: "https://secret@example.com/v1" }), /credentials/);
  assert.throws(() => translationConfig({ OPENAI_BASE_URL: "http://remote.example/v1" }), /HTTPS/);
  assert.throws(() => translationConfig({ OPENAI_ENABLE_THINKING: "yes" }), /auto, true or false/);
});

test("requests explicit non-thinking mode, bounded time and safe diagnostics", async () => {
  const f = fixture(); let request;
  const client = f.make(async (url, options) => { request = { url, options, body: JSON.parse(options.body) }; return success('{"t0":"译文"}', {
    usage: { prompt_tokens: 10, completion_tokens: 5, completion_tokens_details: { reasoning_tokens: 0 } },
  }); });
  await client.translate('{"t0":"private-source-marker"}', "fragments", { context: "data_io/index.md" });
  assert.equal(request.body.enable_thinking, false);
  assert.equal(request.body.model, "qwen3.7-plus");
  assert.ok(request.options.signal instanceof AbortSignal);
  assert.equal(request.options.redirect, "error");
  assert.equal(request.options.headers.Authorization, "Bearer private-test-token");
  assert.match(f.logs.join("\n"), /test-request/);
  assert.doesNotMatch(f.logs.join("\n"), /private-test-token|private-source-marker|译文/);
});

test("timeouts retry at most the configured attempts, not nested nine requests", async () => {
  const f = fixture({ TRANSLATION_TIMEOUT_MS: "25" }); let requests = 0;
  const client = f.make(async () => { requests++; throw new DOMException("aborted", "TimeoutError"); });
  await assert.rejects(client.translate("input", "fragments", { context: "failed.md batch 1" }), /failed.md batch 1:.*25ms.*attempt 3\/3/);
  assert.equal(requests, 3); assert.deepEqual(f.delays, [2000, 4000]);
  assert.equal(fs.existsSync(path.join(f.home, "cache")), false);
});

test("rate limits honor bounded Retry-After and recover from transient failure", async () => {
  const f = fixture(); let requests = 0;
  const client = f.make(async () => ++requests === 1 ? new Response("private server body", { status: 429, headers: { "retry-after": "99" } }) : success("answer"));
  assert.equal(await client.translate("input", "meta"), "answer");
  assert.deepEqual(f.delays, [30000]);
  assert.doesNotMatch(f.logs.join("\n"), /private server body/);
});

test("authentication errors fail once without copying provider response bodies", async () => {
  const f = fixture(); let requests = 0;
  await assert.rejects(f.make(async () => { requests++; return new Response("private-test-token", { status: 401 }); }).translate("input", "meta"), /HTTP 401.*attempt 1\/3/);
  assert.equal(requests, 1); assert.deepEqual(f.delays, []);
  assert.doesNotMatch(f.logs.join("\n"), /private-test-token/);
});

test("truncated, empty and malformed provider output is never cached as success", async () => {
  const f = fixture(); let requests = 0;
  const responses = [new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "partial" } }] })), success(""), success("valid")];
  const client = f.make(async () => { requests++; return responses.shift(); });
  assert.equal(await client.translate("input", "meta"), "valid");
  assert.equal(requests, 3);
  const entry = JSON.parse(fs.readFileSync(path.join(f.home, "cache", fs.readdirSync(path.join(f.home, "cache"))[0]), "utf8"));
  assert.equal(entry.translation, "valid");
  const other = f.make(async () => new Response("not JSON"));
  await assert.rejects(other.translate("different", "meta"), /invalid JSON/);
});

test("validated cache survives client restart without credentials; model and thinking changes miss", async () => {
  const f = fixture(); let requests = 0;
  const fetcher = async () => { requests++; return success("valid"); };
  await f.make(fetcher).translate("input", "meta");
  assert.equal(await f.make(() => { throw Error("must not call model"); }, { env: { ...f.env, OPENAI_API_KEY: "" } }).translate("input", "meta"), "valid");
  await f.make(fetcher, { env: { ...f.env, OPENAI_MODEL: "qwen-plus" } }).translate("input", "meta");
  await f.make(fetcher, { env: { ...f.env, OPENAI_ENABLE_THINKING: "true" } }).translate("input", "meta");
  await f.make(fetcher, { env: { ...f.env, OPENAI_BASE_URL: "https://different.example/v1" } }).translate("input", "meta");
  await f.make(fetcher).translate("changed input", "meta");
  await f.make(fetcher).translate("input", "fragments");
  assert.equal(requests, 6);
});

test("corrupt cache and semantically invalid but rehashed cache are revalidated", async () => {
  const f = fixture(); let requests = 0;
  const fetcher = async () => { requests++; return success("valid"); };
  const validate = (value) => assert.equal(value, "valid");
  await f.make(fetcher).translate("input", "meta", { validate });
  const cacheFile = path.join(f.home, "cache", fs.readdirSync(path.join(f.home, "cache"))[0]);
  fs.writeFileSync(cacheFile, "corrupt");
  await f.make(fetcher).translate("input", "meta", { validate });
  const entry = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  entry.translation = "wrong"; entry.sha256 = createHash("sha256").update(entry.translation).digest("hex");
  fs.writeFileSync(cacheFile, JSON.stringify(entry));
  await f.make(fetcher).translate("input", "meta", { validate });
  assert.equal(requests, 3);
});

test("large fragments are bounded and protected Markdown/Unicode round-trips exactly", async () => {
  const source = "# Title\n\n" + "Long paragraph 😀 with text. ".repeat(400) + "\n\n```sql\nRETURN 'untouched';\n```\nSee `identifier` at https://example.com/page.\n";
  const plan = createMarkdownTranslationPlan(source, 120);
  assert.ok(Object.values(plan.fragments).every(value => value.length <= 120));
  assert.equal(restoreMarkdownTranslation(plan, plan.fragments), source);
  assert.ok(Object.values(plan.fragments).every(value => !/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(value)));
  assert.ok(batchTranslationFragments(plan.fragments, 512).every(batch => JSON.stringify(batch).length <= 512));
  const f = fixture({ TRANSLATION_BATCH_CHARS: "512" });
  const client = f.make(async (_url, options) => success(JSON.parse(options.body).messages[1].content));
  assert.equal(await translateMarkdownSection(source, "long.md", client), source);
  assert.ok(client.counters.requests > 1);
});

test("fragment schema and terminology failures share the same bounded retry loop", async () => {
  const f = fixture(); let requests = 0;
  const client = f.make(async (_url, options) => {
    requests++;
    const batch = JSON.parse(JSON.parse(options.body).messages[1].content);
    return success(JSON.stringify(requests === 1 ? { wrong: "value" } : Object.fromEntries(Object.keys(batch).map(key => [key, requests === 2 ? "架构变更" : "模式变更"]))));
  });
  assert.equal(await translateMarkdownSection("Schema changes", "schema.md", client), "模式变更");
  assert.equal(requests, 3);
});

test("standalone English articles may be omitted in Chinese without losing Markdown boundaries", async () => {
  const source = '```cypher\nRETURN 1;\n```\n\nThe `WITH` clause is optional.\n';
  const f = fixture();
  const client = f.make(async (_url, options) => {
    const batch = JSON.parse(JSON.parse(options.body).messages[1].content);
    assert.deepEqual(Object.values(batch), ['\n\nThe ', ' clause is optional.\n']);
    return success(JSON.stringify({ t0: '', t1: '子句是可选的。' }));
  });
  assert.equal(await translateMarkdownSection(source, 'fts.md', client), '```cypher\nRETURN 1;\n```\n\n `WITH` 子句是可选的。\n');
  assert.equal(client.counters.requests, 1);

  const invalid = f.make(async () => success('{"t0":""}'));
  await assert.rejects(translateMarkdownSection('Meaningful documentation text', 'body.md', invalid), /empty or non-string fragment/);
  const missing = f.make(async () => success('{}'));
  await assert.rejects(translateMarkdownSection('The `WITH` clause', 'missing.md', missing), /changed fragment keys/);
});

test("validation repair receives precise safe feedback without leaking the rejected answer into logs", async () => {
  const f = fixture(); const requests = [];
  const client = f.make(async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return success(requests.length === 1 ? "private-rejected-answer" : "corrected");
  });
  const validate = answer => { if (answer !== "corrected") throw new TranslationValidationError("missing fragment key t0"); };
  assert.equal(await client.translate("original-input", "fragments", { validate }), "corrected");
  assert.equal(requests.length, 2);
  assert.equal(requests[1].messages[2].role, "assistant");
  assert.equal(requests[1].messages[2].content, "private-rejected-answer");
  assert.match(requests[1].messages[3].content, /missing fragment key t0/);
  assert.doesNotMatch(f.logs.join("\n"), /private-rejected-answer|original-input/);
  const cached = f.make(() => { throw Error("must reuse corrected validated result"); });
  assert.equal(await cached.translate("original-input", "fragments", { validate }), "corrected");
  assert.equal(cached.counters.hits, 1);
});

test("Qwen 3.7 repairs missing keys with a strict schema; unrelated providers are not opted in", async () => {
  for (const base of ['https://dashscope.aliyuncs.com/compatible-mode/v1', 'https://other.example/v1']) {
    const f = fixture({ OPENAI_BASE_URL: base }); const requests = [];
    const client = f.make(async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return success(requests.length === 1 ? '{}' : '{"t0":"译文"}');
    });
    await translateMarkdownSection('Documentation', 'schema-repair.md', client);
    assert.equal(requests[0].response_format, undefined);
    if (base.includes('aliyuncs.com')) {
      assert.deepEqual(requests[1].response_format, { type: 'json_schema', json_schema: {
        name: 'translation_fragments', strict: true,
        schema: { type: 'object', properties: { t0: { type: 'string' } }, required: ['t0'], additionalProperties: false },
      } });
    } else assert.equal(requests[1].response_format, undefined);
  }
});

test("metadata schema validation retries and preserves Nextra controls", async () => {
  const f = fixture(); let requests = 0;
  const source = 'export default { docs: { title: "Documentation", type: "doc" } };';
  const client = f.make(async () => success(++requests === 1 ? 'export default { wrong: "错误" };' : 'export default { docs: { title: "文档", type: "文档" } };'));
  const translated = await translateMeta(source, "_meta.ts", client);
  assert.equal(requests, 2); assert.match(translated, /title: "文档"/); assert.match(translated, /type: "doc"/);
});

test("failure late in a section preserves previous batches for the next run", async () => {
  const f = fixture({ TRANSLATION_BATCH_CHARS: "256", TRANSLATION_MAX_ATTEMPTS: "1" });
  const source = "Long paragraph with immutable words. ".repeat(30);
  let calls = 0;
  const first = f.make(async (_url, options) => ++calls === 2 ? new Response("unavailable", { status: 503 }) : success(JSON.parse(options.body).messages[1].content));
  await assert.rejects(translateMarkdownSection(source, "resume.md", first), /HTTP 503/);
  const next = f.make(async (_url, options) => success(JSON.parse(options.body).messages[1].content));
  assert.equal(await translateMarkdownSection(source, "resume.md", next), source);
  assert.equal(next.counters.hits, 1);
  assert.equal(next.counters.requests + next.counters.hits, batchTranslationFragments(createMarkdownTranslationPlan(source, Math.floor((256 - 32) / 6)).fragments, 256).length);
});

test("the exact failed data_io/index.md input resumes and preserves protected bytes without calling a hosted model", async () => {
  // Public alibaba/neug@78e6aa42907428b0b50fde2c0d107f6d8acb2bfa/doc/source/data_io/index.md.
  const source = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "data-io-index-v0.3.0.md"), "utf8");
  const f = fixture({ TRANSLATION_BATCH_CHARS: "512", TRANSLATION_MAX_ATTEMPTS: "1" });
  let requests = 0;
  const first = f.make(async (_url, options) => ++requests === 2 ? new Response("temporary failure", { status: 503 }) : success(JSON.parse(options.body).messages[1].content));
  await assert.rejects(translateDocument(source, "", "", "data_io/index.md", first), /HTTP 503/);
  const next = f.make(async (_url, options) => success(JSON.parse(options.body).messages[1].content));
  const translated = await translateDocument(source, "", "", "data_io/index.md", next);
  assert.equal(translated, source);
  assert.ok(next.counters.hits >= 1);
  for (const part of splitProtectedMarkdown(source).filter(part => part.protected)) assert.ok(translated.includes(part.value));
  const offline = f.make(() => { throw Error("must not request model"); }, { env: { ...f.env, OPENAI_API_KEY: "" } });
  assert.equal(await translateDocument(source, "", "", "data_io/index.md", offline), source);
  assert.equal(offline.counters.requests, 0);
});
