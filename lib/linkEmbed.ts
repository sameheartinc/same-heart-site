// Same Heart -- The Exchange's link-preview helpers (client-safe, pure
// parsing only, no network calls). Used by ExchangeLinkPreview in
// app/commons/page.tsx to recognize a YouTube or X link the moment
// someone pastes it into the transmit box, before they ever hit
// Transmit. Kept separate from lib/exchange.ts since that file is about
// submitting/reading transmissions, not recognizing what kind of link
// one is. Rob, Sep 15 2026: "I want people to be able to drop a link
// from X or youtube ... and for the video or feed to come up."

export function youtubeVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1).split("/")[0];
    return id || null;
  }
  if (host === "youtube.com" || host === "music.youtube.com") {
    if (parsed.pathname === "/watch") {
      const v = parsed.searchParams.get("v");
      return v || null;
    }
    const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/?]+)/);
    if (shortsMatch) return shortsMatch[1];
    const liveMatch = parsed.pathname.match(/^\/live\/([^/?]+)/);
    if (liveMatch) return liveMatch[1];
    const embedMatch = parsed.pathname.match(/^\/embed\/([^/?]+)/);
    if (embedMatch) return embedMatch[1];
  }
  return null;
}

// Matches a real X/Twitter post URL -- /<handle>/status/<id> -- not just
// any x.com link (a profile page or search URL shouldn't try to embed).
export function isXStatusUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.replace(/^www\./, "");
  if (host !== "x.com" && host !== "twitter.com") return false;
  return /^\/[^/]+\/status\/\d+/.test(parsed.pathname);
}
