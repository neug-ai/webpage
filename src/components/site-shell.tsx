import type { ReactNode } from "react";
import { HomeNavbar } from "@/components/home-navbar";
import { NeuGLogo } from "@/components/neug-logo";
import { ThemeProvider } from "@/contexts/theme-context";
import { homepageCopy, type HomeLocale } from "@/lib/homepage-copy";
import { localePrefix } from "@/lib/site";

export function SiteShell({
  children,
  locale,
}: {
  children: ReactNode;
  locale: HomeLocale;
}) {
  const prefix = localePrefix(locale);
  const copy = homepageCopy[locale];

  return (
    <ThemeProvider>
      <div id="neug-product-home" className="np-site-page" lang={locale === "zh" ? "zh-CN" : "en"}>
        <HomeNavbar locale={locale} />
        {children}
        <footer className="np-footer">
          <div className="np-shell">
            <span className="np-footer-brand">
              <a href={`${prefix}/`} aria-label="NeuG home"><NeuGLogo height={22} /></a>
              <span>{copy.footer}</span>
            </span>
            <span>
              <a href="https://github.com/alibaba/neug" target="_blank" rel="noreferrer">GitHub</a>
              <i>Apache 2.0</i>
            </span>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}
