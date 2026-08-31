"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { WIDGET_SKINS, getWidgetSkin, DEFAULT_WIDGET_SKIN_KEY, type WidgetSkinKey } from "@/lib/widgetSkins";

// A small, corner-anchored "now playing" card (iHeartRadio's Afrobeats
// playlist) that lives in the root layout so it survives client-side
// navigation between the hub, the galaxy, and the Commons -- Next's App
// Router keeps a layout-level component mounted across route changes as
// long as it isn't conditionally unmounted, so this hides itself with CSS
// (display: none) on the two pages it shouldn't appear on, rather than
// returning null, which would tear the iframe down and restart it.
//
// Skinning is frame-only: the iframe's contents (play button, track
// title, artwork) are iHeartRadio's own cross-origin page and can't be
// styled or scripted from here, full stop -- so a skin only ever
// recolors the card around it (background, border, radius, shadow, the
// thin header bar) via lib/widgetSkins.ts. See that file for why it's a
// separate registry from the site-wide Hub/Commons skins.
const HIDDEN_PATHS = ["/", "/login"];
const STORAGE_KEY = "same-heart-widget-skin";
const IFRAME_HEIGHT = 52;
const HEADER_HEIGHT = 20;

export default function GlobalPlayer() {
  const pathname = usePathname();
  const hidden = HIDDEN_PATHS.includes(pathname);

  const [skinKey, setSkinKey] = useState<WidgetSkinKey>(DEFAULT_WIDGET_SKIN_KEY);

  // Read any saved choice after mount, not during render, so the server
  // render and the first client render agree on the default -- reading
  // localStorage during render would mismatch and trigger a hydration
  // warning.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && WIDGET_SKINS.some((s) => s.key === saved)) {
        setSkinKey(saved as WidgetSkinKey);
      }
    } catch {
      /* localStorage can throw in some private-browsing contexts -- the
         default skin is a perfectly fine fallback. */
    }
  }, []);

  function cycleSkin() {
    const currentIndex = WIDGET_SKINS.findIndex((s) => s.key === skinKey);
    const next = WIDGET_SKINS[(currentIndex + 1) % WIDGET_SKINS.length];
    setSkinKey(next.key);
    try {
      window.localStorage.setItem(STORAGE_KEY, next.key);
    } catch {
      /* the choice just won't survive a reload this session -- not worth
         surfacing an error for. */
    }
  }

  const skin = getWidgetSkin(skinKey);

  return (
    <div
      style={{
        ...(skin.vars as React.CSSProperties),
        display: hidden ? "none" : "block",
        position: "fixed",
        top: "14px",
        left: "14px",
        zIndex: 400,
        width: "220px",
        height: `${IFRAME_HEIGHT + HEADER_HEIGHT}px`,
        borderRadius: "var(--widget-radius)",
        overflow: "hidden",
        background: "var(--widget-background)",
        border: "1px solid var(--widget-border)",
        boxShadow: "var(--widget-shadow)",
      }}
    >
      <div
        style={{
          height: `${HEADER_HEIGHT}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 8px",
          background: "var(--widget-header-bg)",
          color: "var(--widget-header-text)",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "9px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        <span aria-hidden="true">{skin.headerLabel}</span>
        <button
          type="button"
          onClick={cycleSkin}
          aria-label={`Change widget skin (currently ${skin.name})`}
          title={`Change widget skin (currently ${skin.name})`}
          style={{
            background: "none",
            border: "none",
            color: "inherit",
            cursor: "pointer",
            fontSize: "11px",
            padding: "2px 4px",
            lineHeight: 1,
          }}
        >
          &#9673;
        </button>
      </div>
      <iframe
        src="https://www.iheart.com/playlist/afrobeats-312064750-N25dHwBUmsC3ALDqgryqBt/?embed=true"
        title="Afrobeats playlist on iHeartRadio"
        width="220"
        height={IFRAME_HEIGHT}
        style={{ border: "none", display: "block" }}
        allow="autoplay; encrypted-media"
      />
    </div>
  );
}
