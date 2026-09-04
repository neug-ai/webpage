import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { importPage } from "nextra/pages";
import { BlogIndex } from "@/components/blog-index";
import { SiteShell } from "@/components/site-shell";
import { formatBlogDate, getBlogPost, getBlogPosts } from "@/lib/blog";
import { localePrefix, siteUrl, type SiteLocale } from "@/lib/site";

export function BlogListing({ locale }: { locale: SiteLocale }) {
  const posts = getBlogPosts(locale);
  const copy = locale === "zh"
    ? { eyebrow: "NeuG 博客", title: "洞察、发布与实践", body: "了解 NeuG 的产品进展、工程设计与真实应用案例。" }
    : { eyebrow: "NeuG Blog", title: "Insights, releases, and practice", body: "Product updates, engineering deep dives, and real-world stories from NeuG." };

  return (
    <SiteShell locale={locale}>
      <main className="np-blog-main">
        <section className="np-shell np-blog-hero">
          <span>{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.body}</p>
        </section>
        <section className="np-shell np-blog-list">
          <BlogIndex posts={posts} locale={locale} />
        </section>
      </main>
    </SiteShell>
  );
}

export function getBlogListingMetadata(locale: SiteLocale): Metadata {
  const prefix = localePrefix(locale);
  const title = locale === "zh" ? "NeuG 博客" : "NeuG Blog";
  const description = locale === "zh"
    ? "NeuG 产品发布、工程实践与真实应用案例。"
    : "NeuG product releases, engineering insights, and real-world case studies.";

  return {
    title,
    description,
    alternates: {
      canonical: `${prefix}/blog/`,
      languages: { "en-US": "/blog/", "zh-CN": "/zh/blog/" },
    },
    openGraph: { title, description, url: `${prefix}/blog/`, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export function getBlogStaticParams(locale: SiteLocale) {
  return getBlogPosts(locale).map(({ slug }) => ({ slug }));
}

export function getBlogArticleMetadata(locale: SiteLocale, slug: string): Metadata {
  const post = getBlogPost(locale, slug);
  if (!post) return {};
  const prefix = localePrefix(locale);
  const url = `${prefix}/blog/${slug}/`;

  return {
    title: post.title,
    description: post.description,
    authors: [{ name: post.author }],
    alternates: {
      canonical: url,
      languages: {
        "en-US": `/blog/${slug}/`,
        "zh-CN": `/zh/blog/${slug}/`,
      },
    },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url,
      publishedTime: post.date,
      modifiedTime: post.updated,
      authors: [post.author],
      tags: post.tags,
      images: post.cover ? [post.cover] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: post.cover ? [post.cover] : undefined,
    },
  };
}

export async function BlogArticle({ locale, slug }: { locale: SiteLocale; slug: string }) {
  const post = getBlogPost(locale, slug);
  if (!post) notFound();

  const { default: MDXContent } = await importPage([locale, "blog", slug]);
  const prefix = localePrefix(locale);
  const posts = getBlogPosts(locale);
  const postIndex = posts.findIndex((candidate) => candidate.slug === slug);
  const previousPost = posts[postIndex + 1];
  const nextPost = posts[postIndex - 1];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    author: { "@type": "Organization", name: post.author },
    publisher: { "@type": "Organization", name: "NeuG" },
    mainEntityOfPage: `${siteUrl}${prefix}/blog/${slug}/`,
    image: post.cover ? `${siteUrl}${post.cover}` : undefined,
    inLanguage: locale === "zh" ? "zh-CN" : "en-US",
  };

  return (
    <SiteShell locale={locale}>
      <main className="np-blog-main" data-pagefind-body data-pagefind-filter={`lang:${locale}`}>
        <article className="np-blog-article" data-pagefind-filter="type:blog">
          <header>
            <a href={`${prefix}/blog/`} className="np-blog-back">← {locale === "zh" ? "返回博客" : "Back to blog"}</a>
            <div className="np-blog-meta">
              <span data-pagefind-filter={`category:${post.category}`}>{post.category}</span>
              <time dateTime={post.date}>{formatBlogDate(post.date, locale)}</time>
              <span>{post.readingMinutes} {locale === "zh" ? "分钟阅读" : "min read"}</span>
            </div>
            <h1>{post.title}</h1>
            <p>{post.description}</p>
          </header>
          <div className="np-blog-prose">
            <MDXContent />
          </div>
          {(previousPost || nextPost) && (
            <nav className="np-blog-pager" aria-label={locale === "zh" ? "文章导航" : "Article navigation"}>
              {previousPost ? (
                <a href={`${prefix}/blog/${previousPost.slug}/`}>
                  <span>{locale === "zh" ? "上一篇" : "Previous"}</span>
                  <strong>{previousPost.title}</strong>
                </a>
              ) : <span />}
              {nextPost && (
                <a href={`${prefix}/blog/${nextPost.slug}/`}>
                  <span>{locale === "zh" ? "下一篇" : "Next"}</span>
                  <strong>{nextPost.title}</strong>
                </a>
              )}
            </nav>
          )}
        </article>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      </main>
    </SiteShell>
  );
}
