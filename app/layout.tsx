import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Same Heart",
  description: "SAMEHEART™ — First Signal",
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
