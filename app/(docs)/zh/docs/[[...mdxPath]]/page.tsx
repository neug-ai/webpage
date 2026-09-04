import { getDocsMetadata, getDocsStaticParams, renderDocsPage } from "@/lib/docs";

export const dynamicParams = false;

export async function generateStaticParams() {
  return getDocsStaticParams("zh");
}

export function generateMetadata({ params }: { params: Promise<{ mdxPath?: string[] }> }) {
  return getDocsMetadata("zh", params);
}

export default function ChineseDocsPage(props: {
  params: Promise<{ mdxPath?: string[] }>;
}) {
  return renderDocsPage("zh", props);
}
