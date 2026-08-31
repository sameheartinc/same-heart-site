"use client";

import { usePathname } from "next/navigation";

// A small, corner-anchored "now playing" card (iHeartRadio's Afrobeats
// playlist -- swapped in for the V-103 International live station, whose
// stream turned out to be geo-blocked outside its home market; a curated
// playlist carries broader streaming rights and actually plays) that
// lives in the root layout so it survives client-side navigation between
// the hub, the galaxy, and the Commons -- Next's App Router keeps a
// layout-level component mounted across route changes as long as it
// isn't conditionally unmounted, so this hides itself with CSS
// (display: none) on the two pages it shouldn't appear on, rather than
// returning null, which would tear the iframe down and restart it.
//
// Deliberately small and corner-anchored rather than a full-width bar --
// it should read as one more piece of the page, not a strip that pushes
// everything else down.
const HIDDEN_PATHS = ["/", "/login"];

export default function GlobalPlayer() {
  const pathname = usePathname();
  const hidden = HIDDEN_PATHS.includes(pathname);

  return (
    <div
      style={{
        display: hidden ? "none" : "block",
        position: "fixed",
        top: "14px",
        left: "14px",
        zIndex: 400,
        width: "220px",
        height: "52px",
        borderRadius: "14px",
        overflow: "hidden",
        background: "var(--panel)",
        border: "1px solid var(--border)",
        boxShadow: "0 4px 18px rgba(0,0,0,0.28)",
      }}
    >
      <iframe
        src="https://www.iheart.com/playlist/afrobeats-312064750-N25dHwBUmsC3ALDqgryqBt/?embed=true"
        title="Afrobeats playlist on iHeartRadio"
        width="220"
        height="52"
        style={{ border: "none", display: "block" }}
        allow="autoplay; encrypted-media"
      />
    </div>
  );
}
