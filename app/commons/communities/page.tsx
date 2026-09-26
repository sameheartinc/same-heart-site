import type { Metadata } from "next";
import CommunitiesDirectory from "./CommunitiesDirectory";

const SITE_URL = "https://sameheart.ca";

// A static title/description is enough here -- unlike a single thread
// or community (app/commons/t/[id]/page.tsx, app/commons/c/[slug]/page.tsx),
// this page's own content is just a list that changes constantly, not
// one piece of content worth a bespoke OG preview per visit.
export const metadata: Metadata = {
  title: "Communities on Same Heart",
  description: "Every public community in the Same Heart Commons, in one place -- browse them, or start your own.",
  alternates: { canonical: `${SITE_URL}/commons/communities` },
  openGraph: {
    title: "Communities on Same Heart",
    description: "Every public community in the Same Heart Commons, in one place -- browse them, or start your own.",
    url: `${SITE_URL}/commons/communities`,
    images: [{ url: `${SITE_URL}/mark.png` }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Communities on Same Heart",
    description: "Every public community in the Same Heart Commons, in one place -- browse them, or start your own.",
    images: [`${SITE_URL}/mark.png`],
  },
};

export default function CommunitiesPage() {
  return <CommunitiesDirectory />;
}
