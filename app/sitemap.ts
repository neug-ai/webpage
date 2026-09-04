import fs from "node:fs";
import path from "node:path";
import type { MetadataRoute } from "next";
import { getBlogPosts } from "@/lib/blog";
import { localePrefix, siteUrl, type SiteLocale } from "@/lib/site";

function getDocRoutes(locale: SiteLocale) {
  const root = path.join(process.cwd(), "content", locale);
  const routes: string[] = [];

  function visit(directory: string) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith("_") || entry.name === "blog") continue;

      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }
      if (!entry.name.match(/\.mdx?$/)) continue;

      const relativePath = path.relative(root, entryPath).replace(/\\/g, "/");
      const segments = relativePath.replace(/\.mdx?$/, "").split("/");
      if (segments.at(-1) === "index") segments.pop();
      routes.push(segments.join("/"));
    }
  }

  visit(root);
  return routes;
}

function localizedEntry(
  locale: SiteLocale,
  route: string,
  options: Omit<MetadataRoute.Sitemap[number], "url" | "alternates"> = {}
): MetadataRoute.Sitemap[number] {
  const prefix = localePrefix(locale);
  const normalizedRoute = route ? `/${route}` : "";
  const englishUrl = `${siteUrl}${normalizedRoute || "/"}`;
  const chineseUrl = `${siteUrl}/zh${normalizedRoute || "/"}`;

  return {
    url: locale === "zh" ? chineseUrl : englishUrl,
    alternates: {
      languages: {
        en: englishUrl,
        zh: chineseUrl,
      },
    },
    ...options,
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    localizedEntry("en", "", { changeFrequency: "weekly", priority: 1 }),
    localizedEntry("zh", "", { changeFrequency: "weekly", priority: 1 }),
    localizedEntry("en", "blog", { changeFrequency: "weekly", priority: 0.8 }),
    localizedEntry("zh", "blog", { changeFrequency: "weekly", priority: 0.8 }),
  ];

  for (const locale of ["en", "zh"] as const) {
    for (const route of getDocRoutes(locale)) {
      entries.push(
        localizedEntry(locale, `docs/${route}`, {
          changeFrequency: "monthly",
          priority: 0.7,
        })
      );
    }

    for (const post of getBlogPosts(locale)) {
      entries.push(
        localizedEntry(locale, `blog/${post.slug}`, {
          lastModified: post.updated ?? post.date,
          changeFrequency: "monthly",
          priority: 0.7,
        })
      );
    }
  }

  return entries;
}
