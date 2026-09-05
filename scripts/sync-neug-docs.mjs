import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.resolve(root, process.env.NEUG_SOURCE_DIR || ".temp-source-repo");
const sourceDocs = path.join(sourceRoot, "doc", "source");
const enRoot = path.join(root, "content", "en");
const zhRoot = path.join(root, "content", "zh");
const publicImages = path.join(root, "public", "images");
const statePath = path.join(root, "last-sync.json");
const planPath = path.join(root, ".neug-sync-plan.json");
const preservedRoots = new Set(["blog"]);
const documentExtensions = new Set([".md", ".mdx"]);
const assetExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif"]);
const junkExtensions = new Set([".rst", ".py", ".sh", ".json", ".yaml", ".yml", ".toml", ".txt", ".html", ".css", ".js", ".conf", ".make", ".pyc"]);

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function toPosix(value) {
  return value.split(path.sep).join("/");
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
  if (fs.existsSync(target)) {
    const sourceBuffer = fs.readFileSync(source);
    const targetBuffer = fs.readFileSync(target);
    if (sourceBuffer.equals(targetBuffer)) return false;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  return true;
}

function git(args, allowFailure = false) {
  const result = spawnSync("git", ["-C", sourceRoot, ...args], { encoding: "utf8" });
  if (result.status !== 0 && !allowFailure) {
    fail(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.status === 0 ? result.stdout.trim() : "";
}

function gitObjectExists(revision) {
  return spawnSync("git", ["-C", sourceRoot, "cat-file", "-e", revision]).status === 0;
}

function isDocument(relativePath) {
  return documentExtensions.has(path.posix.extname(relativePath)) || path.posix.basename(relativePath) === "_meta.ts";
}

function isAsset(relativePath) {
  const parts = relativePath.split("/");
  return parts.some((part) => part === "images" || part === "figures") && assetExtensions.has(path.posix.extname(relativePath).toLowerCase());
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

function sourceChanges(previousCommit, sourceCommit, currentFiles) {
  const relevant = (relativePath) => isDocument(relativePath) || isAsset(relativePath);
  const fallback = currentFiles.filter(relevant).map((relativePath) => ({ status: "A", path: relativePath, oldPath: null }));
  if (!previousCommit || !gitObjectExists(`${previousCommit}^{commit}`)) return fallback;

  const output = git(["diff", "--name-status", "-M", previousCommit, sourceCommit, "--", "doc/source"], true);
  if (!output) return [];

  return output.split("\n").flatMap((line) => {
    const fields = line.split("\t");
    const status = fields[0];
    if (status.startsWith("R") || status.startsWith("C")) {
      const oldPath = fields[1]?.replace(/^doc\/source\//, "");
      const newPath = fields[2]?.replace(/^doc\/source\//, "");
      if (!newPath || (!relevant(newPath) && !relevant(oldPath || ""))) return [];
      return [{ status: status[0], path: newPath, oldPath }];
    }
    const relativePath = fields[1]?.replace(/^doc\/source\//, "");
    if (!relativePath || !relevant(relativePath)) return [];
    return [{ status: status[0], path: relativePath, oldPath: status[0] === "D" ? relativePath : null }];
  });
}

function removeEmptyDirectories(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirectories(path.join(directory, entry.name));
  }
  if (directory !== enRoot && directory !== zhRoot && fs.readdirSync(directory).length === 0) fs.rmdirSync(directory);
}

if (!fs.existsSync(sourceDocs)) fail(`NeuG documentation was not found at ${sourceDocs}`);

const sourceCommit = process.env.NEUG_SOURCE_SHA || git(["rev-parse", "HEAD"]);
const checkedOutCommit = git(["rev-parse", "HEAD"]);
if (sourceCommit !== checkedOutCommit) fail(`Expected NeuG ${sourceCommit}, but ${checkedOutCommit} is checked out`);

const state = readJson(statePath, {});
const sourceFiles = walkFiles(sourceDocs).map((file) => toPosix(path.relative(sourceDocs, file))).sort();
const sourceDocuments = sourceFiles.filter(isDocument);
const sourceDocumentSet = new Set(sourceDocuments);
const sourceAssets = sourceFiles.filter(isAsset);
const managedAssets = sourceAssets.map(assetTarget).sort();
const allChanges = sourceChanges(state.commit, sourceCommit, sourceFiles);
const changes = allChanges.filter((change) => isDocument(change.path) || isDocument(change.oldPath || ""));
const assetChanges = allChanges.filter((change) => isAsset(change.path) || isAsset(change.oldPath || ""));
const changedPaths = new Set(changes.filter((change) => change.status !== "D").map((change) => change.path));
const previousEnglish = {};

let copiedDocuments = 0;
let removedDocuments = 0;
let copiedAssets = 0;
let removedAssets = 0;

for (const relativePath of sourceDocuments) {
  const target = path.join(enRoot, relativePath);
  if (!fs.existsSync(target) && !changes.some((change) => change.path === relativePath)) {
    changes.push({ status: "A", path: relativePath, oldPath: null });
    changedPaths.add(relativePath);
  }
}

for (const change of changes) {
  if (change.status === "D") {
    const removedPath = path.join(enRoot, change.oldPath || change.path);
    if (fs.existsSync(removedPath)) {
      fs.unlinkSync(removedPath);
      removedDocuments += 1;
    }
    continue;
  }

  const relativePath = change.path;
  if (!sourceDocumentSet.has(relativePath)) continue;
  const source = path.join(sourceDocs, relativePath);
  const target = path.join(enRoot, relativePath);
  const previousPath = change.status === "R" && change.oldPath ? path.join(enRoot, change.oldPath) : target;
  const previousContent = fs.existsSync(previousPath) ? fs.readFileSync(previousPath, "utf8") : "";
  let content = fs.readFileSync(source, "utf8");
  if (relativePath === "_meta.ts") content = addHiddenBlogEntry(content);
  if (documentExtensions.has(path.posix.extname(relativePath))) content = rewriteImagePaths(content, relativePath);
  if (previousContent && previousContent !== content) previousEnglish[relativePath] = previousContent;
  if (writeIfChanged(target, content)) {
    copiedDocuments += 1;
    changedPaths.add(relativePath);
  }
  if (change.status === "R" && change.oldPath && change.oldPath !== relativePath) {
    const oldTarget = path.join(enRoot, change.oldPath);
    if (fs.existsSync(oldTarget)) {
      fs.unlinkSync(oldTarget);
      removedDocuments += 1;
    }
  }
}

for (const file of walkFiles(enRoot)) {
  const relativePath = toPosix(path.relative(enRoot, file));
  if (preservedRoots.has(relativePath.split("/")[0])) continue;
  const basename = path.posix.basename(relativePath);
  const extension = path.posix.extname(relativePath).toLowerCase();
  const generatedJunk = junkExtensions.has(extension) || ["Doxyfile", "Makefile", "sphinx_ext.py", "conf.py"].includes(basename);
  if (generatedJunk) {
    fs.unlinkSync(file);
    removedDocuments += 1;
  }
}

for (const relativePath of sourceAssets) {
  const target = path.join(publicImages, assetTarget(relativePath));
  if (!fs.existsSync(target) && !assetChanges.some((change) => change.path === relativePath)) {
    assetChanges.push({ status: "A", path: relativePath, oldPath: null });
  }
}

for (const change of assetChanges) {
  if (change.status !== "D" && sourceAssets.includes(change.path)) {
    if (copyIfChanged(path.join(sourceDocs, change.path), path.join(publicImages, assetTarget(change.path)))) copiedAssets += 1;
  }
  if ((change.status === "D" || change.status === "R") && change.oldPath) {
    const oldTarget = path.join(publicImages, assetTarget(change.oldPath));
    if (fs.existsSync(oldTarget) && assetTarget(change.oldPath) !== assetTarget(change.path)) {
      fs.unlinkSync(oldTarget);
      removedAssets += 1;
    }
  }
}

for (const previousAsset of state.sourceRepository ? state.assets || [] : []) {
  if (managedAssets.includes(previousAsset)) continue;
  const target = path.join(publicImages, previousAsset);
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
    removedAssets += 1;
  }
}

removeEmptyDirectories(enRoot);

let version = process.env.NEUG_VERSION || "";
if (!version) {
  const versionFile = ["NEUG_VERSION", "tools/python_bind/VERSION"].map((name) => path.join(sourceRoot, name)).find(fs.existsSync);
  if (!versionFile) fail("Unable to determine the NeuG version");
  version = fs.readFileSync(versionFile, "utf8").trim();
}
if (!version.startsWith("v")) version = `v${version}`;

const previousVersionInfo = readJson(path.join(root, "version-info.json"), {});
const shortCommit = git(["rev-parse", "--short", sourceCommit]);
let metadataChanged = previousVersionInfo.version !== version || previousVersionInfo.commit !== shortCommit;
if (metadataChanged) {
  writeIfChanged(
    path.join(root, "version-info.json"),
    `${JSON.stringify({ version, commit: shortCommit, syncedAt: new Date().toISOString() }, null, 2)}\n`,
  );
}

const versionsPath = path.join(root, "versions.json");
const versions = readJson(versionsPath, { current: version, versions: [] });
const releasedAt = process.env.NEUG_RELEASED_AT || "";
const existingVersion = versions.versions.find((item) => item.version === version);
const releaseDate = releasedAt ? releasedAt.slice(0, 10) : existingVersion?.releaseDate || new Date().toISOString().slice(0, 10);
const nextVersions = versions.versions.filter((item) => item.version !== version).map((item) => ({
  ...item,
  label: item.version,
  isLatest: false,
}));
nextVersions.unshift({ version, label: `${version} (Latest)`, isLatest: true, releaseDate });
const nextVersionData = { current: version, versions: nextVersions };
if (JSON.stringify(versions) !== JSON.stringify(nextVersionData)) {
  writeIfChanged(versionsPath, `${JSON.stringify(nextVersionData, null, 2)}\n`);
  metadataChanged = true;
}

const plan = {
  sourceRepository: "alibaba/neug",
  previousCommit: state.commit || "",
  sourceCommit,
  version,
  changes: changes.map((change) => ({ ...change, changedOnDisk: changedPaths.has(change.path) })),
  changedPaths: [...changedPaths].sort(),
  previousEnglish,
  files: sourceDocuments,
  assets: managedAssets,
  metadataChanged,
};
fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);

console.log(`NeuG ${version} (${shortCommit}) synchronized.`);
console.log(`Documents: ${copiedDocuments} updated, ${removedDocuments} removed.`);
console.log(`Assets: ${copiedAssets} updated, ${removedAssets} removed.`);
console.log(`Translation candidates: ${plan.changedPaths.length}.`);
