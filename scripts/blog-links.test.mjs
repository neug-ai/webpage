import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDocumentationLinks } from "./lib/blog-links.mjs";

test("rewrites GitHub doc source links to English site docs", () => {
  const source = [
    "[GDS docs](https://github.com/alibaba/neug/blob/main/doc/source/extensions/load_gds.md)",
    "github.com/alibaba/neug/blob/main/doc/source/tutorials/code-graph-wiki-pipeline.md",
  ].join("\n");

  assert.equal(normalizeDocumentationLinks(source, "en"), [
    "[GDS docs](https://neug.io/docs/extensions/load_gds/)",
    "https://neug.io/docs/tutorials/code-graph-wiki-pipeline/",
  ].join("\n"));
});

test("uses Chinese site docs and preserves punctuation and anchors", () => {
  const source = "文档：https://github.com/alibaba/neug/blob/main/doc/source/data_io/import_data.md#copy-temp。";
  assert.equal(
    normalizeDocumentationLinks(source, "zh"),
    "文档：https://neug.io/zh/docs/data_io/import_data/#copy-temp。",
  );
});

test("normalizes an existing site-doc link to the output language", () => {
  assert.equal(
    normalizeDocumentationLinks("https://neug.io/docs/extensions/load_gds/", "zh"),
    "https://neug.io/zh/docs/extensions/load_gds/",
  );
  assert.equal(
    normalizeDocumentationLinks("https://neug.io/zh/docs/extensions/load_gds/", "en"),
    "https://neug.io/docs/extensions/load_gds/",
  );
});

test("leaves repository and non-doc-source GitHub links unchanged", () => {
  const source = [
    "https://github.com/alibaba/neug",
    "https://github.com/alibaba/neug/blob/main/extension/gds/Performance.md",
  ].join("\n");
  assert.equal(normalizeDocumentationLinks(source, "en"), source);
});
