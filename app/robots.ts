import type { MetadataRoute } from "next";

// Public pages are open to crawl; signed-in-only rooms (Hub, Commons,
// Galaxy, Guide, Star Day) just redirect a bot to /login anyway, so
// there's nothing useful for Google to index there -- keep them out of
// the crawl budget instead of letting Google waste time on a login wall.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/shop", "/wallet", "/privacy", "/terms", "/contact"],
      disallow: ["/api/", "/hub", "/commons", "/galaxy", "/guide", "/star-day", "/admin", "/impact"],
    },
    sitemap: "https://sameheart.ca/sitemap.xml",
  };
}
