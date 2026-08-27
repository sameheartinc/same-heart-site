"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

interface ComingSoonProps {
  monogram: string;
  accent: string;
  name: string;
  body: string;
}

// Shared shell for a Galaxy destination that's mapped but not built yet --
// honest about not being finished, but still signed-in-gated and styled
// like it belongs, not a dead link or a blank page.
export default function ComingSoon({ monogram, accent, name, body }: ComingSoonProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setChecking(false);
    })();
  }, [router]);

  if (checking) return null;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        textAlign: "center",
        background: "var(--void)",
      }}
    >
      <div style={{ maxWidth: "440px" }}>
        <span
          style={{
            display: "inline-flex",
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--panel)",
            border: `1px solid ${accent}`,
            boxShadow: `0 0 22px ${accent}44`,
            color: accent,
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "1.4rem",
            marginBottom: "22px",
          }}
        >
          {monogram}
        </span>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.6rem",
            margin: "0 0 6px",
            color: "var(--ink)",
          }}
        >
          {name}
        </h1>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: accent,
            margin: "0 0 20px",
          }}
        >
          Not built yet
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontStyle: "italic",
            color: "var(--ink-dim)",
            fontSize: "0.98rem",
            lineHeight: 1.6,
            margin: "0 0 30px",
          }}
        >
          {body}
        </p>
        <Link
          href="/galaxy"
          style={{
            color: "var(--gold)",
            fontFamily: "var(--font-display)",
            fontSize: "0.85rem",
            textDecoration: "none",
            borderBottom: "1px solid var(--gold)",
            paddingBottom: "2px",
          }}
        >
          &larr; Back to the Galaxy
        </Link>
      </div>
    </main>
  );
}
