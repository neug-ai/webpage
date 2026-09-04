import type { ReactNode } from "react";
import { DocsShell } from "@/components/docs-shell";

export default function ChineseDocsLayout({ children }: { children: ReactNode }) {
  return <DocsShell locale="zh">{children}</DocsShell>;
}
