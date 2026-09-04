/**
 * Remark plugin: fix relative links for Nextra trailingSlash routing.
 *
 * With trailingSlash: true, page data_io/export_data.md is served at
 * /data_io/export_data/, so the browser resolves relative links from
 * that directory — one level deeper than the file's actual directory.
 *
 * This plugin re-bases every relative link: resolve against the file's
 * directory (what the author intended), then compute the relative path
 * from the page's URL directory (what the browser sees).
 */

import { visit } from "unist-util-visit";
import path from "node:path";
import fs from "node:fs";

const SKIP_RE = /^(https?:\/\/|\/\/|mailto:|#|\/)/;
const IMAGE_RE = /\.(png|jpe?g|gif|svg|webp)$/i;

function normalize(link) {
  let l = link;
  if (l.endsWith(".md")) l = l.slice(0, -3);
  if (l.endsWith(".mdx")) l = l.slice(0, -4);
  if (l.endsWith("/index")) l = l.slice(0, -"/index".length);
  return l;
}

function docExists(p) {
  return (
    fs.existsSync(p + ".md") ||
    fs.existsSync(p + ".mdx") ||
    fs.existsSync(path.join(p, "index.md")) ||
    fs.existsSync(path.join(p, "index.mdx"))
  );
}

export function remarkFixLinks() {
  return (tree, vfile) => {
    const filePath = vfile.path;
    if (!filePath) return;

    const ext = path.extname(filePath);
    if (ext !== ".md" && ext !== ".mdx") return;

    const fileDir = path.dirname(filePath);
    const baseName = path.basename(filePath, ext);
    const isIndex = baseName === "index";
    const pageDir = isIndex ? fileDir : path.join(fileDir, baseName);

    visit(tree, "link", (node) => {
      const href = node.url;
      if (!href || SKIP_RE.test(href)) return;

      const hashIdx = href.indexOf("#");
      const pathPart = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
      const fragPart = hashIdx >= 0 ? href.slice(hashIdx) : "";

      if (!pathPart) return;
      if (IMAGE_RE.test(pathPart)) return;

      const normalized = normalize(pathPart);
      const intendedTarget = path.resolve(fileDir, normalized);

      // Only rebase links whose fileDir-resolved target actually exists.
      // Some source docs use links already relative to the page URL
      // (correct for trailingSlash) rather than the file directory;
      // rebasing those would add an extra ../ and break them.
      if (!docExists(intendedTarget)) return;

      let newRel = path.relative(pageDir, intendedTarget);
      if (!newRel) newRel = ".";

      node.url = newRel + fragPart;
    });
  };
}
