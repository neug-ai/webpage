"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  mounted: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
let transitionTimer: ReturnType<typeof setTimeout> | undefined;

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readSavedTheme(): Theme | null {
  try {
    const savedTheme = window.localStorage.getItem("neug-theme");
    return savedTheme === "light" || savedTheme === "dark" ? savedTheme : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
}

function enableThemeTransition() {
  const root = document.documentElement;
  root.dataset.themeTransition = "";
  if (transitionTimer) clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => {
    delete root.dataset.themeTransition;
  }, 280);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initialTheme = readSavedTheme() ?? getSystemTheme();
    applyTheme(initialTheme);
    setThemeState(initialTheme);
    setMounted(true);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "neug-theme") return;
      const nextTheme = event.newValue === "dark" || event.newValue === "light"
        ? event.newValue
        : getSystemTheme();
      enableThemeTransition();
      applyTheme(nextTheme);
      setThemeState(nextTheme);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const updateTheme = (nextTheme: Theme) => {
    enableThemeTransition();
    applyTheme(nextTheme);
    setThemeState(nextTheme);
    try {
      window.localStorage.setItem("neug-theme", nextTheme);
    } catch {
      // The selected theme still applies when storage is unavailable.
    }
  };

  const toggleTheme = () => {
    updateTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <ThemeContext.Provider
      value={{ theme, mounted, toggleTheme, setTheme: updateTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
