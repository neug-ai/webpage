import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { validateDatabaseTerminology } from "./lib/database-terminology.mjs";
import { createTranslationClient, TranslationValidationError } from "./lib/translation-client.mjs";

export { validateDatabaseTerminology } from "./lib/database-terminology.mjs";

const root = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.resolve(root, process.env.NEUG_SOURCE_DIR || ".temp-source-repo");
const enRoot = path.join(root, "content", "en");
const zhRoot = path.join(root, "content", "zh");
const statePath = path.join(root, "last-sync.json");
const planPath = path.join(root, ".neug-sync-plan.json");
const preservedRoots = new Set(["blog"]);
const documentExtensions = new Set([".md", ".mdx"]);
const translationClient = createTranslationClient({ cacheDirectory: path.resolve(root, process.env.NEUG_TRANSLATION_CACHE_DIR || ".cache/neug-translations/v2") });
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

export function segmentMarkdownSections(content) {
  const fences = [...content.matchAll(/```[\s\S]*?```|~~~[\s\S]*?~~~/g)]
    .map(match => [match.index, match.index + match[0].length]);
  const boundaries = [0, ...[...content.matchAll(/^#{1,6}\s/gm)]
    .map(match => match.index)
    .filter(index => index > 0 && !fences.some(([start, end]) => start <= index && index < end))];
  return boundaries.map((start, index) => content.slice(start, boundaries[index + 1]).trim()).filter(Boolean);
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
  const protectedPattern = /```[\s\S]*?```|~~~[\s\S]*?~~~|^\s*(?:import|export)\s.+$|<\/?[A-Za-z][^>]*>|`[^`\n]+`|\]\((?:\\.|[^)\\\n])*\)|https?:\/\/[^\s)>'"]+/gm;
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

export function createMarkdownTranslationPlan(content, maxFragmentChars = 2400) {
  if (!Number.isSafeInteger(maxFragmentChars) || maxFragmentChars < 2) fail("maxFragmentChars must be an integer of at least 2");
  let fragmentIndex = 0;
  const fragments = {}, tokens = {}, parts = [];
  let prefix = "⟦N";
  while (content.includes(prefix)) prefix += "N";
  const tokenPattern = new RegExp(`${prefix}\\d+⟧`, "g");
  const restoreTokens = value => value.replace(tokenPattern, token => tokens[token]);
  let context = "";
  function flushContext() {
    // Paragraphs retain complete sentences around inline code and links. Fenced
    // code is never sent to the model and remains a separate immutable part.
    for (const paragraph of context.split(/(\n[\t ]*\n)/)) {
      if (!paragraph) continue;
      if (!/[A-Za-z]/.test(paragraph.replace(tokenPattern, ""))) {
        parts.push({ protected: true, value: restoreTokens(paragraph) });
        continue;
      }
      appendFragment(paragraph);
    }
    context = "";
  }
  function appendFragment(value) {
    const tokenRanges = [...value.matchAll(tokenPattern)].map(match => [match.index, match.index + match[0].length]);
    let start = 0;
    while (start < value.length) {
      let end = Math.min(start + maxFragmentChars, value.length);
      if (end < value.length) {
        const boundary = value.lastIndexOf("\n", end - 1);
        if (boundary > start + maxFragmentChars / 2) end = boundary + 1;
        else {
          const space = value.lastIndexOf(" ", end - 1);
          if (space > start + maxFragmentChars / 2) end = space + 1;
        }
        if (/[\uD800-\uDBFF]/.test(value[end - 1])) end -= 1;
        const crossing = tokenRanges.find(([left, right]) => left < end && end < right);
        if (crossing) end = crossing[0];
      }
      if (end <= start) fail("maxFragmentChars is too small for a protected Markdown token");
      const fragment = value.slice(start, end);
      const key = `t${fragmentIndex++}`;
      fragments[key] = fragment;
      parts.push({ protected: false, value: fragment, key });
      start = end;
    }
  }
  for (const part of splitProtectedMarkdown(content)) {
    if (!part.protected) { context += part.value; continue; }
    if (/^(?:```|~~~|\s*(?:import|export)\s)/.test(part.value)) {
      flushContext();
      parts.push(part);
      continue;
    }
    const token = `${prefix}${Object.keys(tokens).length}⟧`;
    // Leave the closing label bracket visible to the model: [label]⟦N0⟧.
    if (part.value.startsWith("](")) {
      context += "]";
      tokens[token] = part.value.slice(1);
    } else tokens[token] = part.value;
    context += token;
  }
  flushContext();
  return { parts, fragments, tokens, tokenPattern };
}

