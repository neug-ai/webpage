"use client";

import { useState, useEffect } from "react";

const GITHUB_PAGE_PREFIX = "neug";

export function useBasePath(): string {
  const [basePath, setBasePath] = useState("");

  useEffect(() => {
    // 在客户端，检查当前 URL 是否包含 /neug
    const pathname = window.location.pathname;
    if (pathname.startsWith(`/${GITHUB_PAGE_PREFIX}`)) {
      setBasePath(`/${GITHUB_PAGE_PREFIX}`);
    } else {
      setBasePath("");
    }
  }, []);

  return basePath;
}

// 静态导出用于服务器端
export const getStaticBasePath = (): string => {
  return process.env.NODE_ENV === "production" ? `/${GITHUB_PAGE_PREFIX}` : "";
};
