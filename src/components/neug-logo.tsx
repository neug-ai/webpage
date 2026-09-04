"use client";

import React, { useState, useEffect } from "react";

interface NeuGLogoProps {
  variant?: "horizontal" | "square";
  height?: number;
  className?: string;
}

export function NeuGLogo({
  variant = "horizontal",
  height = 28,
  className = "",
}: NeuGLogoProps) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const prefix = variant === "square" ? "neug-logo" : "neug-logo-h";

  useEffect(() => {
    setMounted(true);
    const root = document.documentElement;
    setIsDark(root.classList.contains("dark"));

    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  if (!mounted) {
    return (
      <img
        src={`/images/${prefix}-light.png`}
        alt="NeuG"
        height={height}
        className={className}
        style={{ height }}
      />
    );
  }

  return (
    <img
      src={`/images/${prefix}-${isDark ? "dark" : "light"}.png`}
      alt="NeuG"
      height={height}
      className={className}
      style={{ height }}
    />
  );
}
