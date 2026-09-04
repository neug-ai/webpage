import { BlogListing, getBlogListingMetadata } from "@/components/blog-page";

export const metadata = getBlogListingMetadata("zh");

export default function ChineseBlogPage() {
  return <BlogListing locale="zh" />;
}
