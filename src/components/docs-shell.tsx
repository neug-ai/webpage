import type { ReactNode } from "react";
import { Search } from "nextra/components";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import { LanguageDropdown } from "@/components/language-dropdown";
import { NeuGLogo } from "@/components/neug-logo";
import { VersionBadge } from "@/components/version-badge";
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
  const pageMap = rewriteRoutes(await getPageMap(`/${locale}`), locale);
  const labels =
    locale === "zh"
      ? { home: "首页", blog: "博客", footer: "NeuG：面向 Agent 应用的全能数据索引。" }
      : { home: "Home", blog: "Blog", footer: "NeuG: the one data index for agentic applications." };

  const navbar = (
    <Navbar
      logo={<NeuGLogo height={28} />}
      logoLink={`${prefix}/`}
      projectLink="https://github.com/alibaba/neug"
    >
      <a href={`${prefix}/`}>{labels.home}</a>
      <a href={`${prefix}/blog/`}>{labels.blog}</a>
      <VersionBadge />
      <LanguageDropdown currentLang={locale} />
    </Navbar>
  );

  return (
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
  );
}
