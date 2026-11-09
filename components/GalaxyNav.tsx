"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// A small, corner-anchored "return to the Galaxy" control -- the
// opposite-corner sibling of GlobalPlayer.tsx (that one lives top-left,
// this one lives top-right), mounted the same way at the root layout so
// it survives client-side navigation and follows the exact same
// hide-with-CSS convention instead of conditionally unmounting.
//
// Rob, Nov 7 2026: sending people straight into a deep page (Peer
// Support, from a talk he's giving) left them with no way back to the
// main Galaxy map at all. This fixes that everywhere at once by living
// in the root layout rather than being added page by page.
//
// Hidden on "/" (the pre-signup marketing splash), "/login" (the
// sign-up/sign-in + setup sequence itself), and "/galaxy" (no point
// linking to the page you're already on).
const HIDDEN_PATHS = ["/", "/login", "/galaxy"];

// Same ship silhouette used as the cursor in the Galaxy room and during
// the /login reveal (see app/galaxy/page.tsx and app/login/page.tsx) --
// rendered here as a real icon instead of a cursor data-URI, so it reads
// as "the Same Heart ship" wherever it shows up.
function ShipIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M50 4 L79 63 L50 48 L21 63 Z" fill="#f0d9a8" stroke="#c9a15a" strokeWidth="3" />
      <path
        d="M50 48 L50 95 L37 77 Z M50 48 L50 95 L63 77 Z"
        fill="#c9a15a"
        fillOpacity="0.55"
      />
    </svg>
  );
}

export default function GalaxyNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const hidden = HIDDEN_PATHS.includes(pathname);

  async function handleClick() {
    if (checking) return;
    setChecking(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        // No session at all -- a first-time visitor, e.g. someone
        // following a link straight to Peer Support. Send them through
        // the real sign-up + setup sequence instead of the Galaxy.
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("path_key")
        .eq("id", data.user.id)
        .single();

      if (!profile?.path_key) {
        // Signed in (maybe anonymously) but never actually finished the
        // colour/texture/question setup that assigns a path -- back to
        // /login to pick that up, not into the Galaxy half-set-up.
        router.push("/login");
        return;
      }

      router.push("/galaxy");
    } catch {
      // Network hiccup or similar -- /login always does the right thing
      // whether that session turns out to exist or not.
      router.push("/login");
    } finally {
      setChecking(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Return to the Galaxy"
      title="Return to the Galaxy"
      style={{
        display: hidden ? "none" : "flex",
        position: "fixed",
        top: "14px",
        right: "14px",
        zIndex: 400,
        alignItems: "center",
        justifyContent: "center",
        width: "40px",
        height: "40px",
        padding: 0,
        borderRadius: "10px",
        border: "1px solid rgba(201,161,90,0.5)",
        background: "linear-gradient(135deg, rgba(22,26,40,0.9), rgba(9,11,18,0.94))",
        boxShadow: "0 0 14px rgba(201,161,90,0.18), inset 0 0 0 1px rgba(201,161,90,0.08)",
        cursor: checking ? "default" : "pointer",
        opacity: checking ? 0.6 : 1,
      }}
    >
      <ShipIcon />
    </button>
  );
}
