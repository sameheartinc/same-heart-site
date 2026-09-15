import type { Metadata } from "next";
import TransmissionDetail from "./TransmissionDetail";

const SITE_URL = "https://sameheart.ca";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface TransmissionPreview {
  title: string | null;
  tagline: string | null;
  domain: string | null;
  image_url: string | null;
  impact_score: number | null;
}

// A plain REST fetch rather than the supabase-js client -- this runs at
// request time on the server (generateMetadata can't be a client
// component), and a plain fetch sidesteps any question of whether the
// browser-oriented client in lib/supabaseClient.ts behaves correctly
// off the browser. exchange_transmissions is already public-read (see
// lib/exchange.ts's own header comment), so the anon key alone is
// enough here -- no service role, no auth needed for this narrow read.
async function fetchPreview(id: string): Promise<TransmissionPreview | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/exchange_transmissions?id=eq.${encodeURIComponent(id)}&select=title,tagline,domain,image_url,impact_score`,
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

// This is the whole reason this route exists (Rob, Sep 15 2026: "how do
// we get to the point where our site is shareable... like Reddit, or
// LinkedIn, or Pinterest, Facebook, or X"). Every other Exchange surface
// lives behind login -- this one doesn't, on purpose, so a shared link
// actually shows something real to someone who's never signed up.
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const t = await fetchPreview(params.id);
  if (!t) {
    return { title: "A transmission on Same Heart" };
  }

  const title = t.tagline || t.title || t.domain || "A transmission on Same Heart";
  const description =
    t.tagline && t.title
      ? t.title
      : `Transmitted through Same Heart's Exchange${
          t.impact_score != null ? ` -- scored ${t.impact_score}/100 for real-world impact.` : "."
        }`;
  const image = t.image_url || `${SITE_URL}/mark.png`;
  const url = `${SITE_URL}/commons/exchange/${params.id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, images: [{ url: image }], type: "article" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function TransmissionPage({ params }: { params: { id: string } }) {
  return <TransmissionDetail transmissionId={params.id} />;
}
