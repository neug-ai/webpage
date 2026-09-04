"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { BASE_PATH } from "@/lib/base-path";

interface BasePathContextType {
  basePath: string;
}

const BasePathContext = createContext<BasePathContextType>({ basePath: BASE_PATH });

export function BasePathProvider({ children }: { children: ReactNode }) {
  const [basePath, setBasePath] = useState(BASE_PATH);

  useEffect(() => {
    // 在客户端，检查当前 URL 是否包含 /neug
    const pathname = window.location.pathname;
    if (pathname.startsWith("/neug")) {
      setBasePath("/neug");
    } else {
      setBasePath("");
    }
  }, []);

  return (
    <BasePathContext.Provider value={{ basePath }}>
      {children}
    </BasePathContext.Provider>
  );
}

export function useBasePath(): string {
  const { basePath } = useContext(BasePathContext);
  return basePath;
}
