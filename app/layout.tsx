/* eslint-env node */

import type { Metadata } from "next";
import Script from "next/script";
import { Head } from "nextra/components";
import type { FC, ReactNode } from "react";
import "nextra-theme-docs/style.css";
import "../src/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://neug.io"),
  description:
    "NeuG is the one data index for agentic applications: graph, vector, and full-text retrieval over the same transactional data.",
  title: {
    absolute: "NeuG — The one data index for agentic applications",
    template: "%s | NeuG",
  },
  other: {
    "msapplication-TileColor": "#fff",
  },
};

type LayoutProps = Readonly<{
  children: ReactNode;
}>;

const RootLayout: FC<LayoutProps> = ({ children }) => {
  return (
    <html lang="en" suppressHydrationWarning>
      <Head
        color={{
          hue: { dark: 215, light: 215 },
          saturation: { dark: 95, light: 95 },
        }}
      />
      <body>
        <Script id="document-language" strategy="beforeInteractive">
          {`document.documentElement.lang = location.pathname.split("/").includes("zh") ? "zh-CN" : "en";`}
        </Script>
        <Script id="initial-color-theme" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem("neug-theme");var d=t==="dark"||t==="light"?t:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.classList.remove("light","dark");document.documentElement.classList.add(d);document.documentElement.style.colorScheme=d}catch(e){}`}
        </Script>
        {children}
      </body>
    </html>
  );
};

export default RootLayout;
