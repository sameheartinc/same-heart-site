"use client";

import { useEffect, useRef, useState } from "react";
import {
  FALLBACK_SKINS,
  loadWidgetSkins,
  getWidgetSkin,
  DEFAULT_WIDGET_SKIN_KEY,
  type WidgetSkin,
  type WidgetSkinKey,
} from "@/lib/widgetSkins";

// The one widget engine every skinnable widget on the site shares --
// see lib/widgetSkins.ts for the registry and the reasoning. A widget
// using this only ever needs a unique storageKey (so its skin choice is
// independent of every other widget's) and whatever content goes inside
// the frame; the frame itself -- background, border, radius, shadow, and
// the header bar with its skin picker -- is identical everywhere, per
// "never create separate copies of the widget for individual skins."
interface WidgetFrameProps {
  storageKey: string;
  children: React.ReactNode;
  // Skins to leave out of this widget's picker -- e.g. earned-only skins
  // (see lib/widgetSkins.ts's unlockId) the current profile hasn't earned
  // yet. Defaults to none, which is exactly the old behavior: every skin
  // in the catalog, always available. A caller that never passes this
  // (like GlobalPlayer today) is completely unaffected.
  lockedSkinKeys?: WidgetSkinKey[];
}

export default function WidgetFrame({ storageKey, children, lockedSkinKeys = [] }: WidgetFrameProps) {
  // Starts as FALLBACK_SKINS so the very first render (server and
  // client) agrees deterministically -- the real catalog loads in after
  // mount and swaps in seamlessly, same idea as the localStorage read
  // below.
  const [catalog, setCatalog] = useState<WidgetSkin[]>(FALLBACK_SKINS);
  const [skinKey, setSkinKey] = useState<WidgetSkinKey>(DEFAULT_WIDGET_SKIN_KEY);
  const [pickerOpen, setPickerOpen] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const availableSkins = catalog.filter((s) => !lockedSkinKeys.includes(s.key));

  // Load the real catalog once (shared across every WidgetFrame instance
  // via lib/widgetSkins.ts's module-level cache), then re-validate the
  // saved choice against it.
  useEffect(() => {
    let cancelled = false;
    loadWidgetSkins().then((skins) => {
      if (cancelled) return;
      setCatalog(skins);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Read any saved choice after mount, not during render, so the server
  // render and the first client render agree on the default -- reading
  // localStorage during render would mismatch and trigger a hydration
  // warning. A saved choice that's since become locked (shouldn't happen
  // today -- unlocks are never revoked -- but cheap to guard) falls back
  // to the default rather than silently showing a skin this profile
  // hasn't earned. Re-runs once the real catalog swaps in, in case the
  // saved key only exists there and not in FALLBACK_SKINS.
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
  }, [storageKey, catalog]);

  // Close the picker on an outside click -- a small, self-contained
  // popover doesn't need a portal or a modal library for this.
  useEffect(() => {
    if (!pickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (frameRef.current && !frameRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerOpen]);

  function chooseSkin(next: WidgetSkin) {
    setSkinKey(next.key);
    setPickerOpen(false);
    try {
      window.localStorage.setItem(storageKey, next.key);
    } catch {
      /* the choice just won't survive a reload this session -- not worth
         surfacing an error for. */
    }
  }

  const skin = getWidgetSkin(skinKey, catalog);

  // An artwork skin's image paints the outer frame -- it shows through
  // wherever a widget's own content leaves a gap (the Capsule's 22px
  // padding around its identity card, for instance), while the card
  // itself stays a solid, legible `--widget-panel` on top of it. A
  // frame-only widget with edge-to-edge content (the audio player's
  // iframe) won't show much of it, which is an honest limitation, not a
  // bug -- see components/GlobalPlayer.tsx. Falls back to the plain
  // color if the image is missing or fails to load.
  const frameBackground =
    skin.kind === "artwork" && skin.imageUrl
      ? `url(${skin.imageUrl}) center/cover no-repeat, var(--widget-background)`
      : "var(--widget-background)";

  return (
    <div
      ref={frameRef}
      style={{
        ...(skin.vars as React.CSSProperties),
        position: "relative",
        borderRadius: "var(--widget-radius)",
        overflow: "visible",
        background: frameBackground,
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
          borderRadius: "var(--widget-radius) var(--widget-radius) 0 0",
          overflow: "hidden",
        }}
      >
        <span aria-hidden="true">{skin.headerLabel}</span>
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          aria-label={`Change widget skin (currently ${skin.name})`}
          aria-expanded={pickerOpen}
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
      <div style={{ borderRadius: "0 0 var(--widget-radius) var(--widget-radius)", overflow: "hidden" }}>
        {children}
      </div>

      {pickerOpen && (
        <div
          style={{
            position: "absolute",
            top: "24px",
            right: 0,
            zIndex: 50,
            width: "216px",
            maxHeight: "260px",
            overflowY: "auto",
            padding: "8px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "6px",
            background: "var(--widget-panel)",
            border: "1px solid var(--widget-border)",
            borderRadius: "10px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          {availableSkins.map((s) => {
            const isActive = s.key === skin.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => chooseSkin(s)}
                title={s.name}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px 4px",
                  background: isActive ? "var(--widget-background)" : "none",
                  border: isActive ? "1px solid var(--widget-accent)" : "1px solid transparent",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    display: "block",
                    background:
                      s.kind === "artwork" && s.imageUrl
                        ? `url(${s.imageUrl}) center/cover no-repeat`
                        : s.vars["--widget-panel"],
                    border: `2px solid ${s.vars["--widget-accent"]}`,
                    boxShadow: `0 0 6px ${s.vars["--widget-accent"]}88`,
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "8px",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--widget-text-dim)",
                    textAlign: "center",
                    lineHeight: 1.2,
                  }}
                >
                  {s.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
