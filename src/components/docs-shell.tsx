import type { ReactNode } from "react";
import Link from "next/link";
import { Search } from "nextra/components";
import { Footer, Layout, Navbar, ThemeSwitch } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import { Github } from "lucide-react";
import { GitHubStarCount } from "@/components/github-stars";
import { LanguageDropdown } from "@/components/language-dropdown";
import { NeuGLogo } from "@/components/neug-logo";
import { VersionBadge } from "@/components/version-badge";
import { getGitHubStarCount } from "@/lib/github";
import { localePrefix, type SiteLocale } from "@/lib/site";

function rewriteRoutes(nodes: any[], locale: SiteLocale): any[] {
  const prefix = localePrefix(locale);

  return nodes
    .filter((node) => node.name !== "blog" && node.route !== `/${locale}`)
    .map((node) => {
      const next = { ...node };
      if (typeof next.route === "string") {
        const contentPrefix = `/${locale}`;
        const route = next.route.replace(new RegExp(`^${contentPrefix}`), "");
        next.route = `${prefix}/docs${route === "/" ? "" : route}/`;
      }
      if (Array.isArray(next.children)) {
        next.children = rewriteRoutes(next.children, locale);
      }
      return next;
    });
}

export async function DocsShell({
  children,
  locale,
}: {
  children: ReactNode;
  locale: SiteLocale;
}) {
  const prefix = localePrefix(locale);
  const [rawPageMap, starCount] = await Promise.all([
    getPageMap(`/${locale}`),
    getGitHubStarCount(),
  ]);
  const pageMap = rewriteRoutes(rawPageMap, locale);
  const labels =
    locale === "zh"
      ? { home: "首页", blog: "博客", footer: "NeuG：面向 Agent 应用的全能数据索引。" }
      : { home: "Home", blog: "Blog", footer: "NeuG: the one data index for agentic applications." };

  const navbar = (
    <Navbar
      logo={<NeuGLogo height={28} />}
      logoLink={`${prefix}/`}
      projectLink="https://github.com/alibaba/neug"
      projectIcon={
        <span className="neug-docs-github" aria-label="NeuG on GitHub">
          <Github aria-hidden="true" />
          <GitHubStarCount className="neug-docs-star-count" initialCount={starCount} />
        </span>
      }
      className="neug-docs-navbar"
    >
      <Link className="neug-docs-nav-link" href={`${prefix}/`}>{labels.home}</Link>
      <Link className="neug-docs-nav-link" href={`${prefix}/blog/`}>{labels.blog}</Link>
      <span className="neug-docs-version"><VersionBadge /></span>
      <LanguageDropdown currentLang={locale} />
      <ThemeSwitch lite className="neug-docs-theme-switch" />
    </Navbar>
  );

  return (
    <div className="neug-docs-root">
      <Layout
        navbar={navbar}
        footer={<Footer>{labels.footer}</Footer>}
        docsRepositoryBase="https://github.com/alibaba/neug/blob/main/doc"
        sidebar={{ defaultMenuCollapseLevel: 1, autoCollapse: true }}
        pageMap={pageMap}
        search={
          <Search
            placeholder={locale === "zh" ? "搜索文档和博客…" : "Search docs and blog…"}
            searchOptions={{ filters: { lang: locale } }}
          />
        }
        nextThemes={{ defaultTheme: "system", storageKey: "neug-theme" }}
      >
        {children}
      </Layout>
    </div>
  );
}
