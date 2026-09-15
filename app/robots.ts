import type { MetadataRoute } from "next";

// Public pages are open to crawl; most signed-in-only rooms (Hub,
// Galaxy, Guide, Star Day) just redirect a bot to /login anyway, so
// there's nothing useful for Google to index there -- keep them out of
// the crawl budget instead of letting Google waste time on a login
// wall. /commons/exchange, /commons/t (a thread) and /commons/c (a
// community) are the exceptions carved back open (Sep 15, 2026, Rob:
// "how do we get to the point where our site is shareable... the same
// shape as Pinterest and Reddit") -- each renders read-only for a
// signed-out visitor now (see their own page.tsx/*Detail.tsx files and
// supabase/schema.sql's "Public read for the Commons" migration), so
// they're real, indexable content, not a login wall. A thread inside a
// PRIVATE community, or the private community's own page, still comes
// back not-found for a crawler -- that's enforced by RLS on the read
// itself, not by robots.txt, so there's nothing to special-case here.
// /commons itself (the compose/hub view) still requires an account and
// stays disallowed -- a longer, more specific allow path like
// /commons/t always wins over the shorter /commons disallow.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/shop", "/wallet", "/privacy", "/terms", "/contact", "/commons/exchange", "/commons/t", "/commons/c"],
      disallow: ["/api/", "/hub", "/commons", "/galaxy", "/guide", "/star-day", "/admin", "/impact", "/signal"],
    },
    sitemap: "https://sameheart.ca/sitemap.xml",
  };
}
