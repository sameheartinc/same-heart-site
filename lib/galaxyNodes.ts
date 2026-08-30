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
  // True for a node whose href leaves the site entirely (e.g. an outside
  // donation page) -- tells the Galaxy page to open it in a new tab
  // instead of navigating away from Same Heart.
  external?: boolean;
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
    tagline: "Shop > Ship",
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
  {
    // A real, working destination, not a "coming soon" placeholder --
    // deliberately sized modestly (smaller than Commons/Shop, not dimmed
    // like Field Guide) so it reads as present but not asking for
    // anything. Sits in the widest open gap on the ring, between Field
    // Guide and the Wallet. Links straight out to a Stripe Payment Link
    // (pay-what-you-want) -- no payment code runs on Same Heart itself,
    // and no Buy Me a Coffee platform cut either. To change the amount
    // options or copy, edit the Payment Link directly in the Stripe
    // dashboard; to point this node somewhere else entirely, this href
    // is the only line that needs to change.
    key: "hearth",
    href: "https://buy.stripe.com/6oUfZhgKz9dmbh3dovcAo01",
    external: true,
    monogram: "♥",
    name: "The Hearth",
    tagline: "Feed. Water. Teach.",
    accent: "#ff6f91",
    angleDeg: 95,
    radiusPct: 44,
    scale: 0.85,
  },
];
