import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.resolve(root, process.env.NEUG_SOURCE_DIR || ".temp-source-repo");
const enRoot = path.join(root, "content", "en");
const zhRoot = path.join(root, "content", "zh");
const statePath = path.join(root, "last-sync.json");
const planPath = path.join(root, ".neug-sync-plan.json");
const preservedRoots = new Set(["blog"]);
const documentExtensions = new Set([".md", ".mdx"]);
const apiKey = process.env.OPENAI_API_KEY || "";
const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const model = process.env.OPENAI_MODEL || "qwen-plus";

function fail(message) {
  throw new Error(message);
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function arraysEqual(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walkFiles(fullPath));
    else if (entry.isFile()) result.push(fullPath);
  }
  return result;
}

function gitShow(commit, relativePath) {
  if (!commit || !relativePath) return "";
  const result = spawnSync("git", ["-C", sourceRoot, "show", `${commit}:doc/source/${relativePath}`], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  return result.status === 0 ? result.stdout : "";
}

function assetTarget(relativePath) {
  const parts = relativePath.split("/");
  const marker = parts.findIndex((part) => part === "images" || part === "figures");
  if (marker < 0) return relativePath;
  return [...parts.slice(0, marker), ...parts.slice(marker + 1)].join("/");
}

function rewriteImagePaths(markdown, relativePath) {
  const documentDirectory = path.posix.dirname(relativePath);
  const rewrite = (url) => {
    const sourceRelative = path.posix.normalize(path.posix.join(documentDirectory, url));
    return `/images/${assetTarget(sourceRelative)}`;
  };
  return markdown
    .replace(/(\]\()((?:\.\.?\/)+(?:images|figures)\/[^)\s]+)(?=[)\s])/g, (_, prefix, url) => `${prefix}${rewrite(url)}`)
    .replace(/(\bsrc=["'])((?:\.\.?\/)+(?:images|figures)\/[^"']+)(["'])/g, (_, prefix, url, suffix) => `${prefix}${rewrite(url)}${suffix}`);
}

function normalizeSource(content, relativePath) {
  if (documentExtensions.has(path.posix.extname(relativePath))) return rewriteImagePaths(content, relativePath);
  return content;
}