export function validateMarkdownTokens(plan, source, translated) {
  const expected = [...source.matchAll(plan.tokenPattern)].map(match => match[0]);
  const actual = [...translated.matchAll(plan.tokenPattern)].map(match => match[0]);
  if (!arraysEqual([...expected].sort(), [...actual].sort())) throw new TranslationValidationError("protected Markdown tokens were missing, duplicated or invented");
  const markup = token => /^<\/?[A-Za-z]/.test(plan.tokens[token]);
  if (!arraysEqual(expected.filter(markup), actual.filter(markup))) throw new TranslationValidationError("protected HTML tag order changed");
  for (const token of expected) {
    if (plan.tokens[token].startsWith("(") && translated[translated.indexOf(token) - 1] !== "]") {
      throw new TranslationValidationError("protected link destination detached from its label");
    }
  }
}

export function restoreMarkdownTranslation(plan, translated) {
  return plan.parts
    .map((part) => {
      if (!part.key) return part.value;
      validateMarkdownTokens(plan, part.value, translated[part.key]);
      // Structural whitespace belongs to Markdown, not the model.
      const [, leading, body, trailing] = part.value.match(/^(\s*)([\s\S]*?)(\s*)$/);
      const value = body ? `${leading}${translated[part.key].trim()}${trailing}` : part.value;
      return value.replace(plan.tokenPattern, token => plan.tokens[token]);
    })
    .join("");
}

export async function translateMeta(content, relativePath, client = translationClient) {
  const validate = (response) => {
    try {
      const translated = restoreMetaControlValues(content, response);
      validateDatabaseTerminology(content, translated);
      if (!arraysEqual(extractMetaKeys(content), extractMetaKeys(translated))) fail("translated metadata changed its keys");
    } catch (error) { throw new TranslationValidationError(error.message); }
  };
  const response = await client.translate(content, "meta", { context: relativePath, validate });
  return `${restoreMetaControlValues(content, response).trim()}\n`;
}

export function batchTranslationFragments(fragments, maxChars = 6000) {
  const batches = [];
  let batch = {};
  for (const [key, value] of Object.entries(fragments)) {
    if (JSON.stringify({ [key]: value }).length > maxChars) fail("translation fragment exceeds batch limit");
    if (Object.keys(batch).length && JSON.stringify({ ...batch, [key]: value }).length > maxChars) {
      batches.push(batch);
      batch = {};
    }
    batch[key] = value;
  }
  if (Object.keys(batch).length) batches.push(batch);
  return batches;
}

export async function translateMarkdownSection(section, relativePath, client = translationClient) {
  const maxChars = client.config.maxBatchChars;
  const plan = createMarkdownTranslationPlan(section, Math.min(2400, Math.floor((maxChars - 32) / 6)));
  const batches = batchTranslationFragments(plan.fragments, maxChars);
  const translated = {};
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i], expectedKeys = Object.keys(batch).sort();
    const validate = (response) => {
      let values;
      try { values = JSON.parse(response); } catch { throw new TranslationValidationError("translation returned invalid fragment JSON"); }
      if (!values || typeof values !== "object" || Array.isArray(values) || !arraysEqual(expectedKeys, Object.keys(values).sort())) {
        const missing = expectedKeys.filter(key => !values || !Object.hasOwn(values, key));
        throw new TranslationValidationError(`translation changed fragment keys; expected ${expectedKeys.join(",")}; missing ${missing.join(",") || "none"}`);
      }
      for (const key of expectedKeys) {
        if (typeof values[key] !== "string" || (!values[key].trim() && batch[key].trim())) throw new TranslationValidationError(`translation returned an empty or non-string fragment at ${key}`);
        validateMarkdownTokens(plan, batch[key], values[key]);
        try { validateDatabaseTerminology(batch[key], values[key]); }
        catch (error) { throw new TranslationValidationError(`${key}: ${error.message}`); }
      }
    };
    const response = await client.translate(JSON.stringify(batch), "fragments", { context: `${relativePath} batch ${i + 1}/${batches.length}`, validate });
    Object.assign(translated, JSON.parse(response));
  }
  return restoreMarkdownTranslation(plan, translated);
}

export async function translateDocument(newEnglish, oldEnglish, existingChinese, relativePath, client = translationClient) {
  const oldSections = segmentMarkdownSections(oldEnglish);
  const newSections = segmentMarkdownSections(newEnglish);
  const chineseSections = segmentMarkdownSections(existingChinese);
  const cachedTranslations = new Map();

  for (let index = 0; index < Math.min(oldSections.length, chineseSections.length); index += 1) {
    cachedTranslations.set(oldSections[index], chineseSections[index]);
  }

  const translatedSections = [];
  for (const [sectionIndex, section] of newSections.entries()) {
    if (cachedTranslations.has(section)) {
      translatedSections.push(cachedTranslations.get(section));
      continue;
    }
    translatedSections.push(await translateMarkdownSection(section, `${relativePath} section ${sectionIndex + 1}/${newSections.length}`, client));
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

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}
