import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { blogMetadataSchema } from "../src/lib/blog";

const root = process.cwd();
const locales = ["en", "zh"] as const;
const errors: string[] = [];
const slugsByLocale = new Map<string, Set<string>>();
const docsByLocale = new Map<string, Set<string>>();

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

for (const locale of locales) {
  const contentRoot = path.join(root, "content", locale);
  const blogRoot = path.join(contentRoot, "blog");
  const blogFiles = fs.readdirSync(blogRoot).filter((file) => file.endsWith(".mdx"));
  const slugs = new Set(blogFiles.map((file) => file.replace(/\.mdx$/, "")));
  slugsByLocale.set(locale, slugs);

  if (blogFiles.length === 0) errors.push(`${locale}: no blog posts found`);

  for (const file of blogFiles) {
    const fullPath = path.join(blogRoot, file);
    const source = fs.readFileSync(fullPath, "utf8");
    const { data, content } = matter(source);
    const result = blogMetadataSchema.safeParse(data);
    if (!result.success) {
      errors.push(`${path.relative(root, fullPath)}: ${result.error.message}`);
      continue;
    }

    const slug = file.replace(/\.mdx$/, "");
    if (result.data.locale !== locale || result.data.translationKey !== slug) {
      errors.push(`${path.relative(root, fullPath)}: locale or translationKey mismatch`);
    }

    const imagePaths = [
      result.data.cover,
      ...Array.from(content.matchAll(/!\[[^\]]*\]\((\/images\/[^)\s]+)(?:\s+"[^"]*")?\)/g), (match) => match[1]),
    ].filter(Boolean);

    for (const imagePath of imagePaths) {
      if (!fs.existsSync(path.join(root, "public", imagePath.slice(1)))) {
        errors.push(`${path.relative(root, fullPath)}: missing ${imagePath}`);
      }
    }

    if (source.includes("/blog/assets/")) {
      errors.push(`${path.relative(root, fullPath)}: contains legacy /blog/assets path`);
    }
  }

  const docs = new Set(
    walk(contentRoot)
      .filter((file) => /\.mdx?$/.test(file) && !file.includes(`${path.sep}blog${path.sep}`))
      .map((file) => path.relative(contentRoot, file).split(path.sep).join("/")),
  );
  docsByLocale.set(locale, docs);
  if (docs.size === 0) errors.push(`${locale}: no documentation pages found`);
}

const enSlugs = slugsByLocale.get("en") ?? new Set<string>();
const zhSlugs = slugsByLocale.get("zh") ?? new Set<string>();
const allSlugs = new Set([...Array.from(enSlugs), ...Array.from(zhSlugs)]);
for (const slug of Array.from(allSlugs)) {
  if (!enSlugs.has(slug) || !zhSlugs.has(slug)) {
    errors.push(`${slug}: missing English or Chinese translation`);
  }
}

const enDocs = docsByLocale.get("en") ?? new Set<string>();
const zhDocs = docsByLocale.get("zh") ?? new Set<string>();
const allDocs = new Set([...Array.from(enDocs), ...Array.from(zhDocs)]);
for (const document of Array.from(allDocs)) {
  if (!enDocs.has(document) || !zhDocs.has(document)) {
    errors.push(`${document}: missing English or Chinese documentation page`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${enDocs.size} bilingual documentation pages and ${enSlugs.size} bilingual blog posts.`);
