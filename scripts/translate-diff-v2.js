// Diff-based translation script for CI and local use.
// Reads old EN from git history, translates only changed sections,
// preserves existing Chinese on failure (never overwrites with English).
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

try { require("dotenv").config(); } catch {}

const BASE_URL = (process.env.OPENAI_BASE_URL || "").replace(/\/$/, "");
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.QWEN_MODEL || "qwen-plus";
const TEMP_REPO = path.join(__dirname, "..", ".temp-source-repo");
const CONTENT_DIR = path.join(__dirname, "..", "content");
const LAST_SYNC_FILE = path.join(__dirname, "..", "last-sync.json");
const LAST_SYNC = JSON.parse(
  fs.readFileSync(LAST_SYNC_FILE, "utf-8")
).commit;

function segmentByHeadings(content) {
  return content
    .split(/(?=^#{1,6}\s)/m)
    .filter((c) => c.trim())
    .map((c) => c.trim());
}

function getOldEn(relPath) {
  try {
    return execSync(
      `cd "${TEMP_REPO}" && git show ${LAST_SYNC}:doc/source/${relPath}`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    );
  } catch {
    return "";
  }
}

function getLatestCommit() {
  return execSync(`cd "${TEMP_REPO}" && git rev-parse HEAD`, {
    encoding: "utf-8",
  }).trim();
}

async function translate(text, isMdx) {
  const mdxRule = isMdx
    ? " Do NOT translate MDX imports (import {...} from ...), JSX tags (<Tab>, <Tabs>, </Tab>), or component attributes."
    : "";
  const systemPrompt = `You are a professional technical translator. Translate the following content from English to Chinese (Simplified). Rules: 1) Do NOT translate code blocks. 2) Do NOT translate URLs or link paths. 3) Keep all formatting intact. 4) Translate comments inside code blocks. 5) Keep technical terms (NeuG, PageRank, BFS, etc.) untranslated.${mdxRule} Return ONLY the translated content.`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Translate to Chinese:\n\n${text}` },
          ],
          max_tokens: 8192,
          temperature: 0.1,
          stream: false,
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.choices[0].message.content.trim();
    } catch (err) {
      console.log(`    ⚠️ Attempt ${attempt + 1} failed: ${err.message}`);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  throw new Error(`Translation failed after 3 retries`);
}

async function processFile(relPath) {
  const newEnPath = path.join(CONTENT_DIR, "en", relPath);
  const zhPath = path.join(CONTENT_DIR, "zh", relPath);
  const isMdx = relPath.endsWith(".mdx");

  if (!fs.existsSync(newEnPath)) {
    console.log(`\n📄 ${relPath} (deleted in source, skipping)`);
    return { translated: 0, cached: 0, failed: 0 };
  }

  const oldEn = getOldEn(relPath);
  const newEn = fs.readFileSync(newEnPath, "utf-8");
  const existingZh = fs.existsSync(zhPath) ? fs.readFileSync(zhPath, "utf-8") : "";

  const oldSections = segmentByHeadings(oldEn);
  const newSections = segmentByHeadings(newEn);
  const zhSections = segmentByHeadings(existingZh);

  console.log(`\n📄 ${relPath}`);
  console.log(`  Old EN: ${oldSections.length}, New EN: ${newSections.length}, ZH: ${zhSections.length}`);

  const enToZhMap = new Map();
  for (let i = 0; i < oldSections.length && i < zhSections.length; i++) {
    enToZhMap.set(oldSections[i], zhSections[i]);
  }

  let translatedCount = 0;
  let cachedCount = 0;
  let failedCount = 0;
  const result = [];

  for (let i = 0; i < newSections.length; i++) {
    const section = newSections[i];

    if (enToZhMap.has(section)) {
      result.push(enToZhMap.get(section));
      cachedCount++;
    } else {
      console.log(`  → Translating section ${i + 1}/${newSections.length} (${section.length} chars)`);
      try {
        const translated = await translate(section, isMdx);
        result.push(translated);
        translatedCount++;
      } catch {
        // On failure: use existing zh section (outdated but Chinese) or English fallback
        console.log(`    ❌ Section failed, using fallback`);
        if (i < zhSections.length) {
          result.push(zhSections[i]);
        } else {
          result.push(section);
        }
        failedCount++;
      }
    }
  }

  console.log(`  ✅ Cached: ${cachedCount}, Translated: ${translatedCount}, Failed: ${failedCount}`);

  fs.mkdirSync(path.dirname(zhPath), { recursive: true });
  fs.writeFileSync(zhPath, result.join("\n\n") + "\n", "utf-8");
  return { translated: translatedCount, cached: cachedCount, failed: failedCount };
}

async function main() {
  if (!API_KEY) {
    console.log("⚠️ OPENAI_API_KEY not set, skipping translation");
    return;
  }
  if (!fs.existsSync(TEMP_REPO)) {
    console.log("⚠️ .temp-source-repo not found, skipping translation");
    return;
  }

  const changedFiles = execSync(
    `cd "${TEMP_REPO}" && git diff --name-only ${LAST_SYNC} HEAD -- doc/source/`,
    { encoding: "utf-8" }
  )
    .trim()
    .split("\n")
    .filter((f) => (f.endsWith(".md") || f.endsWith(".mdx")) && f.startsWith("doc/source/"))
    .map((f) => f.replace("doc/source/", ""));

  console.log(`🔧 Model: ${MODEL}`);
  console.log(`📋 Last sync: ${LAST_SYNC.substring(0, 8)}`);
  console.log(`📋 ${changedFiles.length} changed files to translate`);

  if (changedFiles.length === 0) {
    console.log("✅ No changes to translate");
    return;
  }

  let totalTranslated = 0;
  let totalCached = 0;
  let totalFailed = 0;

  for (const relPath of changedFiles) {
    try {
      const stats = await processFile(relPath);
      totalTranslated += stats.translated;
      totalCached += stats.cached;
      totalFailed += stats.failed;
    } catch (err) {
      console.error(`  ❌ File failed: ${err.message}`);
    }
  }

  // Update last-sync.json so next sync is incremental
  const latestCommit = getLatestCommit();
  fs.writeFileSync(
    LAST_SYNC_FILE,
    JSON.stringify(
      { commit: latestCommit, timestamp: new Date().toISOString(), files: changedFiles },
      null,
      2
    ) + "\n"
  );

  console.log(`\n📊 Summary: ${totalTranslated} translated, ${totalCached} cached, ${totalFailed} failed`);
  console.log(`📝 Updated last-sync.json → ${latestCommit.substring(0, 8)}`);
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
