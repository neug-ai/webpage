import type { ReactNode } from "react";
import { DocsShell } from "@/components/docs-shell";

export default function EnglishDocsLayout({ children }: { children: ReactNode }) {
  return <DocsShell locale="en">{children}</DocsShell>;
}
