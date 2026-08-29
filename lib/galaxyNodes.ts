// The five destinations orbiting the Galaxy view -- the top-level map of
// the whole site, reached by "lifting off" from the Hub. Each is a plain
// route; three are honest "coming soon" placeholders until their real
// build phase comes up (see README), so the navigation shell is complete
// even though not every room has furniture yet.
//
// Layout is deliberately NOT evenly spaced anymore -- angleDeg/radiusPct/
// scale let each destination carry its own visual weight. 0deg is due
// right, 90 is down, -90 is up, going clockwise. Bigger radius + smaller
// scale + dim reads as "further away and less urgent" (Field Guide);
// smaller radius + bigger scale reads as "come here first" (the Merch
// Ship, the Commons).

export interface GalaxyNode {
  key: string;
  href: string;
  monogram: string;
  name: string;
  tagline: string;
  accent: string;
  angleDeg: number;
  radiusPct: number;
  scale: number;
  dim?: boolean;
}

export const GALAXY_NODES: GalaxyNode[] = [
  {
    key: "hub",
    href: "/hub",
    monogram: "H",
    name: "The Hub",
    tagline: "Your capsule",
    accent: "#c9a15a",
    angleDeg: -90,
    radiusPct: 40,
    scale: 1,
  },
  {
    key: "commons",
    href: "/commons",
    monogram: "C",
    name: "The Commons",
    tagline: "Community & chat",
    accent: "#c9576a",
    angleDeg: -155,
    radiusPct: 39,
    scale: 1.3,
  },
  {
    key: "shop",
    href: "/shop",
    monogram: "S",
    name: "The Merch Ship",
    tagline: "Not shop. Ship.",
    accent: "#7c9fd9",
    angleDeg: -25,
    radiusPct: 33,
    scale: 1.34,
  },
  {
    key: "wallet",
    href: "/wallet",
    monogram: "W",
    name: "The Wallet",
    tagline: "Cards & unlockables",
    accent: "#e0703a",
    angleDeg: 150,
    radiusPct: 42,
    scale: 1.05,
  },
  {
    key: "guide",
    href: "/guide",
    monogram: "?",
    name: "Field Guide",
    tagline: "How it all works",
    accent: "#7fd9c4",
    angleDeg: 8,
    radiusPct: 57,
    scale: 0.58,
    dim: true,
  },
];
