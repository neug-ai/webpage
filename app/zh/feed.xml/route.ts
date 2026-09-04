import { createRssFeed } from "@/lib/feed";

export const dynamic = "force-static";

export function GET() {
  return new Response(createRssFeed("zh"), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
