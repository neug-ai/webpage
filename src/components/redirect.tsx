"use client";

import { useEffect } from "react";

interface RedirectProps {
  to: string;
}

export function ClientRedirect({ to }: RedirectProps) {
  useEffect(() => {
    // 使用 window.location 直接跳转，避免 Next.js router 的 basePath 处理问题
    window.location.replace(to);
  }, [to]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <p>Redirecting...</p>
    </div>
  );
}
