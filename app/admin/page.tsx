"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// A one-page front door to the admin dashboards, so "where's the admin
// page" has one answer (/admin) instead of two URLs you have to
// remember separately. Gated the same way every admin page is: this
// check only controls what's *shown*, RLS on the underlying tables is
// what actually stops a non-admin from writing anything.
const DASHBOARDS: { href: string; name: string; description: string }[] = [
  { href: "/admin/skins", name: "Widget Skins", description: "The color palettes and artwork offered in the audio player and Hub Capsule." },
  { href: "/admin/signal", name: "Signal Sources", description: "The RSS feeds the hourly Signal fetch reads from." },
  { href: "/admin/monetization", name: "Monetization Applications", description: "Everyone who's earned all four Heart Strings and applied -- yours to approve or deny." },
  { href: "/admin/flags", name: "Flagged Content", description: "Every flag raised via Stewardship Tier 1's Flag button -- resolve or dismiss." },
];

export default function AdminIndexPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userData.user.id)
        .single();
      setIsAdmin(Boolean(profileRow?.is_admin));
      setChecking(false);
    })();
  }, [router]);

  if (checking) return null;

  if (!isAdmin) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "var(--void)",
          color: "var(--ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-body)",
        }}
      >
        <p>You don&rsquo;t have access to this page.</p>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--void)",
        color: "var(--ink)",
        padding: "48px 22px 80px",
      }}
    >
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        <Link
          href="/hub"
          style={{
            color: "var(--gold)",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          &larr; Same Heart
        </Link>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.7rem",
            margin: "20px 0 24px",
          }}
        >
          Admin
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {DASHBOARDS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              style={{
                display: "block",
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "16px 18px",
                textDecoration: "none",
                color: "var(--ink)",
              }}
            >
              <p style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.02rem", color: "var(--gold)" }}>
                {d.name}
              </p>
              <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--ink-dim)" }}>
                {d.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
