import { getDocsMetadata, getDocsStaticParams, renderDocsPage } from "@/lib/docs";

export const dynamicParams = false;

export async function generateStaticParams() {
  return getDocsStaticParams("en");
}

export function generateMetadata({ params }: { params: Promise<{ mdxPath?: string[] }> }) {
  return getDocsMetadata("en", params);
}

export default function EnglishDocsPage(props: {
  params: Promise<{ mdxPath?: string[] }>;
}) {
  return renderDocsPage("en", props);
}
