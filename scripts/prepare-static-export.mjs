import { copyFile, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.join(process.cwd(), "out");
const configuredBasePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(
  /^\/+|\/+$/g,
  "",
);
const previewBasePath = configuredBasePath ? `/${configuredBasePath}` : "";
let copied = 0;
let rewritten = 0;

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(entryPath);
      continue;
    }
    if (entry.name !== "index.txt" || directory === outputDirectory) continue;

    const relativeDirectory = path.relative(outputDirectory, directory);
    await copyFile(entryPath, path.join(outputDirectory, `${relativeDirectory}.txt`));
    copied += 1;
  }
}

function prefixRootUrl(url) {
  if (
    !previewBasePath ||
    !url.startsWith("/") ||
    url.startsWith("//") ||
    url === previewBasePath ||
    url.startsWith(`${previewBasePath}/`)
  ) {
    return url;
  }

  return `${previewBasePath}${url}`;
}

async function rewritePreviewPaths(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await rewritePreviewPaths(entryPath);
      continue;
    }
    if (!entry.name.endsWith(".html")) continue;

    const source = await readFile(entryPath, "utf8");
    const next = source
      // Static HTML attributes.
      .replace(/\b(href|src)="(\/(?!\/)[^"]*)"/g, (_match, attribute, url) => {
        return `${attribute}="${prefixRootUrl(url)}"`;
      });

    if (next === source) continue;
    await writeFile(entryPath, next);
    rewritten += 1;
  }
}

await visit(outputDirectory);
console.log(`Created ${copied} static route payload aliases.`);

await rewritePreviewPaths(outputDirectory);
console.log(`Rewrote preview paths in ${rewritten} static output files.`);
