// Same Heart -- Skins registry.
//
// A "skin" is nothing more than a set of CSS custom-property overrides for
// the same variable names already defined in app/globals.css (--void,
// --panel, --ink, --ink-dim, --ink-faint, --gold, --rose). Every page in
// this app already reads its colors through var(--gold) etc., so applying
// a skin is just: put these values on a wrapping element, and everything
// inside repaints automatically. No component needs to know skins exist.
//
// To add a new plain palette skin later: copy one entry, change the key,
// name, blurb, and the seven hex values. Nothing else in the app needs to
// change.
//
// `kind` is the seam for a second, richer sort of skin: "artwork" skins
// carry a real image (`image`, a path under /public) and an attribution
// line (`credit`) alongside the usual palette, so a piece of real art can
// stand behind the Hub instead of just a gradient. Every existing skin is
// `kind: "palette"` with no image, so this is purely additive -- nothing
// about how they render changes. `image`/`credit` are curated here, not
// user-uploaded, on purpose: no upload flow, no moderation surface, no new
// privacy question to answer for a purely cosmetic feature.

export type SkinKey = "white-signal" | "cosmic-gold" | "earth-tones" | "pastel-dream";

export type SkinKind = "palette" | "artwork";

export type Skin = {
  key: SkinKey;
  kind: SkinKind;
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
  image?: string;
  credit?: string;
};

export const SKINS: Skin[] = [
  {
    // Aug 31 2026 -- the site's white-theme pass: this is now what
    // app/globals.css's :root also carries, so a page renders the same
    // whether or not it wraps itself in a skin. Kept as a real, separate
    // skin (not baked into cosmic-gold's own entry) so the original dark
    // look stays one click away in the Skins picker instead of being lost.
    key: "white-signal",
    kind: "palette",
    name: "White Signal",
    blurb: "Open and bright. Same signal, daylight now.",
    vars: {
      "--void": "#ffffff",
      "--panel": "#f6f4ee",
      "--ink": "#1b1a2e",
      "--ink-dim": "#5c6674",
      "--ink-faint": "#8b8fa3",
      "--gold": "#a8783a",
      "--rose": "#b8425a",
      "--border": "#e4e0d4",
    },
  },
  {
    key: "cosmic-gold",
    kind: "palette",
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
    kind: "palette",
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
    kind: "palette",
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

export const DEFAULT_SKIN_KEY: SkinKey = "white-signal";

export function getSkin(key: string | null | undefined): Skin {
  return SKINS.find((s) => s.key === key) ?? SKINS.find((s) => s.key === DEFAULT_SKIN_KEY)!;
}

// Cast to React.CSSProperties at the call site -- custom properties aren't
// in the official CSSProperties type, so `as React.CSSProperties` is needed
// wherever this is spread into a style prop.
export function skinStyleVars(skin: Skin) {
  return { ...skin.vars };
}
