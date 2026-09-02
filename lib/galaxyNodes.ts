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
  // Glyph rendered inside the node's glowing orb, on top of the plain
  // color pulse (see app/galaxy/page.tsx's redesign notes: the old
  // spinning rainbow disc read as busy, so the pulse itself stayed
  // plain -- these glyphs are a separate, later addition, not a return
  // to that). "icosahedron" is the default shape for every destination;
  // the Hearth alone keeps its own "dodecahedron", chosen deliberately
  // (see its own comment below) so the donate node stays visually
  // distinct from the rest. Both rotate on hover -- see
  // .galaxy-node-icon in app/galaxy/page.tsx.
  icon?: "dodecahedron" | "icosahedron";
}

export const GALAXY_NODES: GalaxyNode[] = [
  {
    key: "hub",
    href: "/hub",
    monogram: "H",
    icon: "icosahedron",
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
    icon: "icosahedron",
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
    icon: "icosahedron",
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
    icon: "icosahedron",
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
    icon: "icosahedron",
    name: "Field Guide",
    tagline: "How it all works",
    accent: "#7fd9c4",
    angleDeg: 8,
    radiusPct: 57,
    scale: 0.58,
    dim: true,
  },
  {
    // A "coming soon" placeholder, same shape as Wallet/Field Guide --
    // Rob's own idea: a play area for quick, funny little games (his
    // words: "geopolitical games... I have a lot of funny little games
    // we could code out"), built one at a time as real, working games
    // rather than promised as a vague feature. Sits opposite the Hub
    // (180deg) in the widest remaining gap on the ring, between the
    // Wallet and Commons.
    key: "games",
    href: "/games",
    monogram: "G",
    icon: "icosahedron",
    name: "The Arcade",
    tagline: "Quick games, real code",
    accent: "#9b6fe0",
    angleDeg: 180,
    radiusPct: 50,
    scale: 0.95,
  },
  {
    // A real, working destination -- see lib/deepSignals.ts for the
    // full reasoning. Rob's own framing: anyone can search the web for
    // information, so the thing worth coming back for is the collective
    // experience of unlocking something real, one Signal at a time, on
    // two fronts he named directly -- media/information literacy, and
    // drug prevention & real opportunity for young people. Deliberately
    // NOT dimmed like Field Guide/Arcade -- this is real content from
    // day one, not a placeholder. Sits in the widest open gap on the
    // ring, between Field Guide (8deg) and the Hearth (95deg).
    key: "deep-signals",
    href: "/deep-signals",
    monogram: "D",
    icon: "icosahedron",
    name: "Deep Signals",
    tagline: "Real answers, unlocked as you grow",
    accent: "#5b5fc7",
    angleDeg: 50,
    radiusPct: 45,
    scale: 1,
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
    icon: "dodecahedron",
    name: "The Hearth",
    tagline: "Feed. Water. Teach.",
    accent: "#ff6f91",
    angleDeg: 95,
    radiusPct: 44,
    scale: 1,
  },
];
