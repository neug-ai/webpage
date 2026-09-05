import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

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

function addHiddenBlogEntry(meta) {
  if (/^\s*blog\s*:/m.test(meta)) return meta;
  return meta.replace(/\n?};\s*$/, '\n  blog: { display: "hidden" },\n};\n');
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
  if (relativePath === "_meta.ts") return addHiddenBlogEntry(content);
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

function protectMarkdown(content) {
  const protectedValues = [];
  const token = (value) => {
    const placeholder = `@@NEUG_PROTECTED_${String(protectedValues.length).padStart(4, "0")}@@`;
    protectedValues.push({ placeholder, value });
    return placeholder;
  };

  let protectedContent = content
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, token)
    .replace(/^\s*(?:import|export)\s.+$/gm, token)
    .replace(/<\/?[A-Za-z][^>]*>/g, token)
    .replace(/`[^`\n]+`/g, token)
    .replace(/https?:\/\/[^\s)>'"]+/g, token);

  return {
    content: protectedContent,
    restore(translated) {
      for (const item of protectedValues) {
        const occurrences = translated.split(item.placeholder).length - 1;
        if (occurrences !== 1) fail(`Translation changed protected content (${item.placeholder})`);
        translated = translated.replace(item.placeholder, item.value);
      }
      return translated;
    },
  };
}

function stripCodeFence(content) {
  return content.trim().replace(/^```(?:markdown|md|mdx|typescript|ts)?\s*/i, "").replace(/\s*```$/, "").trim();
}

async function requestTranslation(content, kind) {
  if (!apiKey) fail("QWEN_API_KEY is required when English documentation has translatable changes");

  const system = kind === "meta"
    ? "Translate the string values in this TypeScript metadata object from English to Simplified Chinese. Keep every key, object shape, punctuation mark, and non-string expression unchanged. Return only valid TypeScript."
    : "Translate this NeuG technical documentation from English to Simplified Chinese. Preserve Markdown/MDX structure and every protected placeholder exactly. Keep product names, API names, identifiers, command names, URLs, and code unchanged. Return only the translated content.";
  const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
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
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
  fail(`translation failed after 3 attempts: ${lastError?.message || lastError}`);
}

async function translateMeta(content, relativePath) {
  const translated = await requestTranslation(content, "meta");
  if (!arraysEqual(extractMetaKeys(content), extractMetaKeys(translated))) {
    fail(`${relativePath}: translated metadata changed its keys`);
  }
  return `${translated.trim()}\n`;
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
    const protectedSection = protectMarkdown(section);
    const translated = await requestTranslation(protectedSection.content, "markdown");
    translatedSections.push(protectedSection.restore(translated));
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
  for (const relativePath of [...candidates].sort()) {
    if (!plan.files.includes(relativePath)) continue;
    const englishPath = path.join(enRoot, relativePath);
    if (!fs.existsSync(englishPath)) continue;

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

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
