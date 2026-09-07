const trailingPunctuation = /[.,，。;；:：!?！？]+$/u;

function documentationUrl(relativeUrl, locale) {
  let relative = relativeUrl;
  const punctuation = relative.match(trailingPunctuation)?.[0] || "";
  if (punctuation) relative = relative.slice(0, -punctuation.length);

  const suffixIndex = relative.search(/[?#]/);
  const suffix = suffixIndex >= 0 ? relative.slice(suffixIndex) : "";
  const pathname = (suffixIndex >= 0 ? relative.slice(0, suffixIndex) : relative)
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.(?:md|mdx)$/i, "");
  const prefix = locale === "zh" ? "https://neug.io/zh/docs/" : "https://neug.io/docs/";
  return `${prefix}${pathname}/${suffix}${punctuation}`;
}

export function normalizeDocumentationLinks(markdown, locale) {
  if (locale !== "en" && locale !== "zh") {
    throw new Error(`unsupported documentation locale: ${locale}`);
  }

  return markdown
    .replace(
      /\b(?:https?:\/\/)?github\.com\/alibaba\/neug\/blob\/[^/\s)]+\/doc\/source\/([^\s)<>"']+)/gi,
      (_, relative) => documentationUrl(relative, locale),
    )
    .replace(
      /\bhttps?:\/\/(?:www\.)?neug\.io\/(?:zh\/)?docs\/([^\s)<>"']+)/gi,
      (_, relative) => documentationUrl(relative, locale),
    );
}
