import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import matter from "gray-matter";

const root = path.resolve(process.env.NEUG_WEBPAGE_ROOT || path.resolve(import.meta.dirname, ".."));
const sourceRoot = path.resolve(root, process.env.NEUG_WIKI_SOURCE_DIR || ".temp-wiki-repo");
const sourceSlug = process.env.NEUG_BLOG_SLUG || "";
const requestedSiteSlug = process.env.NEUG_BLOG_SITE_SLUG || "";
const requestedDate = process.env.NEUG_BLOG_DATE || new Date().toISOString().slice(0, 10);
const expectedSourceCommit = process.env.NEUG_WIKI_SOURCE_SHA || "";
const enRoot = path.join(root, "content", "en", "blog");
const zhRoot = path.join(root, "content", "zh", "blog");
const publicBlogRoot = path.join(root, "public", "images", "blog");
const statePath = path.join(root, "blog-sync.json");
const apiKey = process.env.OPENAI_API_KEY || "";
const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const model = process.env.OPENAI_MODEL || "qwen-plus";
const allowedCategories = new Set(["release", "engineering", "ecosystem", "case-study"]);

function fail(message) {
  throw new Error(message);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeIfChanged(file, content) {
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === content) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}

function copyIfChanged(source, target) {
  if (fs.existsSync(target) && fs.readFileSync(source).equals(fs.readFileSync(target))) return false;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  return true;
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(file) : entry.isFile() ? [file] : [];
  });
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fingerprintOf(parts) {
  const hash = crypto.createHash("sha256");
  for (const part of parts) hash.update(part);
  return hash.digest("hex");
}

