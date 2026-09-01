// Same Heart -- Widget Skins registry.
//
// Separate, on purpose, from lib/skins.ts (the site-wide Hub/Commons
// theme). That registry recolors the whole page you're standing on; this
// one recolors an individual "widget" -- a self-contained box with its
// own frame, header, and skin switcher, dropped anywhere on the site.
// Two widgets use it today: the corner audio player (components/
// GlobalPlayer.tsx) and the Hub's Capsule (app/hub/page.tsx). Each picks
// its own skin independently (separate localStorage keys), but both draw
// from this one registry -- that's the "ONE widget engine, MANY skins"
// principle: a new widget only ever needs its own storageKey, never its
// own copy of this file.
//
// The audio player is FRAME-ONLY: its content is an iHeartRadio iframe,
// cross-origin, so its play button/track title/artwork can't be styled
// from here at all -- only the card around it. The Capsule is a widget
// Same Heart actually renders, though, so it needs the fuller token set
// below (panel, text, accent, rose) to skin its interior too, not just
// its frame.
//
// To add a new skin later: copy one entry, change the key, name,
// description, and the var values. Nothing that *uses* a skin needs to
// change -- every consumer only ever calls WIDGET_SKINS / getWidgetSkin.

export type WidgetSkinKey = "classic" | "retro" | "cyberpunk";

export interface WidgetSkin {
  key: WidgetSkinKey;
  name: string;
  description: string;
  // Shown in the thin header bar every widget instance renders above its
  // content -- purely decorative text (a station name/callsign feel),
  // not live data.
  headerLabel: string;
  vars: {
    "--widget-background": string;
    "--widget-panel": string;
    "--widget-border": string;
    "--widget-radius": string;
    "--widget-shadow": string;
    "--widget-header-bg": string;
    "--widget-header-text": string;
    "--widget-text": string;
    "--widget-text-dim": string;
    "--widget-text-faint": string;
    "--widget-accent": string;
    "--widget-rose": string;
  };
}

export const WIDGET_SKINS: WidgetSkin[] = [
  {
    key: "classic",
    name: "Classic",
    description: "Clean and quiet -- the original card.",
    headerLabel: "SIGNAL",
    vars: {
      "--widget-background": "#121a2c",
      "--widget-panel": "#18233a",
      "--widget-border": "#313f5e",
      "--widget-radius": "14px",
      "--widget-shadow": "0 4px 18px rgba(0,0,0,0.28)",
      "--widget-header-bg": "#121a2c",
      "--widget-header-text": "#8b93ab",
      "--widget-text": "#ece7dc",
      "--widget-text-dim": "#9aa3b8",
      "--widget-text-faint": "#5c6684",
      "--widget-accent": "#c9a15a",
      "--widget-rose": "#c9576a",
    },
  },
  {
    key: "retro",
    name: "Retro",
    description: "A beveled late-90s messenger titlebar.",
    headerLabel: "SIGNAL.EXE",
    vars: {
      "--widget-background": "#c0c0c0",
      "--widget-panel": "#d4d0c8",
      "--widget-border": "#4d4d4d",
      "--widget-radius": "2px",
      "--widget-shadow":
        "inset 1px 1px 0 #ffffff, inset -1px -1px 0 #4d4d4d, 2px 2px 0 rgba(0,0,0,0.45)",
      "--widget-header-bg": "linear-gradient(180deg, #2a6fe0, #0a3aa8)",
      "--widget-header-text": "#ffffff",
      "--widget-text": "#000000",
      "--widget-text-dim": "#3a3a3a",
      "--widget-text-faint": "#6b6b6b",
      "--widget-accent": "#2a6fe0",
      "--widget-rose": "#c0392b",
    },
  },
  {
    key: "cyberpunk",
    name: "Cyberpunk",
    description: "Neon on near-black.",
    headerLabel: "SIGNAL_v2",
    vars: {
      "--widget-background": "#080b12",
      "--widget-panel": "#101827",
      "--widget-border": "#00ffff",
      "--widget-radius": "4px",
      "--widget-shadow": "0 0 16px rgba(255,0,255,0.55), 0 0 4px rgba(0,255,255,0.6)",
      "--widget-header-bg": "#101827",
      "--widget-header-text": "#ff00ff",
      "--widget-text": "#e8f9ff",
      "--widget-text-dim": "#9fd8e0",
      "--widget-text-faint": "#5f7a82",
      "--widget-accent": "#00ffff",
      "--widget-rose": "#ff2f7a",
    },
  },
];

export const DEFAULT_WIDGET_SKIN_KEY: WidgetSkinKey = "classic";

export function getWidgetSkin(key: string | null | undefined): WidgetSkin {
  return (
    WIDGET_SKINS.find((s) => s.key === key) ??
    WIDGET_SKINS.find((s) => s.key === DEFAULT_WIDGET_SKIN_KEY)!
  );
}
