"use client";

import { GlobeIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SiteLocale } from "@/lib/site";

export function LanguageDropdown({
  currentLang,
  variant = "docs",
  label,
  shortLabel,
}: {
  currentLang: SiteLocale;
  variant?: "docs" | "navbar";
  label?: string;
  shortLabel?: string;
}) {
  const pathname = usePathname();
  const targetPath =
    currentLang === "zh"
      ? pathname.replace(/^\/zh(?=\/|$)/, "") || "/"
      : `/zh${pathname === "/" ? "/" : pathname}`;
  const accessibleLabel = currentLang === "zh" ? "Switch to English" : "切换至中文";

  if (variant === "navbar") {
    return (
      <Link
        href={targetPath}
        className="np-icon-button np-locale"
        aria-label={accessibleLabel}
        title={accessibleLabel}
      >
        <span className="np-locale-full">{label || (currentLang === "zh" ? "EN" : "中文")}</span>
        <span className="np-locale-short" aria-hidden="true">{shortLabel || (currentLang === "zh" ? "EN" : "中")}</span>
      </Link>
    );
  }

  return (
    <Link
      href={targetPath}
      className="neug-language-switch"
      aria-label={accessibleLabel}
      title={accessibleLabel}
    >
      <GlobeIcon aria-hidden="true" />
      <span>{currentLang === "zh" ? "English" : "中文"}</span>
    </Link>
  );
}
