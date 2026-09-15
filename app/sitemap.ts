import type { MetadataRoute } from "next";

// Only the pages that are actually open to the public without an
// account -- see app/robots.ts for the reasoning. /commons/exchange and
// its individual transmissions joined this list Sep 15, 2026 once they
// became readable without signing in.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface RecentTransmission {
  id: string;
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://sameheart.ca";
  const now = new Date();
  const transmissions = await fetchRecentTransmissionIds();

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
  ];
}
