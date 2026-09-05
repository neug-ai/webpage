"use client";

import { GlobeIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SiteLocale } from "@/lib/site";

export function LanguageDropdown({ currentLang }: { currentLang: SiteLocale }) {
  const pathname = usePathname();
  const targetPath =
    currentLang === "zh"
      ? pathname.replace(/^\/zh(?=\/|$)/, "") || "/"
      : `/zh${pathname === "/" ? "/" : pathname}`;

  return (
    <Link
      href={targetPath}
      className="neug-language-switch"
      aria-label={currentLang === "zh" ? "Switch to English" : "切换至中文"}
      title={currentLang === "zh" ? "Switch to English" : "切换至中文"}
    >
      <GlobeIcon aria-hidden="true" />
      <span>{currentLang === "zh" ? "English" : "中文"}</span>
    </Link>
  );
}
