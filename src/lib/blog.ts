import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import type { SiteLocale } from "@/lib/site";

const dateSchema = z.preprocess(
  (value) =>
    value instanceof Date ? value.toISOString().slice(0, 10) : String(value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
);

export const blogMetadataSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  date: dateSchema,
  author: z.string().min(1),
  category: z.enum(["release", "engineering", "ecosystem", "case-study"]),
  tags: z.array(z.string()).min(1),
  cover: z.string(),
  locale: z.enum(["en", "zh"]),
  translationKey: z.string().min(1),
  draft: z.boolean(),
  updated: dateSchema.optional(),
  aliases: z.array(z.string()).default([]),
});

export type BlogMetadata = z.infer<typeof blogMetadataSchema>;
export type BlogPost = BlogMetadata & {
  slug: string;
  readingMinutes: number;
};

function blogDirectory(locale: SiteLocale) {
  return path.join(process.cwd(), "content", locale, "blog");
}

export function getBlogPosts(locale: SiteLocale): BlogPost[] {
  const directory = blogDirectory(locale);
  if (!fs.existsSync(directory)) return [];

  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => {
      const slug = file.replace(/\.mdx$/, "");
      const source = fs.readFileSync(path.join(directory, file), "utf8");
      const { data, content } = matter(source);
      const metadata = blogMetadataSchema.parse(data);

      if (metadata.locale !== locale || metadata.translationKey !== slug) {
        throw new Error(`Invalid locale or translationKey in ${locale}/blog/${file}`);
      }

      const wordCount =
        locale === "zh"
          ? content.replace(/\s/g, "").length
          : content.trim().split(/\s+/).length;

      return {
        ...metadata,
        slug,
        readingMinutes: Math.max(1, Math.ceil(wordCount / (locale === "zh" ? 450 : 220))),
      };
    })
    .filter((post) => !post.draft)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getBlogPost(locale: SiteLocale, slug: string) {
  return getBlogPosts(locale).find((post) => post.slug === slug);
}

export function formatBlogDate(date: string, locale: SiteLocale) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
