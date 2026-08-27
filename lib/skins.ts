// Same Heart -- Skins registry.
//
// A "skin" is nothing more than a set of CSS custom-property overrides for
// the same variable names already defined in app/globals.css (--void,
// --panel, --ink, --ink-dim, --ink-faint, --gold, --rose). Every page in
// this app already reads its colors through var(--gold) etc., so applying
// a skin is just: put these values on a wrapping element, and everything
// inside repaints automatically. No component needs to know skins exist.
//
// To add a new skin later: copy one entry, change the key, name, blurb,
// and the seven hex values. Nothing else in the app needs to change.

export type SkinKey = "cosmic-gold" | "earth-tones" | "pastel-dream";

export type Skin = {
  key: SkinKey;
  name: string;
  blurb: string;
  vars: {
    "--void": string;
    "--panel": string;
    "--ink": string;
    "--ink-dim": string;
    "--ink-faint": string;
    "--gold": string;
    "--rose": string;
    "--border": string;
  };
};

export const SKINS: Skin[] = [
  {
    key: "cosmic-gold",
    name: "Cosmic Gold",
    blurb: "Deep space, warm metal. The original signal.",
    vars: {
      "--void": "#05070d",
      "--panel": "#131b2e",
      "--ink": "#f3ecd9",
      "--ink-dim": "#a9a2c2",
      "--ink-faint": "#6b6f95",
      "--gold": "#e8c27a",
      "--rose": "#d97a8a",
      "--border": "#313f5e",
    },
  },
  {
    key: "earth-tones",
    name: "Earth Tones",
    blurb: "Clay, umber, and sun. Grounded and warm.",
    vars: {
      "--void": "#1c140d",
      "--panel": "#2b2018",
      "--ink": "#f0e4d0",
      "--ink-dim": "#bfa78a",
      "--ink-faint": "#8a7458",
      "--gold": "#c97a3f",
      "--rose": "#b5533f",
      "--border": "#4a3728",
    },
  },
  {
    key: "pastel-dream",
    name: "Pastel Dream",
    blurb: "Soft light, quiet color. Same signal, softer voice.",
    vars: {
      "--void": "#faf3f7",
      "--panel": "#ffffff",
      "--ink": "#4a3a52",
      "--ink-dim": "#8d7a92",
      "--ink-faint": "#b6a7bb",
      "--gold": "#e8a1b0",
      "--rose": "#c96b83",
      "--border": "#e6d3de",
    },
  },
];

export const DEFAULT_SKIN_KEY: SkinKey = "cosmic-gold";

export function getSkin(key: string | null | undefined): Skin {
  return SKINS.find((s) => s.key === key) ?? SKINS[0];
}

// Cast to React.CSSProperties at the call site -- custom properties aren't
// in the official CSSProperties type, so `as React.CSSProperties` is needed
// wherever this is spread into a style prop.
export function skinStyleVars(skin: Skin) {
  return { ...skin.vars };
}
