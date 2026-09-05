import Link from "next/link";
import { Github, Menu, Star, X } from "lucide-react";
import { GitHubStarCount } from "@/components/github-stars";
import { NeuGLogo } from "@/components/neug-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import type { HomeLocale } from "@/lib/homepage-copy";
import { homepageCopy } from "@/lib/homepage-copy";
import { getGitHubStarCount } from "@/lib/github";

export async function HomeNavbar({ locale }: { locale: HomeLocale }) {
  const copy = homepageCopy[locale];
  const prefix = locale === "zh" ? "/zh" : "";
  const otherLocaleHref = locale === "en" ? "/zh/" : "/";
  const starCount = await getGitHubStarCount();

  return (
    <header className="np-header">
      <div className="np-shell np-header-inner">
        <Link className="np-brand" href={`${prefix}/`} aria-label="NeuG home">
          <NeuGLogo height={30} />
        </Link>
        <nav className="np-nav" aria-label="Primary navigation">
          <Link className="np-desktop-link" href={`${prefix}/docs/overview/introduction/`}>{copy.nav.docs}</Link>
          <Link className="np-desktop-link" href={`${prefix}/blog/`}>{copy.hero.blog}</Link>
          <a
            className="np-github"
            href="https://github.com/alibaba/neug"
            target="_blank"
            rel="noreferrer"
            aria-label="NeuG on GitHub"
          >
            <Github aria-hidden="true" />
            <span>GitHub</span>
            <GitHubStarCount className="np-github-count" initialCount={starCount} />
            <span className="np-github-star">
              <span className="np-star-action"><Star aria-hidden="true" /><span>Star</span></span>
              <GitHubStarCount className="np-star-count" initialCount={starCount} />
            </span>
          </a>
          <div className="np-nav-actions">
            <Link
              className="np-icon-button np-locale"
              href={otherLocaleHref}
              aria-label={locale === "en" ? "切换至中文" : "Switch to English"}
              title={locale === "en" ? "切换至中文" : "Switch to English"}
            >
              <span className="np-locale-full">{copy.nav.locale}</span>
              <span className="np-locale-short" aria-hidden="true">{locale === "en" ? "中" : "EN"}</span>
            </Link>
            <ThemeToggle label={copy.nav.theme} />
            <details className="np-mobile-menu">
              <summary className="np-icon-button" aria-label={locale === "zh" ? "打开导航菜单" : "Open navigation menu"}>
                <Menu className="np-menu-open" aria-hidden="true" />
                <X className="np-menu-close" aria-hidden="true" />
              </summary>
              <div className="np-mobile-menu-panel">
                <Link href={`${prefix}/docs/overview/introduction/`}>{copy.nav.docs}</Link>
                <Link href={`${prefix}/blog/`}>{copy.hero.blog}</Link>
                <a href="https://github.com/alibaba/neug" target="_blank" rel="noreferrer">
                  GitHub <GitHubStarCount className="np-mobile-star-count" initialCount={starCount} />
                </a>
              </div>
            </details>
          </div>
        </nav>
      </div>
    </header>
  );
}
