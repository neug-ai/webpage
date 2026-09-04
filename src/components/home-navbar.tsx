"use client";

import { Github, Star } from "lucide-react";
import { NeuGLogo } from "@/components/neug-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import type { HomeLocale } from "@/lib/homepage-copy";
import { homepageCopy } from "@/lib/homepage-copy";

export function HomeNavbar({ locale }: { locale: HomeLocale }) {
  const copy = homepageCopy[locale];
  const prefix = locale === "zh" ? "/zh" : "";
  const otherLocaleHref = locale === "en" ? "/zh/" : "/";

  return (
    <header className="np-header">
      <div className="np-shell np-header-inner">
        <a className="np-brand" href={`${prefix}/`} aria-label="NeuG home">
          <NeuGLogo height={30} />
        </a>
        <nav className="np-nav" aria-label="Primary navigation">
          <a href={`${prefix}/docs/overview/introduction/`}>{copy.nav.docs}</a>
          <a href={`${prefix}/blog/`}>{copy.hero.blog}</a>
          <a
            className="np-github"
            href="https://github.com/alibaba/neug"
            target="_blank"
            rel="noreferrer"
          >
            <Github aria-hidden="true" />
            <span>GitHub</span>
            <span className="np-github-star">
              <span className="np-star-action"><Star aria-hidden="true" /><span>Star</span></span>
            </span>
          </a>
          <div className="np-nav-actions">
            <a className="np-icon-button np-locale" href={otherLocaleHref}>
              {copy.nav.locale}
            </a>
            <ThemeToggle label={copy.nav.theme} />
          </div>
        </nav>
      </div>
    </header>
  );
}
