import Parser from "rss-parser";
import { NewsHeadline } from "../types/briefing";
import { withFallback, withTimeout } from "../utils/timeouts";

const parser = new Parser();

export const DEFAULT_NEWS_FEEDS = [
  "https://feeds.feedburner.com/entrepreneur/latest",
  "https://www.forbes.com/small-business/feed/",
  "https://techcrunch.com/category/startups/feed/"
];

function normalizeFeeds(feeds: string[] | undefined): string[] {
  const cleaned = (feeds ?? []).map((feed) => feed.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : DEFAULT_NEWS_FEEDS;
}

export async function fetchIndustryNews(keywords: string[], feeds?: string[]): Promise<NewsHeadline[]> {
  return withFallback(
    () =>
      withTimeout(
        (async () => {
          const selectedFeeds = normalizeFeeds(feeds);
          const feedResults = await Promise.allSettled(selectedFeeds.map((url) => parser.parseURL(url)));
          const items = feedResults
            .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof parser.parseURL>>> => result.status === "fulfilled")
            .flatMap((result) => result.value.items ?? []);
          const loweredKeywords = keywords.map((k) => k.toLowerCase());

          const relevant = items
            .filter((item) => {
              const text = `${item.title ?? ""} ${item.contentSnippet ?? ""}`.toLowerCase();
              return loweredKeywords.some((k) => text.includes(k));
            })
            .slice(0, 3)
            .map((item) => ({
              headline: item.title ?? "Untitled story",
              summary: (item.contentSnippet ?? "No summary available").slice(0, 140),
              source: item.link ?? "rss"
            }));

          return relevant;
        })(),
        10_000,
        "news-agent"
      ),
    [],
    "news-agent"
  );
}
