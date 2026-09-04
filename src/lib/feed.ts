import { getBlogPosts } from "@/lib/blog";
import { localePrefix, siteUrl, type SiteLocale } from "@/lib/site";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function createRssFeed(locale: SiteLocale) {
  const prefix = localePrefix(locale);
  const posts = getBlogPosts(locale);
  const feedUrl = `${siteUrl}${prefix}/feed.xml`;
  const blogUrl = `${siteUrl}${prefix}/blog/`;
  const title = locale === "zh" ? "NeuG 博客" : "NeuG Blog";
  const description =
    locale === "zh"
      ? "NeuG 产品发布、工程实践与真实应用案例。"
      : "NeuG product releases, engineering insights, and real-world case studies.";
  const language = locale === "zh" ? "zh-CN" : "en-US";
  const items = posts
    .map((post) => {
      const url = `${siteUrl}${prefix}/blog/${post.slug}/`;
      const categories = post.tags
        .map((tag) => `<category>${escapeXml(tag)}</category>`)
        .join("");

      return `<item>
<title>${escapeXml(post.title)}</title>
<link>${escapeXml(url)}</link>
<guid isPermaLink="true">${escapeXml(url)}</guid>
<pubDate>${new Date(`${post.date}T00:00:00Z`).toUTCString()}</pubDate>
<description>${escapeXml(post.description)}</description>
${categories}
</item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${escapeXml(title)}</title>
<link>${escapeXml(blogUrl)}</link>
<description>${escapeXml(description)}</description>
<language>${language}</language>
<atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>`;
}
