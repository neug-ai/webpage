import { BlogArticle, getBlogArticleMetadata, getBlogStaticParams } from "@/components/blog-page";

export const dynamicParams = false;

export async function generateStaticParams() {
  return getBlogStaticParams("en");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return getBlogArticleMetadata("en", slug);
}

export default async function EnglishBlogArticle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BlogArticle locale="en" slug={slug} />;
}
