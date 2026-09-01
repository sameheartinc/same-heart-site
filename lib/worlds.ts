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
//
// Heavenly, not just recolored: a light sky isn't a dark sky with the
// values flipped -- a pale particle on a pale ground disappears (this
// bit Seeker specifically: #a9c1f2 stars were fine on navy, invisible on
// cream). Every particleColor below was re-picked for real contrast
// against its own sky, keeping each path's original hue family so the
// identity carries over -- gold stays gold, rose stays rose, ember stays
// ember.
export const ONBOARDING_WORLD: WorldVisual = {
  skyTop: "#fdfbf5",
  skyBottom: "#f3e6d0",
  particleColor: "#b8863f",
  particleStyle: "stars",
};

export const WORLDS: Record<PathKey, WorldDef> = {
  guardian: {
    key: "guardian",
    skyTop: "#fdfbf5",
    skyBottom: "#e8d2a8",
    particleColor: "#96702f",
    particleStyle: "dust",
  },
  seeker: {
    key: "seeker",
    skyTop: "#f7fbff",
    skyBottom: "#dbe8f7",
    particleColor: "#4a6fa5",
    particleStyle: "stars",
  },
  weaver: {
    key: "weaver",
    skyTop: "#fdf6f7",
    skyBottom: "#f0d7de",
    particleColor: "#c9576a",
    particleStyle: "current",
  },
  flame: {
    key: "flame",
    skyTop: "#fff8f2",
    skyBottom: "#f6d7bb",
    particleColor: "#c9573a",
    particleStyle: "embers",
  },
};
