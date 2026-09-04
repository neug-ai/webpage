export type SiteLocale = "en" | "zh";

export const siteUrl = "https://neug.io";

export function localePrefix(locale: SiteLocale) {
  return locale === "zh" ? "/zh" : "";
}

export function localizedPath(locale: SiteLocale, path = "/") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${localePrefix(locale)}${normalized}` || "/";
}
