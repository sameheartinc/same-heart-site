import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Same Heart",
  description: "SAMEHEART™ — First Signal",
  verification: {
    google: "oGB17x90qYbnnnYrJRvDIrcVjveGqy74DeYKxMh_s64",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
