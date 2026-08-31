// Same Heart -- Widget Skins registry.
//
// Separate, on purpose, from lib/skins.ts (the site-wide Hub/Commons
// theme). That registry recolors the whole page you're standing on; this
// one only recolors the little audio card in the corner. They're
// independent choices someone should be able to mix -- a dark site theme
// with a retro widget, or vice versa -- so neither reads the other's
// state and neither can break by changing the other's shape.
//
// FRAME-ONLY, on purpose: the widget's actual audio content is an
// iHeartRadio iframe (see components/GlobalPlayer.tsx). A cross-origin
// iframe's insides -- its play button, track title, artwork -- can't be
// styled, scripted, or read from the parent page under any circumstance;
// that's a browser security boundary, not a missing feature. Every skin
// here only touches what Same Heart actually draws: the card's
// background, border, corner radius, shadow/glow, and a thin header bar
// sitting above the iframe with the skin's label and the switch control.
//
// To add a new skin later: copy one entry, change the key, name,
// description, and the seven var values. GlobalPlayer.tsx doesn't need
// to change -- it only ever reads WIDGET_SKINS / getWidgetSkin.

export type WidgetSkinKey = "classic" | "retro" | "cyberpunk";

export interface WidgetSkin {
  key: WidgetSkinKey;
  name: string;
  description: string;
  // Shown in the thin header bar above the iframe -- purely decorative
  // text, not a station name (the real "now playing" info lives inside
  // iHeartRadio's own iframe content, which this can't read or echo).
  headerLabel: string;
  vars: {
    "--widget-background": string;
    "--widget-border": string;
    "--widget-radius": string;
    "--widget-shadow": string;
    "--widget-header-bg": string;
    "--widget-header-text": string;
    "--widget-accent": string;
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
      "--widget-border": "#313f5e",
      "--widget-radius": "14px",
      "--widget-shadow": "0 4px 18px rgba(0,0,0,0.28)",
      "--widget-header-bg": "#121a2c",
      "--widget-header-text": "#8b93ab",
      "--widget-accent": "#c9a15a",
    },
  },
  {
    key: "retro",
    name: "Retro",
    description: "A beveled late-90s messenger titlebar.",
    headerLabel: "SIGNAL.EXE",
    vars: {
      "--widget-background": "#c0c0c0",
      "--widget-border": "#4d4d4d",
      "--widget-radius": "2px",
      "--widget-shadow":
        "inset 1px 1px 0 #ffffff, inset -1px -1px 0 #4d4d4d, 2px 2px 0 rgba(0,0,0,0.45)",
      "--widget-header-bg": "linear-gradient(180deg, #2a6fe0, #0a3aa8)",
      "--widget-header-text": "#ffffff",
      "--widget-accent": "#2a6fe0",
    },
  },
  {
    key: "cyberpunk",
    name: "Cyberpunk",
    description: "Neon on near-black.",
    headerLabel: "SIGNAL_v2",
    vars: {
      "--widget-background": "#080b12",
      "--widget-border": "#00ffff",
      "--widget-radius": "4px",
      "--widget-shadow": "0 0 16px rgba(255,0,255,0.55), 0 0 4px rgba(0,255,255,0.6)",
      "--widget-header-bg": "#101827",
      "--widget-header-text": "#ff00ff",
      "--widget-accent": "#00ffff",
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