function git(args) {
  const result = spawnSync("git", ["-C", sourceRoot, ...args], { encoding: "utf8" });
  if (result.status !== 0) fail(result.stderr.trim() || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeDate(value, fallback) {
  const date = value instanceof Date ? value.toISOString().slice(0, 10) : String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : fallback;
}

function extractArticle(markdown, fallbackTitle = "") {
  const heading = markdown.match(/^\s*#\s+([^\n]+)\s*(?:\r?\n|$)/);
  const title = String(fallbackTitle || heading?.[1] || "").trim();
  if (!title) fail("blog-en.md must contain a title or a level-one heading");
  const body = heading ? markdown.slice(heading[0].length).trim() : markdown.trim();
  return { title, body };
}

function excerpt(markdown, fallback) {
  const withoutCode = markdown.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, "");
  for (const block of withoutCode.split(/\n\s*\n/)) {
    const value = block
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !/^(#{1,6}\s|!\[|import\s|export\s|\|[-:| ]+\|$)/.test(line))
      .map((line) => line.replace(/^>\s?/, "").replace(/^[-*+]\s+/, ""))
      .join(" ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_~]/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (value.length >= 20) return value.length > 240 ? `${value.slice(0, 237).trimEnd()}...` : value;
  }
  return fallback;
}

function normalizeImagePaths(markdown, siteSlug) {
  const prefix = `/images/blog/${siteSlug}/`;
  return markdown
    .replace(/(\]\()(?:\.\/)?images_en\/([^\s)]+)(?=[)\s])/g, `$1${prefix}$2`)
    .replace(/(\bsrc=["'])(?:\.\/)?images_en\/([^"']+)(["'])/g, `$1${prefix}$2$3`);
}

function withCover(body, cover, alt) {
  if (!cover || body.includes(cover)) return body.trim();
  return `![${alt}](${cover})\n\n${body.trim()}`;
}

function withoutGeneratedCover(body, cover) {
  if (!cover) return body.trim();
  const escapedCover = cover.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return body.replace(new RegExp(`^!\\[[^\\]]*\\]\\(${escapedCover}\\)\\s*`), "").trim();
}

function protectMarkdown(content) {
  const protectedValues = [];
  const token = (value) => {
    const placeholder = `@@NEUG_BLOG_PROTECTED_${String(protectedValues.length).padStart(4, "0")}@@`;
    protectedValues.push({ placeholder, value });
    return placeholder;
  };

  const protectedContent = content
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, token)
    .replace(/^\s*(?:import|export)\s.+$/gm, token)
    .replace(/<\/?[A-Za-z][^>]*>/g, token)
    .replace(/`[^`\n]+`/g, token)
    .replace(/(\]\()([^)]+)(\))/g, (_, opening, destination, closing) => `${opening}${token(destination)}${closing}`)
    .replace(/https?:\/\/[^\s)>'"]+/g, token)
    .replace(/\{[^{}\n]*\}/g, token);

  return {
    content: protectedContent,
    restore(translated) {
      for (const item of protectedValues) {
        const occurrences = translated.split(item.placeholder).length - 1;
        if (occurrences !== 1) fail(`translation changed protected content (${item.placeholder})`);
        translated = translated.replace(item.placeholder, item.value);
      }
      return translated;
    },
  };
}

function translationChunks(content) {
  const sections = content.split(/(?=^#{1,6}\s)/m).filter((section) => section.trim());
  return sections.flatMap((section) => {
    if (section.length <= 12_000) return [section.trim()];
    const chunks = [];
    let current = "";
    for (const paragraph of section.split(/\n\s*\n/)) {
      if (current && current.length + paragraph.length > 12_000) {
        chunks.push(current.trim());
        current = "";
      }
      current += `${current ? "\n\n" : ""}${paragraph}`;
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  });
}

function stripOuterFence(content) {
  return content.trim().replace(/^```(?:markdown|md|mdx)?\s*/i, "").replace(/\s*```$/, "").trim();
}

async function requestTranslation(content) {
  if (!apiKey) fail("DASHSCOPE_API_KEY or QWEN_API_KEY is required for a new or changed blog post");
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
            {
              role: "system",
              content: "Translate this NeuG technical blog post from English to Simplified Chinese. Preserve all Markdown/MDX structure and every protected placeholder exactly. Keep product names, API names, identifiers, URLs, code, and commands unchanged. Return only the translated Markdown.",
            },
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
      return stripOuterFence(translated);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
  fail(`translation failed after 3 attempts: ${lastError?.message || lastError}`);
}

async function translateMarkdown(content) {
  const protectedArticle = protectMarkdown(content);
  const translated = [];
  for (const chunk of translationChunks(protectedArticle.content)) {
    translated.push(await requestTranslation(chunk));
  }
  return protectedArticle.restore(translated.join("\n\n").trim());
}

function serializePost(metadata, body) {
  return matter.stringify(`${body.trim()}\n`, metadata);
}

function syncAssets(sourceDirectory, targetDirectory, banner) {
  const mappings = [];
  const imagesDirectory = path.join(sourceDirectory, "images_en");
  for (const file of walkFiles(imagesDirectory)) {
    mappings.push({ source: file, relative: toPosix(path.relative(imagesDirectory, file)) });
  }
  if (banner) mappings.push({ source: banner, relative: path.basename(banner) });

  const desired = new Set(mappings.map(({ relative }) => relative));
  let copied = 0;
  let removed = 0;
  for (const mapping of mappings) {
    if (copyIfChanged(mapping.source, path.join(targetDirectory, mapping.relative))) copied += 1;
  }
  for (const file of walkFiles(targetDirectory)) {
    const relative = toPosix(path.relative(targetDirectory, file));
    if (!desired.has(relative)) {
      fs.unlinkSync(file);
      removed += 1;
    }
  }
  return { mappings, copied, removed };
}

async function main() {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(sourceSlug) || sourceSlug.includes("..")) {
    fail("NEUG_BLOG_SLUG must be a single directory name under raw/blogs");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) fail("NEUG_BLOG_DATE must use YYYY-MM-DD");

  const sourceCommit = git(["rev-parse", "HEAD"]);
  if (expectedSourceCommit && sourceCommit !== expectedSourceCommit) {
    fail(`expected neug-wiki ${expectedSourceCommit}, but ${sourceCommit} is checked out`);
  }

  const state = readJson(statePath, { sourceRepository: "neug-ai/wiki", posts: {} });
  const previous = state.posts?.[sourceSlug] || {};
  const siteSlug = previous.siteSlug || slugify(requestedSiteSlug || sourceSlug);
  if (!siteSlug) fail("unable to derive a website slug for the blog post");

  const sourceDirectory = path.join(sourceRoot, "raw", "blogs", sourceSlug);
  const sourcePostPath = path.join(sourceDirectory, "blog-en.md");
  if (!fs.existsSync(sourcePostPath)) fail(`blog-en.md was not found in raw/blogs/${sourceSlug}`);

  const rawSource = fs.readFileSync(sourcePostPath, "utf8");
  const parsedSource = matter(rawSource);
  const normalizedMarkdown = normalizeImagePaths(parsedSource.content, siteSlug);
  const englishArticle = extractArticle(normalizedMarkdown, parsedSource.data.title);
  const banner = fs.existsSync(sourceDirectory)
    ? fs.readdirSync(sourceDirectory).map((name) => path.join(sourceDirectory, name)).find((file) => fs.statSync(file).isFile() && /^banner_en\.(?:png|jpe?g|gif|svg|webp|avif)$/i.test(path.basename(file)))
    : undefined;
  const assetSources = [
    ...walkFiles(path.join(sourceDirectory, "images_en")),
    ...(banner ? [banner] : []),
  ].sort();
  const fingerprint = fingerprintOf([
    rawSource,
    ...assetSources.flatMap((file) => [toPosix(path.relative(sourceDirectory, file)), fs.readFileSync(file)]),
  ]);

  const enPath = path.join(enRoot, `${siteSlug}.mdx`);
  const zhPath = path.join(zhRoot, `${siteSlug}.mdx`);
  const assetTargetDirectory = path.join(publicBlogRoot, siteSlug);
  const expectedAssets = assetSources.map((file) => banner && file === banner
    ? path.basename(file)
    : toPosix(path.relative(path.join(sourceDirectory, "images_en"), file)));
  const outputsComplete = fs.existsSync(enPath)
    && fs.existsSync(zhPath)
    && expectedAssets.every((relative) => fs.existsSync(path.join(assetTargetDirectory, relative)));
  if (previous.fingerprint === fingerprint && outputsComplete) {
    console.log(`No source changes detected for ${sourceSlug}.`);
    return;
  }

  const existingEnglish = fs.existsSync(enPath) ? matter(fs.readFileSync(enPath, "utf8")) : { data: {}, content: "" };
  const existingChinese = fs.existsSync(zhPath) ? matter(fs.readFileSync(zhPath, "utf8")) : { data: {}, content: "" };
  const date = normalizeDate(existingEnglish.data.date || parsedSource.data.date, previous.date || requestedDate);
  const cover = banner ? `/images/blog/${siteSlug}/${path.basename(banner)}` : "";
  const category = allowedCategories.has(existingEnglish.data.category)
    ? existingEnglish.data.category
    : allowedCategories.has(parsedSource.data.category) ? parsedSource.data.category : "engineering";
  const sharedMetadata = {
    date,
    author: String(existingEnglish.data.author || parsedSource.data.author || "NeuG Team"),
    category,
    tags: Array.isArray(existingEnglish.data.tags) && existingEnglish.data.tags.length
      ? existingEnglish.data.tags.map(String)
      : Array.isArray(parsedSource.data.tags) && parsedSource.data.tags.length ? parsedSource.data.tags.map(String) : ["NeuG"],
    cover,
    translationKey: siteSlug,
    draft: false,
    aliases: Array.isArray(existingEnglish.data.aliases) ? existingEnglish.data.aliases.map(String) : [],
  };
  if (previous.fingerprint && requestedDate !== date) sharedMetadata.updated = requestedDate;

  const englishBody = withCover(englishArticle.body, cover, "Article cover");
  writeIfChanged(enPath, serializePost({
    title: englishArticle.title,
    description: String(parsedSource.data.description || excerpt(englishArticle.body, englishArticle.title)),
    ...sharedMetadata,
    locale: "en",
  }, englishBody));

  const needsTranslation = previous.sourceHash !== sha256(rawSource) || !fs.existsSync(zhPath);
  if (needsTranslation) {
    const translatedMarkdown = await translateMarkdown(`# ${englishArticle.title}\n\n${englishArticle.body}`);
    const chineseArticle = extractArticle(translatedMarkdown);
    const chineseBody = withCover(chineseArticle.body, cover, "文章封面");
    writeIfChanged(zhPath, serializePost({
      title: chineseArticle.title,
      description: excerpt(chineseArticle.body, chineseArticle.title),
      ...sharedMetadata,
      locale: "zh",
      aliases: Array.isArray(existingChinese.data.aliases) ? existingChinese.data.aliases.map(String) : [],
    }, chineseBody));
  } else {
    writeIfChanged(zhPath, serializePost({
      ...existingChinese.data,
      date,
      category,
      tags: sharedMetadata.tags,
      cover,
      translationKey: siteSlug,
      draft: false,
      locale: "zh",
      ...(sharedMetadata.updated ? { updated: sharedMetadata.updated } : {}),
    }, withCover(
      withoutGeneratedCover(existingChinese.content, String(existingChinese.data.cover || cover)),
      cover,
      "文章封面",
    )));
  }

  const assets = syncAssets(sourceDirectory, assetTargetDirectory, banner);
  const nextState = {
    sourceRepository: "neug-ai/wiki",
    posts: {
      ...(state.posts || {}),
      [sourceSlug]: {
        siteSlug,
        commit: sourceCommit,
        sourceHash: sha256(rawSource),
        fingerprint,
        date,
        syncedAt: new Date().toISOString(),
        assets: assets.mappings.map(({ relative }) => relative).sort(),
      },
    },
  };
  writeIfChanged(statePath, `${JSON.stringify(nextState, null, 2)}\n`);

  console.log(`Synchronized ${sourceSlug} as ${siteSlug}.`);
  console.log(`Chinese translation: ${needsTranslation ? "updated" : "reused"}.`);
  console.log(`Assets: ${assets.copied} updated, ${assets.removed} removed.`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
