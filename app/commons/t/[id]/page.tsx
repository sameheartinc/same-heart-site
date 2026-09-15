import type { Metadata } from "next";
import ThreadDetail from "./ThreadDetail";

const SITE_URL = "https://sameheart.ca";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface ThreadPreview {
  title: string | null;
  body: string | null;
  kind: "discussion" | "question" | null;
  image_url: string | null;
}

// A plain REST fetch rather than the supabase-js client -- same reason
// as app/commons/exchange/[id]/page.tsx: generateMetadata runs on the
// server, where the browser-oriented client in lib/supabaseClient.ts
// isn't the right tool. commons_threads is public-read now for any
// thread outside a private community (see supabase/schema.sql's
// "Public read for the Commons" migration) -- a thread in a private
// community simply comes back as no row here, same anon key, no
// special-casing needed.
async function fetchPreview(id: string): Promise<ThreadPreview | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/commons_threads?id=eq.${encodeURIComponent(id)}&select=title,body,kind,image_url`,
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

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

// Rob, Sep 15 2026: "the same shape as Pinterest and Reddit" -- a
// thread in a public community (or with no community at all) now
// renders for anyone, so a shared link actually shows something real
// to someone who's never signed up. A thread in a private community
// still requires membership to view -- fetchPreview above returns
// nothing for those, and ThreadDetail's own read (lib/commons.ts's
// getThread, gated by the same RLS) comes back empty for that visitor
// too, so nothing private leaks through this metadata path.
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const t = await fetchPreview(params.id);
  if (!t) {
    return { title: "A conversation on Same Heart" };
  }

  const title = t.title || "A conversation on Same Heart";
  const description = t.body
    ? truncate(t.body, 160)
    : `${t.kind === "question" ? "A question" : "A discussion"} on Same Heart.`;
  const image = t.image_url || `${SITE_URL}/mark.png`;
  const url = `${SITE_URL}/commons/t/${params.id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, images: [{ url: image }], type: "article" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function ThreadPage({ params }: { params: { id: string } }) {
  return <ThreadDetail threadId={params.id} />;
}
