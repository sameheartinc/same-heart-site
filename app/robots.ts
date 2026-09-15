import type { MetadataRoute } from "next";

// Public pages are open to crawl; most signed-in-only rooms (Hub,
// Galaxy, Guide, Star Day) just redirect a bot to /login anyway, so
// there's nothing useful for Google to index there -- keep them out of
// the crawl budget instead of letting Google waste time on a login
// wall. /commons/exchange is the one exception carved back open (Sep
// 15, 2026, Rob: "how do we get to the point where our site is
// shareable") -- the Exchange feed and every individual transmission
// under it now render read-only for a signed-out visitor, so they're
// real, indexable content, not a login wall. The rest of /commons
// (threads, communities) still requires an account today and stays
// disallowed until that changes too.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/shop", "/wallet", "/privacy", "/terms", "/contact", "/commons/exchange"],
      disallow: ["/api/", "/hub", "/commons", "/galaxy", "/guide", "/star-day", "/admin", "/impact", "/signal"],
    },
    sitemap: "https://sameheart.ca/sitemap.xml",
  };
}
