"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// A persistent "now playing" bar (V-103 International, via iHeartRadio's
// official embed) that lives in the root layout so it survives client-side
// navigation between the hub, the galaxy, and the Commons -- Next's App
// Router keeps a layout-level component mounted across route changes as
// long as it isn't conditionally unmounted, so this hides itself with CSS
// (display: none) on the two pages it shouldn't appear on, rather than
// returning null, which would tear the iframe down and restart the stream
// every time someone left and came back.
const PLAYER_HEIGHT = 68;
const HIDDEN_PATHS = ["/", "/login"];

export default function GlobalPlayer() {
  const pathname = usePathname();
  const hidden = HIDDEN_PATHS.includes(pathname);

  // Push page content down by the bar's height so the fixed bar never
  // overlaps anything -- toggled on the same pages the bar itself is
  // hidden on, and reset if this ever unmounts.
  useEffect(() => {
    document.body.style.paddingTop = hidden ? "0px" : `${PLAYER_HEIGHT}px`;
    return () => {
      document.body.style.paddingTop = "0px";
    };
  }, [hidden]);

  return (
    <div
      style={{
        display: hidden ? "none" : "block",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 500,
        height: `${PLAYER_HEIGHT}px`,
        background: "#08090f",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <iframe
        src="https://www.iheart.com/live/v-103-international-10787/?embed=true"
        title="V-103 International on iHeartRadio"
        width="100%"
        height={PLAYER_HEIGHT}
        style={{ border: "none", display: "block" }}
        allow="autoplay; encrypted-media"
      />
    </div>
  );
}
