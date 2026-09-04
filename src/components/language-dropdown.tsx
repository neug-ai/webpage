"use client";

import { GlobeIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import type { SiteLocale } from "@/lib/site";

export function LanguageDropdown({ currentLang }: { currentLang: SiteLocale }) {
  const pathname = usePathname();
  const targetPath =
    currentLang === "zh"
      ? pathname.replace(/^\/zh(?=\/|$)/, "") || "/"
      : `/zh${pathname === "/" ? "/" : pathname}`;

  return (
    <a
      href={targetPath}
      className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-gray-100"
      aria-label={currentLang === "zh" ? "Switch to English" : "切换至中文"}
    >
      <GlobeIcon className="h-4 w-4" />
      {currentLang === "zh" ? "English" : "中文"}
    </a>
  );
}
