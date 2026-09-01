import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchAllRssFeeds, RSS_FEEDS, type FeedArticle } from "@/lib/rssFeeds";

// Hourly news fetch for The Signal -- triggered by Vercel Cron (see
// vercel.json: "0 * * * *"). Not reachable by normal site traffic; only
// Vercel's own cron scheduler can call this, verified below via
// CRON_SECRET.
//
// Two independent sources feed this, and neither one failing blocks the
// other:
//   1. Free RSS feeds, read from the feed_sources table (see
//      supabase/schema.sql and /admin/signal) -- always on, no API key,
//      no cost, no production-use restriction. This is the primary
//      source. Falls back to lib/rssFeeds.ts's hardcoded RSS_FEEDS if
//      the table is empty or the query fails, so a database hiccup
//      never silences the Signal.
//   2. NewsAPI.org -- only runs if NEWSAPI_KEY is set. See README for
//      why its free tier isn't safe to run here in production; this
//      stays off until that key is a paid, production-eligible one.

const NEWSAPI_URL = "https://newsapi.org/v2/top-headlines?country=us&pageSize=20";

interface NewsApiArticle {
  source: { name: string | null };
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
}

// Reads the active, ordered list from feed_sources -- the whole point
// of the Yellow Heart String's door: adding or retiring a source is now
// a form submission in /admin/signal, not a code change and a deploy.
// Any failure (table missing, query error, or genuinely zero active
// rows) falls back to the hardcoded RSS_FEEDS list from lib/rssFeeds.ts,
// so the Signal's coverage is never worse than it is today.
async function getFeedSources(): Promise<Array<{ name: string; url: string; topic: string }>> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("feed_sources")
      .select("name, url, topic")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("feed_sources lookup failed, falling back to RSS_FEEDS:", error.message);
      return RSS_FEEDS;
    }
    if (!data || data.length === 0) return RSS_FEEDS;
    return data;
  } catch (err) {
    console.error("feed_sources lookup threw, falling back to RSS_FEEDS:", err instanceof Error ? err.message : err);
    return RSS_FEEDS;
  }
}

async function fetchNewsApi(): Promise<{ rows: FeedArticle[]; note: string }> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) return { rows: [], note: "NEWSAPI_KEY not configured -- skipped" };

  try {
    const res = await fetch(`${NEWSAPI_URL}&apiKey=${apiKey}`, {
      headers: { "User-Agent": "SameHeart/1.0" },
    });
    const body = await res.text();
    if (!res.ok) {
      console.error("NewsAPI fetch failed:", res.status, body.slice(0, 300));
      return { rows: [], note: `NewsAPI ${res.status}` };
    }
    const json = JSON.parse(body);
    const articles = (json.articles ?? []) as NewsApiArticle[];
    const rows = articles
      .filter((a) => a.title && a.url)
      .map((a) => ({
        source_name: a.source?.name ?? null,
        title: a.title,
        description: a.description,
        url: a.url,
        image_url: a.urlToImage,
        published_at: a.publishedAt,
        query_topic: "general",
      }));
    return { rows, note: "ok" };
  } catch (err) {
    console.error("NewsAPI fetch threw:", err instanceof Error ? err.message : err);
    return { rows: [], note: "fetch failed" };
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const feedSources = await getFeedSources();
  const [rssRows, newsApiResult] = await Promise.all([fetchAllRssFeeds(feedSources), fetchNewsApi()]);
  const rows = [...rssRows, ...newsApiResult.rows];

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, newsApi: newsApiResult.note });
  }

  // Dedupe against what's already stored -- ignoreDuplicates means this
  // is effectively "insert only the ones we haven't seen before," safe
  // to run every hour even if some headlines repeat between runs or
  // across sources.
  const { error, count } = await supabaseAdmin()
    .from("news_articles")
    .upsert(rows, { onConflict: "url", ignoreDuplicates: true, count: "exact" });

  if (error) {
    console.error("news_articles upsert failed:", error.message);
    return NextResponse.json({ ok: false, reason: error.message }, { status: 200 });
  }

  return NextResponse.json({
    ok: true,
    fetched: rows.length,
    inserted: count ?? null,
    rss: rssRows.length,
    newsApi: newsApiResult.note,
  });
}
