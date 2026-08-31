import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import GlobalPlayer from "@/components/GlobalPlayer";
import "./globals.css";

const SITE_URL = "https://sameheart.ca";
const SITE_DESCRIPTION =
  "SAMEHEART is opening its doors soon. Quiet from the outside — a whole universe once you're in.";

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
        <GlobalPlayer />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
