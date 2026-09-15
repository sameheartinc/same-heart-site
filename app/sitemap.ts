import type { MetadataRoute } from "next";

// Only the pages that are actually open to the public without an
// account -- see app/robots.ts for the reasoning. /commons/exchange and
// its individual transmissions joined this list Sep 15, 2026 once they
// became readable without signing in; /commons/t (threads) and
// /commons/c (communities) joined the same day for the same reason.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface RecentTransmission {
  id: string;
  created_at: string;
}

interface RecentThread {
  id: string;
  last_activity_at: string;
}

interface PublicCommunity {
  slug: string;
  created_at: string;
}

// Best-effort: if this fetch fails for any reason, the sitemap still
// renders with every static page -- a missing batch of transmission
// URLs one build cycle is a lot better than a broken sitemap.
async function fetchRecentTransmissionIds(): Promise<RecentTransmission[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/exchange_transmissions?select=id,created_at&order=created_at.desc&limit=500`,
      {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

// Deliberately no manual "and the community isn't private" filter here
// -- the anon key this fetch runs under is subject to the same RLS a
// signed-out visitor gets (see supabase/schema.sql's "Public read for
// the Commons" migration), so a thread inside a private community
// simply never comes back from this query. The sitemap can't leak what
// the database itself won't hand it.
async function fetchRecentThreadIds(): Promise<RecentThread[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/commons_threads?select=id,last_activity_at&order=last_activity_at.desc&limit=500`,
      {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

// Same reasoning as fetchRecentThreadIds above -- RLS already keeps
// this to public communities only.
async function fetchPublicCommunitySlugs(): Promise<PublicCommunity[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/communities?select=slug,created_at&order=created_at.desc&limit=500`,
      {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://sameheart.ca";
  const now = new Date();
  const [transmissions, threads, communities] = await Promise.all([
    fetchRecentTransmissionIds(),
    fetchRecentThreadIds(),
    fetchPublicCommunitySlugs(),
  ]);

  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/shop`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/wallet`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/commons/exchange`, lastModified: now, changeFrequency: "hourly", priority: 0.7 },
    ...transmissions.map((t) => ({
      url: `${base}/commons/exchange/${t.id}`,
      lastModified: new Date(t.created_at),
      changeFrequency: "never" as const,
      priority: 0.4,
    })),
    ...threads.map((t) => ({
      url: `${base}/commons/t/${t.id}`,
      lastModified: new Date(t.last_activity_at),
      changeFrequency: "never" as const,
      priority: 0.4,
    })),
    ...communities.map((c) => ({
      url: `${base}/commons/c/${c.slug}`,
      lastModified: new Date(c.created_at),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
