"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";

export function ThemeToggle({ label }: { label?: string }) {
  const { theme, mounted, toggleTheme } = useTheme();
  const nextTheme = theme === "light" ? "dark" : "light";

  return (
    <button
      type="button"
      className="np-icon-button np-theme-toggle"
      onClick={toggleTheme}
      aria-label={label || `Switch to ${nextTheme} mode`}
      title={label || `Switch to ${nextTheme} mode`}
    >
      <span className="np-theme-icon" data-theme={mounted ? theme : undefined}>
        <Moon className="np-theme-moon" aria-hidden="true" />
        <Sun className="np-theme-sun" aria-hidden="true" />
      </span>
    </button>
  );
}
