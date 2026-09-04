"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";

export function ThemeToggle({ label }: { label?: string }) {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "light" ? "dark" : "light";

  return (
    <button
      type="button"
      className="np-icon-button np-theme-toggle"
      onClick={toggleTheme}
      aria-label={label || `Switch to ${nextTheme} mode`}
      title={label || `Switch to ${nextTheme} mode`}
    >
      {theme === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
    </button>
  );
}
