"use client";

import { useEffect, useState } from "react";
import { WIDGET_SKINS, getWidgetSkin, DEFAULT_WIDGET_SKIN_KEY, type WidgetSkinKey } from "@/lib/widgetSkins";

// The one widget engine every skinnable widget on the site shares --
// see lib/widgetSkins.ts for the registry and the reasoning. A widget
// using this only ever needs a unique storageKey (so its skin choice is
// independent of every other widget's) and whatever content goes inside
// the frame; the frame itself -- background, border, radius, shadow, and
// the header bar with its skin-switch button -- is identical everywhere,
// per "never create separate copies of the widget for individual skins."
interface WidgetFrameProps {
  storageKey: string;
  children: React.ReactNode;
  // Skins to leave out of this widget's cycle -- e.g. earned-only skins
  // (see lib/widgetSkins.ts's unlockId) the current profile hasn't earned
  // yet. Defaults to none, which is exactly the old behavior: every skin
  // in the registry, always available. A caller that never passes this
  // (like GlobalPlayer today) is completely unaffected.
  lockedSkinKeys?: WidgetSkinKey[];
}

export default function WidgetFrame({ storageKey, children, lockedSkinKeys = [] }: WidgetFrameProps) {
  const [skinKey, setSkinKey] = useState<WidgetSkinKey>(DEFAULT_WIDGET_SKIN_KEY);
  const availableSkins = WIDGET_SKINS.filter((s) => !lockedSkinKeys.includes(s.key));

  // Read any saved choice after mount, not during render, so the server
  // render and the first client render agree on the default -- reading
  // localStorage during render would mismatch and trigger a hydration
  // warning. A saved choice that's since become locked (shouldn't happen
  // today -- unlocks are never revoked -- but cheap to guard) falls back
  // to the default rather than silently showing a skin this profile
  // hasn't earned.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved && availableSkins.some((s) => s.key === saved)) {
        setSkinKey(saved as WidgetSkinKey);
      }
    } catch {
      /* localStorage can throw in some private-browsing contexts -- the
         default skin is a perfectly fine fallback. */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function cycleSkin() {
    const currentIndex = availableSkins.findIndex((s) => s.key === skinKey);
    const next = availableSkins[(currentIndex + 1) % availableSkins.length];
    setSkinKey(next.key);
    try {
      window.localStorage.setItem(storageKey, next.key);
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
        borderRadius: "var(--widget-radius)",
        overflow: "hidden",
        background: "var(--widget-background)",
        border: "1px solid var(--widget-border)",
        boxShadow: "var(--widget-shadow)",
      }}
    >
      <div
        style={{
          height: "20px",
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
      {children}
    </div>
  );
}
