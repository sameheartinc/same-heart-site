import { PathKey } from "./paths";

export type ParticleStyle = "dust" | "stars" | "current" | "embers";

export interface WorldVisual {
  skyTop: string;
  skyBottom: string;
  particleColor: string;
  particleStyle: ParticleStyle;
  // Drop a real asset in later -- no code changes needed elsewhere once
  // these are set, WorldField prefers them over the procedural canvas.
  backgroundImage?: string;
  backgroundVideo?: string;
}

export interface WorldDef extends WorldVisual {
  key: PathKey;
}

// White-theme pass, Aug 31 2026 -- these were near-black night skies
// (e.g. onboarding was #05060f to #171226). Same five worlds, same
// particle motion per style, but each sky is now a pale, barely-tinted
// gradient reading as "bright atmosphere" rather than "night sky," and
// each particleColor is deepened/saturated enough to still show up as
// visible motion against a light background instead of washing out.

// The universal starfield shown before anyone's path is known -- the same
// for every visitor, regardless of which world they land in afterward.
export const ONBOARDING_WORLD: WorldVisual = {
  skyTop: "#fdfcf9",
  skyBottom: "#f2ebda",
  particleColor: "#a8783a",
  particleStyle: "stars",
};

export const WORLDS: Record<PathKey, WorldDef> = {
  guardian: {
    key: "guardian",
    skyTop: "#fdfcf9",
    skyBottom: "#f0e2c4",
    particleColor: "#a8783a",
    particleStyle: "dust",
  },
  seeker: {
    key: "seeker",
    skyTop: "#fbfcff",
    skyBottom: "#e4eaf7",
    particleColor: "#3d5fb0",
    particleStyle: "stars",
  },
  weaver: {
    key: "weaver",
    skyTop: "#f7fdfc",
    skyBottom: "#d9f0ee",
    particleColor: "#b8425a",
    particleStyle: "current",
  },
  flame: {
    key: "flame",
    skyTop: "#fffaf6",
    skyBottom: "#fbdcc7",
    particleColor: "#c25a2a",
    particleStyle: "embers",
  },
};
