"use client";

import Link from "next/link";

// Stripe redirects here right after checkout completes -- but the
// sponsorship itself isn't marked 'paid' by this page load, it's marked
// paid by app/api/sponsor/webhook/route.ts once Stripe confirms the
// charge server-side. This page is purely a friendly landing spot; it
// never reads or trusts anything from its own query string.
export default function SponsorThankYouPage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--void)", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ textAlign: "center", maxWidth: "480px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.6rem", margin: "0 0 12px" }}>
          Thank you.
        </h1>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--ink-dim)", lineHeight: 1.7, marginBottom: "20px" }}>
          Your sponsorship is being confirmed now -- you&rsquo;ll receive a receipt from Stripe by
          email, and your recognition will appear on the campaign page shortly.
        </p>
        <Link href="/" style={{ color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: "0.85rem" }}>
          &larr; Back to Same Heart
        </Link>
      </div>
    </main>
  );
}
