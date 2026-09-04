import type { Metadata } from "next";
import Index from "../src/page";

export const metadata: Metadata = {
  title: "NeuG — The one data index for agentic applications",
  description:
    "Graph, vector, and full-text retrieval over the same transactional data.",
  alternates: {
    canonical: "/",
    languages: { "en-US": "/", "zh-CN": "/zh/" },
  },
  openGraph: {
    title: "NeuG — The one data index for agentic applications",
    description:
      "Graph, vector, and full-text retrieval over the same transactional data.",
    url: "/",
    siteName: "NeuG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NeuG — The one data index for agentic applications",
    description:
      "Graph, vector, and full-text retrieval over the same transactional data.",
  },
};

export default function HomePage() {
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
        "@id": "https://neug.io/#website",
        name: "NeuG",
        url: "https://neug.io/",
        inLanguage: "en-US",
        publisher: { "@id": "https://neug.io/#organization" },
      },
    ],
  };

  return (
    <>
      <Index locale="en" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