function segmentByHeadings(content) {
  return content
    .split(/(?=^#{1,6}\s)/m)
    .filter((section) => section.trim())
    .map((section) => section.trim());
}

function extractMetaKeys(content) {
  return [...content.matchAll(/^\s*(?:(["'])(.*?)\1|([A-Za-z_$][\w$]*))\s*:/gm)]
    .map((match) => match[2] || match[3])
    .sort();
}

const metaControlValuePattern = /((?:["']?(?:display|type|layout)["']?)\s*:\s*)(["'])([^"']*)(\2)/g;

export function restoreMetaControlValues(source, translated) {
  const sourceValues = [...source.matchAll(metaControlValuePattern)].map((match) => match[3]);
  let index = 0;
  const restored = translated.replace(metaControlValuePattern, (match, prefix, quote, _value, closingQuote) => {
    const sourceValue = sourceValues[index];
    index += 1;
    return sourceValue === undefined ? match : `${prefix}${quote}${sourceValue}${closingQuote}`;
  });

  if (index !== sourceValues.length) {
    fail("translated metadata changed its Nextra control fields");
  }
  return restored;
}

export function splitProtectedMarkdown(content) {
  const protectedPattern = /```[\s\S]*?```|~~~[\s\S]*?~~~|^\s*(?:import|export)\s.+$|<\/?[A-Za-z][^>]*>|`[^`\n]+`|https?:\/\/[^\s)>'"]+/gm;
  const parts = [];
  let cursor = 0;

  for (const match of content.matchAll(protectedPattern)) {
    if (match.index > cursor) {
      parts.push({ protected: false, value: content.slice(cursor, match.index) });
    }
    parts.push({ protected: true, value: match[0] });
    cursor = match.index + match[0].length;
  }

  if (cursor < content.length) {
    parts.push({ protected: false, value: content.slice(cursor) });
  }
  return parts;
}

export function createMarkdownTranslationPlan(content) {
  let fragmentIndex = 0;
  const fragments = {};
  const parts = splitProtectedMarkdown(content).map((part) => {
    if (part.protected || !/[A-Za-z]/.test(part.value)) return part;
    const key = `t${fragmentIndex}`;
    fragmentIndex += 1;
    fragments[key] = part.value;
    return { ...part, key };
  });
  return { parts, fragments };
}

export function restoreMarkdownTranslation(plan, translated) {
  return plan.parts
    .map((part) => part.key ? translated[part.key] : part.value)
    .join("");
}

function stripCodeFence(content) {
  return content.trim().replace(/^```(?:markdown|md|mdx|typescript|ts|json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

async function requestTranslation(content, kind, maxAttempts = 3) {
  if (!apiKey) fail("QWEN_API_KEY is required when English documentation has translatable changes");

  const system = kind === "meta"
    ? "Translate the string values in this TypeScript metadata object from English to Simplified Chinese. Keep every key, object shape, punctuation mark, and non-string expression unchanged. Return only valid TypeScript."
    : "Translate every string value in this JSON object from English to Simplified Chinese. Keep every key and the JSON object shape unchanged. Preserve Markdown punctuation in each value. Return only valid JSON.";
  const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content },
          ],
          temperature: 0.1,
          max_tokens: 8192,
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) fail(`translation API returned ${response.status}: ${await response.text()}`);
      const data = await response.json();
      const translated = data?.choices?.[0]?.message?.content;
      if (!translated) fail("translation API returned an empty response");
      return stripCodeFence(translated);
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
  fail(`translation failed after ${maxAttempts} attempts: ${lastError?.message || lastError}`);
}

async function translateMeta(content, relativePath) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const translated = restoreMetaControlValues(
      content,
      await requestTranslation(content, "meta", 1),
    );
    if (arraysEqual(extractMetaKeys(content), extractMetaKeys(translated))) {
      return `${translated.trim()}\n`;
    }
  }
  fail(`${relativePath}: translated metadata changed its keys after 3 attempts`);
}

async function translateMarkdownSection(section, relativePath) {
  const plan = createMarkdownTranslationPlan(section);
  const expectedKeys = Object.keys(plan.fragments).sort();
  if (expectedKeys.length === 0) return section;

  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await requestTranslation(JSON.stringify(plan.fragments), "fragments", 1);
      const translated = JSON.parse(response);
      const translatedKeys = Object.keys(translated).sort();
      if (!arraysEqual(expectedKeys, translatedKeys)) {
        throw new Error("translation changed fragment keys");
      }
      if (!expectedKeys.every((key) => typeof translated[key] === "string")) {
        throw new Error("translation returned a non-string fragment");
      }

      return restoreMarkdownTranslation(plan, translated);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }

  fail(`${relativePath}: fragment translation failed after 3 attempts: ${lastError?.message || lastError}`);
}

async function translateDocument(newEnglish, oldEnglish, existingChinese, relativePath) {
  const oldSections = segmentByHeadings(oldEnglish);
  const newSections = segmentByHeadings(newEnglish);
  const chineseSections = segmentByHeadings(existingChinese);
  const cachedTranslations = new Map();

  for (let index = 0; index < Math.min(oldSections.length, chineseSections.length); index += 1) {
    cachedTranslations.set(oldSections[index], chineseSections[index]);
  }

  const translatedSections = [];
  for (const section of newSections) {
    if (cachedTranslations.has(section)) {
      translatedSections.push(cachedTranslations.get(section));
      continue;
    }
    translatedSections.push(await translateMarkdownSection(section, relativePath));
  }

  if (translatedSections.length !== newSections.length) fail(`${relativePath}: section count changed during translation`);
  return `${translatedSections.join("\n\n").trim()}\n`;
}

function removeEmptyDirectories(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirectories(path.join(directory, entry.name));
  }
  if (directory !== zhRoot && fs.readdirSync(directory).length === 0) fs.rmdirSync(directory);
}

async function main() {
  if (!fs.existsSync(planPath)) fail("Run sync-neug-docs.mjs before translating");
  const plan = readJson(planPath, null);
  const previousState = readJson(statePath, {});
  if (!plan) fail("The NeuG sync plan is invalid");

  const changeByPath = new Map(plan.changes.map((change) => [change.path, change]));
  const candidates = new Set(plan.changedPaths);
  for (const relativePath of plan.files) {
    if (!fs.existsSync(path.join(zhRoot, relativePath))) candidates.add(relativePath);
  }

  let translatedFiles = 0;
  const sortedCandidates = [...candidates].sort();
  let candidateIndex = 0;
  for (const relativePath of sortedCandidates) {
    candidateIndex += 1;
    if (!plan.files.includes(relativePath)) continue;
    const englishPath = path.join(enRoot, relativePath);
    if (!fs.existsSync(englishPath)) continue;

    console.log(`Translating ${candidateIndex}/${sortedCandidates.length}: ${relativePath}`);

    const change = changeByPath.get(relativePath) || { status: "M", path: relativePath, oldPath: relativePath };
    const existingRelativePath = change.status === "R" ? change.oldPath : relativePath;
    const chinesePath = path.join(zhRoot, relativePath);
    const existingChinesePath = path.join(zhRoot, existingRelativePath || relativePath);
    const newEnglish = fs.readFileSync(englishPath, "utf8");
    const oldEnglish = plan.previousEnglish?.[relativePath]
      || normalizeSource(gitShow(plan.previousCommit, existingRelativePath || relativePath), existingRelativePath || relativePath);
    const existingChinese = fs.existsSync(existingChinesePath) ? fs.readFileSync(existingChinesePath, "utf8") : "";

    const translated = relativePath.endsWith("_meta.ts")
      ? await translateMeta(newEnglish, relativePath)
      : await translateDocument(newEnglish, oldEnglish, existingChinese, relativePath);
    fs.mkdirSync(path.dirname(chinesePath), { recursive: true });
    fs.writeFileSync(chinesePath, translated);
    translatedFiles += 1;
  }

  const sourceDocumentSet = new Set(plan.files.filter((relativePath) => documentExtensions.has(path.posix.extname(relativePath))));
  let removedChineseFiles = 0;
  for (const file of walkFiles(zhRoot)) {
    const relativePath = toPosix(path.relative(zhRoot, file));
    if (preservedRoots.has(relativePath.split("/")[0])) continue;
    if (documentExtensions.has(path.posix.extname(relativePath)) && !sourceDocumentSet.has(relativePath)) {
      fs.unlinkSync(file);
      removedChineseFiles += 1;
    }
  }
  removeEmptyDirectories(zhRoot);

  const stateChanged = plan.metadataChanged
    || plan.changes.length > 0
    || !arraysEqual(previousState.files || [], plan.files)
    || !arraysEqual(previousState.assets || [], plan.assets);
  if (stateChanged) {
    const nextState = {
      sourceRepository: plan.sourceRepository,
      commit: plan.sourceCommit,
      version: plan.version,
      timestamp: new Date().toISOString(),
      files: plan.files,
      assets: plan.assets,
      changedFiles: plan.changes.map((change) => change.path),
    };
    fs.writeFileSync(statePath, `${JSON.stringify(nextState, null, 2)}\n`);
  }

  fs.unlinkSync(planPath);
  console.log(`Chinese translation: ${translatedFiles} files updated, ${removedChineseFiles} obsolete files removed.`);
  console.log(stateChanged ? `Sync state advanced to ${plan.sourceCommit.slice(0, 8)}.` : "No source changes detected.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}
