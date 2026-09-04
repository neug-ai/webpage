import type { Metadata } from "next";
import Index from "../../src/page";

export const metadata: Metadata = {
  title: "NeuG — 面向 Agent 应用的全能数据索引",
  description: "在同一份事务数据上统一提供图、向量与全文检索。",
  alternates: {
    canonical: "/zh/",
    languages: { "en-US": "/", "zh-CN": "/zh/" },
  },
  openGraph: {
    title: "NeuG — 面向 Agent 应用的全能数据索引",
    description: "在同一份事务数据上统一提供图、向量与全文检索。",
    url: "/zh/",
    siteName: "NeuG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NeuG — 面向 Agent 应用的全能数据索引",
    description: "在同一份事务数据上统一提供图、向量与全文检索。",
  },
};

export default function ChineseHomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://neug.io/#organization",
        name: "NeuG",
        url: "https://neug.io/",
      },
      {
        "@type": "WebSite",
        "@id": "https://neug.io/zh/#website",
        name: "NeuG",
        url: "https://neug.io/zh/",
        inLanguage: "zh-CN",
        publisher: { "@id": "https://neug.io/#organization" },
      },
    ],
  };

  return (
    <>
      <Index locale="zh" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
