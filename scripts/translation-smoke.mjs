import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { translateMarkdownSection, splitProtectedMarkdown } from "./translate-neug-docs.mjs";

const root = path.resolve(import.meta.dirname, "..");
const source = path.resolve(root, process.env.NEUG_SOURCE_DIR || ".temp-source-repo");
const checkedOut = spawnSync("git", ["-C", source, "rev-parse", "HEAD"], { encoding: "utf8" });
if (checkedOut.status !== 0 || checkedOut.stdout.trim() !== process.env.NEUG_SOURCE_SHA) throw new Error("Smoke test requires the exact pinned NeuG source commit");
const cursor = fs.readFileSync(path.join(root, "last-sync.json"), "utf8");
const output = path.join(root, ".cache", "neug-translations", "smoke.md");
fs.mkdirSync(path.dirname(output), { recursive: true });
let report = `# Public documentation translation smoke\n\nSource: alibaba/neug@${checkedOut.stdout.trim()}\n\nStructural checks are automated. The generated Chinese below is retained for review, not published.\n`;
const cases = [
  { file: "extensions/fts_search.md", section: 2, heading: "## Create an FTS Index" },
  { file: "extensions/fts_search.md", section: 4, heading: "### Index Options" },
  { file: "reference/cpp_api/neug_db.md", section: 2, heading: "#### `Open(...)`" },
];
for (const item of cases) {
  const content = fs.readFileSync(path.join(source, "doc", "source", item.file), "utf8");
  const section = content.split(/(?=^#{1,6}\s)/m).filter(value => value.trim()).map(value => value.trim())[item.section];
  if (!section?.startsWith(item.heading)) throw new Error(`Smoke fixture heading changed: ${item.file}`);
  const translated = await translateMarkdownSection(section, `${item.file} smoke section ${item.section + 1}`);
  const codeBlocks = value => value.match(/```[\s\S]*?```|~~~[\s\S]*?~~~/g) || [];
  if (JSON.stringify(codeBlocks(section)) !== JSON.stringify(codeBlocks(translated))) throw new Error("Smoke changed a fenced code block");
  for (const part of splitProtectedMarkdown(section).filter(part => part.protected)) {
    if (!translated.includes(part.value)) throw new Error("Smoke lost protected code, markup, or link content");
  }
  if (item.file.endsWith("neug_db.md") && !/(?:否则|反之)[^\n]*`false`/.test(translated)) throw new Error("Smoke must express the otherwise/false return branch in Chinese order");
  if (fs.readFileSync(path.join(root, "last-sync.json"), "utf8") !== cursor) throw new Error("Smoke advanced the sync cursor");
  report += `\n## ${item.file} — section ${item.section + 1}\n\n${translated}\n`;
  fs.writeFileSync(output, report);
  console.log(`Translation smoke passed: ${item.file} section ${item.section + 1}; protected content and cursor unchanged`);
}
