// Free, keyless news sources for The Signal -- no API key, no per-request
// cost, no production-use restriction like NewsAPI's free tier has. This
// is a small, dependency-free RSS reader (a couple of regexes, not a new
// npm package) rather than pulling in a parsing library, since these
// feeds are simple RSS 2.0 and a real parser would be overkill.
//
// Picked deliberately, not just "whatever's popular": a couple of major
// wire-style outlets for general "what's happening" coverage, plus one
// solutions-journalism source (Yes! Magazine) that actually fits Same
// Heart's own point better than breaking news does. Each feed fails
// independently -- one dead feed in an hour never blocks the others.
export const RSS_FEEDS: Array<{ name: string; url: string; topic: string }> = [
  { name: "NPR", url: "https://feeds.npr.org/1001/rss.xml", topic: "world" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", topic: "world" },
  { name: "BBC News", url: "http://feeds.bbci.co.uk/news/world/rss.xml", topic: "world" },
  { name: "The Guardian", url: "https://www.theguardian.com/world/rss", topic: "world" },
  { name: "Yes! Magazine", url: "https://www.yesmagazine.org/feed", topic: "solutions" },
];

export interface FeedArticle {
  source_name: string | null;
  title: string;
  description: string | null;
  url: string;
  image_url: string | null;
  published_at: string | null;
  query_topic: string;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function extractTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!match) return null;
  let value = match[1].trim();
  const cdata = value.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) value = cdata[1].trim();
  return decodeEntities(value).replace(/<[^>]+>/g, "").trim();
}

function extractImage(block: string): string | null {
  // Most broadcasters use one of these three patterns for a story image.
  // Tried in order; falls back to the first <img> in the raw item block
  // (covers WordPress-style feeds like Yes! Magazine, which embed the
  // image directly in the content instead of a dedicated image tag).
  const patterns = [
    /<media:content[^>]*url="([^"]+)"/i,
    /<media:thumbnail[^>]*url="([^"]+)"/i,
    /<enclosure[^>]*url="([^"]+)"[^>]*type="image[^"]*"/i,
    /<img[^>]*src="([^"]+)"/i,
  ];
  for (const pattern of patterns) {
    const match = block.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function toIso(pubDate: string | null): string | null {
  if (!pubDate) return null;
  const d = new Date(pubDate);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export async function fetchRssFeed(feed: { name: string; url: string; topic: string }): Promise<FeedArticle[]> {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "SameHeartBot/1.0 (+https://sameheart.ca)" },
    });
    if (!res.ok) {
      console.error(`RSS fetch failed for ${feed.name}:`, res.status);
      return [];
    }
    const xml = await res.text();
    const items = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];
    const articles: FeedArticle[] = [];
    for (const block of items) {
      const title = extractTag(block, "title");
      const link = extractTag(block, "link");
      if (!title || !link) continue;
      articles.push({
        source_name: feed.name,
        title,
        description: extractTag(block, "description"),
        url: link,
        image_url: extractImage(block),
        published_at: toIso(extractTag(block, "pubDate")),
        query_topic: feed.topic,
      });
    }
    return articles;
  } catch (err) {
    console.error(`RSS fetch threw for ${feed.name}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

export async function fetchAllRssFeeds(): Promise<FeedArticle[]> {
  const results = await Promise.all(RSS_FEEDS.map(fetchRssFeed));
  return results.flat();
}
