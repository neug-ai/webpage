import { BlogListing, getBlogListingMetadata } from "@/components/blog-page";

export const metadata = getBlogListingMetadata("en");

export default function EnglishBlogPage() {
  return <BlogListing locale="en" />;
}
