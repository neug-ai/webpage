import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { blogMetadataSchema } from "../src/lib/blog";

const root = process.cwd();
const locales = ["en", "zh"] as const;
const expectedBlogCount = 15;
const errors: string[] = [];
const slugsByLocale = new Map<string, Set<string>>();

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

  if (blogFiles.length !== expectedBlogCount) {
    errors.push(`${locale}: expected ${expectedBlogCount} blog posts, found ${blogFiles.length}`);
  }

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

  const docsCount = walk(contentRoot).filter(
    (file) => /\.mdx?$/.test(file) && !file.includes(`${path.sep}blog${path.sep}`)
  ).length;
  if (docsCount !== 77) {
    errors.push(`${locale}: expected 77 documentation pages, found ${docsCount}`);
  }
}

const enSlugs = slugsByLocale.get("en") ?? new Set<string>();
const zhSlugs = slugsByLocale.get("zh") ?? new Set<string>();
const allSlugs = new Set([...Array.from(enSlugs), ...Array.from(zhSlugs)]);
for (const slug of Array.from(allSlugs)) {
  if (!enSlugs.has(slug) || !zhSlugs.has(slug)) {
    errors.push(`${slug}: missing English or Chinese translation`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Validated 77 English docs, 77 Chinese docs, and 15 bilingual blog posts.");
