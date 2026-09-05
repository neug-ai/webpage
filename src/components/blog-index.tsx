"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { BlogPost } from "@/lib/blog";
import { localePrefix, type SiteLocale } from "@/lib/site";

const categoryOrder = ["all", "release", "engineering", "ecosystem", "case-study"] as const;

function formatDate(date: string, locale: SiteLocale) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function BlogIndex({ posts, locale }: { posts: BlogPost[]; locale: SiteLocale }) {
  const [category, setCategory] = useState<(typeof categoryOrder)[number]>("all");
  const visiblePosts = useMemo(
    () => posts.filter((post) => category === "all" || post.category === category),
    [category, posts]
  );
  const labels = locale === "zh"
    ? { all: "全部", release: "版本发布", engineering: "工程实践", ecosystem: "生态", "case-study": "案例" }
    : { all: "All", release: "Releases", engineering: "Engineering", ecosystem: "Ecosystem", "case-study": "Case studies" };
  const prefix = localePrefix(locale);

  return (
    <>
      <div className="np-blog-filters" aria-label={locale === "zh" ? "文章分类" : "Post categories"}>
        {categoryOrder.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
          >
            {labels[item]}
          </button>
        ))}
      </div>
      <div className="np-blog-grid">
        {visiblePosts.map((post) => (
          <article className="np-blog-card" key={post.slug}>
            <div className="np-blog-card-body">
              <div className="np-blog-meta">
                <span>{labels[post.category]}</span>
                <time dateTime={post.date}>{formatDate(post.date, locale)}</time>
              </div>
              <h2><Link href={`${prefix}/blog/${post.slug}/`}>{post.title}</Link></h2>
              <p>{post.description}</p>
              <div className="np-blog-tags">
                {post.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
