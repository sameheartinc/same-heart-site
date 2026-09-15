import type { Metadata } from "next";
import CommunityDetail from "./CommunityDetail";

const SITE_URL = "https://sameheart.ca";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface CommunityPreview {
  name: string | null;
  description: string | null;
  is_private: boolean | null;
}

// A plain REST fetch rather than the supabase-js client -- same reason
// as app/commons/exchange/[id]/page.tsx and app/commons/t/[id]/page.tsx:
// generateMetadata runs on the server. communities is public-read now
// for anything that isn't marked private (see supabase/schema.sql's
// "Public read for the Commons" migration) -- a private circle simply
// comes back as no row here, same anon key, no special-casing needed.
async function fetchPreview(slug: string): Promise<CommunityPreview | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/communities?slug=eq.${encodeURIComponent(slug)}&select=name,description,is_private`,
      {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        next: { revalidate: 60 },
      }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch {
    return null;
  }
}

// Rob, Sep 15 2026: "the same shape as Pinterest and Reddit" -- a
// public circle now renders for anyone, so a shared link actually
// shows something real. A private circle still requires an invite --
// fetchPreview above returns nothing for one (RLS blocks the anon
// read), and it also short-circuits here even if a row somehow came
// back, since a private circle's description was never meant to be
// public metadata. CommunityDetail's own read (getCommunityBySlug,
// gated by the same RLS) comes back not-found for that visitor too.
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const c = await fetchPreview(params.slug);
  if (!c || c.is_private) {
    return { title: "A community on Same Heart" };
  }

  const title = c.name || "A community on Same Heart";
  const description = c.description || "A community on Same Heart.";
  const url = `${SITE_URL}/commons/c/${params.slug}`;
  const image = `${SITE_URL}/mark.png`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, images: [{ url: image }], type: "article" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function CommunityPage({ params }: { params: { slug: string } }) {
  return <CommunityDetail slug={params.slug} />;
}
