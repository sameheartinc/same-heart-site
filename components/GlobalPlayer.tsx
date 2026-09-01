"use client";

import { usePathname } from "next/navigation";
import WidgetFrame from "./WidgetFrame";

// A small, corner-anchored "now playing" card (iHeartRadio's Afrobeats
// playlist) that lives in the root layout so it survives client-side
// navigation between the hub, the galaxy, and the Commons -- Next's App
// Router keeps a layout-level component mounted across route changes as
// long as it isn't conditionally unmounted, so this hides itself with CSS
// (display: none) on the two pages it shouldn't appear on, rather than
// returning null, which would tear the iframe down and restart it.
//
// The frame/skin mechanics live in components/WidgetFrame.tsx -- this
// component only owns positioning (fixed, top-left) and its own content
// (the iframe). Skinning here is necessarily frame-only: the iframe's
// contents (play button, track title, artwork) are iHeartRadio's own
// cross-origin page and can't be styled or scripted from here, full stop.
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
      }}
    >
      <WidgetFrame storageKey="same-heart-widget-skin">
        <iframe
          src="https://www.iheart.com/playlist/afrobeats-312064750-N25dHwBUmsC3ALDqgryqBt/?embed=true"
          title="Afrobeats playlist on iHeartRadio"
          width="220"
          height={52}
          style={{ border: "none", display: "block" }}
          allow="autoplay; encrypted-media"
        />
      </WidgetFrame>
    </div>
  );
}
