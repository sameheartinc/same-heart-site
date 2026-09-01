import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import GlobalPlayer from "@/components/GlobalPlayer";
import "./globals.css";

const SITE_URL = "https://sameheart.ca";
const SITE_DESCRIPTION =
  "SAMEHEART is opening its doors soon. Quiet from the outside — a whole universe once you're in.";

// A plain, factual description for machines (search engines, AI
// crawlers, JSON-LD parsers) -- deliberately not the same string as
// SITE_DESCRIPTION above, which is the mysterious, human-facing brand
// voice used for social-share previews. See app/about/page.tsx for the
// full version of this same description.
const ORG_DESCRIPTION =
  "Same Heart is a personal growth and community platform: a personality/self-discovery system (Star Day, Path), community discussion spaces (the Commons), a curated feed of real news (the Signal), and permanent earned recognition for real engagement (Keys).";

// Organization + WebSite structured data (JSON-LD) -- gives search
// engines and AI systems a plain, machine-readable fact sheet instead of
// only the poetic human-facing copy above. See app/about/page.tsx for
// the same facts written out in full prose.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Same Heart",
      legalName: "Same Heart Inc.",
      url: SITE_URL,
      logo: `${SITE_URL}/mark.png`,
      email: "sameheartinc@gmail.com",
      description: ORG_DESCRIPTION,
      address: {
        "@type": "PostalAddress",
        addressRegion: "Ontario",
        addressCountry: "CA",
      },
    },
    {
      "@type": "WebSite",
      name: "Same Heart",
      url: SITE_URL,
      description: ORG_DESCRIPTION,
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Same Heart",
    template: "%s",
  },
  description: SITE_DESCRIPTION,
  verification: {
    google: "oGB17x90qYbnnnYrJRvDIrcVjveGqy74DeYKxMh_s64",
  },
  // Open Graph + Twitter card -- so a sameheart.ca link shared on
  // Instagram/X/iMessage shows a real title, description, and logo
  // instead of a bare gray link. mark.png is the closest thing we have
  // to a social banner today; swap in a proper 1200x630 image later if
  // we want a bigger, more polished preview.
  openGraph: {
    title: "Same Heart",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "Same Heart",
    images: [{ url: "/mark.png", width: 640, height: 632, alt: "Same Heart" }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Same Heart",
    description: SITE_DESCRIPTION,
    images: ["/mark.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <GlobalPlayer />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
