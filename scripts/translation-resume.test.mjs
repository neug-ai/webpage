import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scripts = path.dirname(fileURLToPath(import.meta.url));
async function listen(handler) {
  const server = createServer(handler);
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  return { server, url: `http://127.0.0.1:${server.address().port}/v1` };
}
function run(script, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { cwd, env: { ...process.env, ...env } });
    let output = "";
    child.stdout.on("data", chunk => { output += chunk; }); child.stderr.on("data", chunk => { output += chunk; });
    child.on("error", reject); child.on("exit", code => resolve({ code, output }));
  });
}

test("real HTTP timeout aborts and bounds retries without a hosted model", async () => {
  const { createTranslationClient } = await import("./lib/translation-client.mjs");
  let requests = 0;
  const { server, url } = await listen((_request, response) => { requests++; setTimeout(() => response.end("{}"), 250); });
  try {
    const client = createTranslationClient({ env: { OPENAI_API_KEY: "test", OPENAI_BASE_URL: url, TRANSLATION_TIMEOUT_MS: "60", TRANSLATION_MAX_ATTEMPTS: "2" },
      logger: () => {}, sleep: async () => {} });
    await assert.rejects(client.translate("input", "meta"), /timed out after 60ms.*attempt 2\/2/);
    assert.equal(requests, 2);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test("timeout also covers a stalled response body after successful headers", async () => {
  const { createTranslationClient } = await import("./lib/translation-client.mjs");
  const { server, url } = await listen((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.write('{"choices":');
    setTimeout(() => response.end("[]}"), 250);
  });
  try {
    const client = createTranslationClient({ env: { OPENAI_API_KEY: "test", OPENAI_BASE_URL: url, TRANSLATION_TIMEOUT_MS: "60", TRANSLATION_MAX_ATTEMPTS: "1" }, logger: () => {} });
    await assert.rejects(client.translate("input", "meta"), /timed out after 60ms.*attempt 1\/1/);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test("failed CLI run preserves cursor and plan, then resumes completed work across processes", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "webpage-translation-resume-"));
  let failSecond = true;
  const requests = [];
  const { server, url } = await listen(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const fragments = JSON.parse(body.messages[1].content);
    requests.push(fragments);
    if (failSecond && Object.values(fragments).some(value => value.includes("Second"))) {
      response.writeHead(503); response.end("temporary provider failure"); return;
    }
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(fragments) } }] }));
  });
  try {
    fs.mkdirSync(path.join(home, "scripts"));
    fs.copyFileSync(path.join(scripts, "translate-neug-docs.mjs"), path.join(home, "scripts", "translate-neug-docs.mjs"));
    fs.cpSync(path.join(scripts, "lib"), path.join(home, "scripts", "lib"), { recursive: true });
    fs.mkdirSync(path.join(home, "content", "en"), { recursive: true });
    fs.writeFileSync(path.join(home, "content", "en", "a.md"), "# First\nFirst evidence.\n");
    fs.writeFileSync(path.join(home, "content", "en", "b.md"), "# Second\nSecond evidence.\n");
    const previous = { commit: "old", files: [] };
    fs.writeFileSync(path.join(home, "last-sync.json"), JSON.stringify(previous));
    const plan = { files: ["a.md", "b.md"], changedPaths: ["a.md", "b.md"], changes: [{ path: "a.md" }, { path: "b.md" }],
      previousEnglish: { "a.md": "old-a", "b.md": "old-b" }, sourceRepository: "synthetic/test", sourceCommit: "new", version: "fixture", assets: [] };
    fs.writeFileSync(path.join(home, ".neug-sync-plan.json"), JSON.stringify(plan));
    const env = { OPENAI_API_KEY: "private-resume-test-key", OPENAI_BASE_URL: url, TRANSLATION_MAX_ATTEMPTS: "1", OPENAI_ENABLE_THINKING: "false" };
    const first = await run(path.join(home, "scripts", "translate-neug-docs.mjs"), home, env);
    assert.equal(first.code, 1, first.output); assert.match(first.output, /HTTP 503/);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(home, "last-sync.json"), "utf8")), previous);
    assert.ok(fs.existsSync(path.join(home, ".neug-sync-plan.json")));
    assert.ok(fs.existsSync(path.join(home, "content", "zh", "a.md")));
    assert.equal(fs.existsSync(path.join(home, "content", "zh", "b.md")), false);
    const firstCount = requests.filter(batch => Object.values(batch).some(value => value.includes("First"))).length;
    failSecond = false;
    const second = await run(path.join(home, "scripts", "translate-neug-docs.mjs"), home, env);
    assert.equal(second.code, 0, second.output); assert.match(second.output, /translation.cache_hit/);
    assert.equal(requests.filter(batch => Object.values(batch).some(value => value.includes("First"))).length, firstCount);
    assert.equal(JSON.parse(fs.readFileSync(path.join(home, "last-sync.json"), "utf8")).commit, "new");
    assert.equal(fs.existsSync(path.join(home, ".neug-sync-plan.json")), false);
    assert.doesNotMatch(first.output + second.output, /private-resume-test-key/);
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("real-model smoke mode preserves published state and saves review output without synchronizing", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "webpage-translation-smoke-"));
  const { server, url } = await listen(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const batch = JSON.parse(JSON.parse(Buffer.concat(chunks).toString()).messages[1].content);
    for (const [key, value] of Object.entries(batch)) if (value.includes('otherwise')) {
      const tokens = [...value.matchAll(/⟦N\d+⟧/g)].map(match => match[0]);
      batch[key] = `- **返回值：** 成功时返回 ${tokens[0]}，否则返回 ${tokens[1]}`;
    }
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(batch) } }] }));
  });
  try {
    fs.mkdirSync(path.join(home, 'scripts'));
    for (const file of ['translate-neug-docs.mjs', 'translation-smoke.mjs']) fs.copyFileSync(path.join(scripts, file), path.join(home, 'scripts', file));
    fs.cpSync(path.join(scripts, 'lib'), path.join(home, 'scripts', 'lib'), { recursive: true });
    const source = path.join(home, 'source');
    fs.mkdirSync(path.join(source, 'doc/source/extensions'), { recursive: true });
    fs.mkdirSync(path.join(source, 'doc/source/reference/cpp_api'), { recursive: true });
    fs.writeFileSync(path.join(source, 'doc/source/extensions/fts_search.md'), '# FTS\n\n## Intro\n\nIntro\n\n## Create an FTS Index\n\nThe `WITH` clause is optional.\n\n## More\n\nMore\n\n### Index Options\n\nSee [options](../options).\n');
    fs.writeFileSync(path.join(source, 'doc/source/reference/cpp_api/neug_db.md'), '# API\n\n## Database\n\nDB\n\n#### `Open(...)`\n\n- **Returns:** `true` if database opened successfully, `false` otherwise\n');
    const git = args => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' }).trim();
    git(['init', '-q']); git(['add', 'doc']);
    git(['-c', 'user.name=Smoke Test', '-c', 'user.email=smoke@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture']);
    fs.writeFileSync(path.join(home, 'last-sync.json'), '{"commit":"published"}\n');
    const result = await run(path.join(home, 'scripts/translation-smoke.mjs'), home, {
      OPENAI_API_KEY: 'test', OPENAI_BASE_URL: url, NEUG_SOURCE_DIR: source, NEUG_SOURCE_SHA: git(['rev-parse', 'HEAD']),
    });
    assert.equal(result.code, 0, result.output);
    assert.equal(fs.readFileSync(path.join(home, 'last-sync.json'), 'utf8'), '{"commit":"published"}\n');
    assert.equal(fs.existsSync(path.join(home, 'content')), false);
    const report = fs.readFileSync(path.join(home, '.cache/neug-translations/smoke.md'), 'utf8');
    assert.match(report, /否则返回 `false`/);
    assert.equal((result.output.match(/Translation smoke passed:/g) || []).length, 3);
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    fs.rmSync(home, { recursive: true, force: true });
  }
});
