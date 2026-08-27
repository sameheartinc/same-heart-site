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

// The universal starfield shown before anyone's path is known -- the same
// for every visitor, regardless of which world they land in afterward.
export const ONBOARDING_WORLD: WorldVisual = {
  skyTop: "#05060f",
  skyBottom: "#171226",
  particleColor: "#c9a15a",
  particleStyle: "stars",
};

export const WORLDS: Record<PathKey, WorldDef> = {
  guardian: {
    key: "guardian",
    skyTop: "#0a0e1a",
    skyBottom: "#3a2a12",
    particleColor: "#c9a15a",
    particleStyle: "dust",
  },
  seeker: {
    key: "seeker",
    skyTop: "#05060f",
    skyBottom: "#141a33",
    particleColor: "#a9c1f2",
    particleStyle: "stars",
  },
  weaver: {
    key: "weaver",
    skyTop: "#06121a",
    skyBottom: "#123240",
    particleColor: "#c9576a",
    particleStyle: "current",
  },
  flame: {
    key: "flame",
    skyTop: "#0d0603",
    skyBottom: "#3a1608",
    particleColor: "#e0703a",
    particleStyle: "embers",
  },
};
