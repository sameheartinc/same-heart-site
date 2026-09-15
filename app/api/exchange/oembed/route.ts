import { NextRequest, NextResponse } from "next/server";
import { isXStatusUrl } from "@/lib/linkEmbed";

// The Exchange's link-preview embed -- lets someone see the actual X
// post before they transmit it (Rob, Sep 15 2026: "the video or feed to
// come up"). Proxied server-side because a browser fetch straight to
// publish.twitter.com/oembed can't be relied on for CORS from our own
// origin. Read-only preview only -- app/api/exchange/transmit/route.ts
// remains the one place a transmission is ever scored and recorded;
// nothing here awards Heartbeats or writes to the database, so it
// doesn't need auth or the daily caps that route has.
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url") || "";
  if (!isXStatusUrl(url)) {
    return NextResponse.json({ error: "Not an X post link." }, { status: 400 });
  }

  try {
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true&dnt=true&maxwidth=420`;
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return NextResponse.json({ error: "Couldn't find that post." }, { status: 404 });
    }
    const json = await res.json();
    if (typeof json.html !== "string") {
      return NextResponse.json({ error: "That post didn't return an embed." }, { status: 404 });
    }
    return NextResponse.json({ html: json.html, authorName: json.author_name ?? null });
  } catch (err) {
    console.error("Exchange oembed fetch failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Preview fetch failed." }, { status: 502 });
  }
}
