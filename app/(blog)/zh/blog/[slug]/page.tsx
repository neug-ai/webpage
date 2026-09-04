import { BlogArticle, getBlogArticleMetadata, getBlogStaticParams } from "@/components/blog-page";

export const dynamicParams = false;

export async function generateStaticParams() {
  return getBlogStaticParams("zh");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return getBlogArticleMetadata("zh", slug);
}

export default async function ChineseBlogArticle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BlogArticle locale="zh" slug={slug} />;
}
