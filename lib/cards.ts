import { KEY_INFO, type KeyColor } from "@/lib/keys";

// Same Heart -- collectible Cards.
//
// A Card is a special piece of digital art someone earns and keeps: for
// reaching a Level, for earning a Heart String, or for being here during a
// special event. Rob's direction (Sep 19, 2026): "leveling up, earning
// heart strings and special events." And (Sep 20, 2026): "you won't get
// cards until level 50" -- so nothing here is granted below
// CARDS_MIN_LEVEL, whatever its source (see lib/evolution.ts). A Heart
// String earned at Level 30 has its card waiting the moment Level 50 is
// reached; an event window that passes while someone is under Level 50
// is missed, by design. Cards are not their own system --
// each one is registered as an Evolution unlockable (see
// lib/evolution.ts, which builds them from this catalog), so earning is
// granted only by app/api/evolution/evaluate/route.ts, held in
// profile_unlocks, permanent, and never spent. That means adding a card is
// one entry below and (when there's real art) one image file -- no table,
// no route, no migration.
//
// HOW TO ADD A CARD
//   1. Drop the image at public/cards/<id>.png (or .jpg/.webp) and set
//      `image` to "/cards/<id>.png". Until an image exists, `image: null`
//      renders a generated placeholder in the card's accent color, so a
//      card can be earned and shown before its art is finished.
//   2. Add one entry to CARDS with a stable `id` -- never change an id
//      after it ships, it's what's stored per person as "card-<id>".
//   3. Pick a `source`:
//        { type: "level", level: N }            -- reaching Level N
//        { type: "heart-string", color }        -- holding that Heart String
//        { type: "event", label, from, until }  -- signed in and evaluated
//                                                  while now is inside the
//                                                  window (ISO timestamps)
//
// Event cards are claimed automatically the first time someone's Hub
// runs its quiet background check inside the window; once claimed they're
// kept forever, and nobody can claim one after `until`.

// Cards start at this Level and not before -- see the header above.
export const CARDS_MIN_LEVEL = 50;

export type CardRarity = "common" | "uncommon" | "rare" | "legendary";

export type CardSource =
  | { type: "level"; level: number }
  | { type: "heart-string"; color: KeyColor }
  | { type: "event"; label: string; from: string; until: string };

export interface CardDef {
  id: string;
  name: string;
  rarity: CardRarity;
  // Path under /public, e.g. "/cards/level-10.png". Null until real art
  // exists -- see HOW TO ADD A CARD above.
  image: string | null;
  source: CardSource;
  // Optional one-line flavor text shown under the name.
  blurb?: string;
}

export const RARITY_ACCENT: Record<CardRarity, string> = {
  common: "#a29cb0",
  uncommon: "#3fae62",
  rare: "#4a8fe0",
  legendary: "#e8c27a",
};

// One card every 50 levels across the whole 1000-level ladder (Level 50
// is also where cards begin; Level 1000 is the capstone -- see IDEAS.md's
// 1000-level notes). Rarity climbs with the level. To change the spacing,
// edit LEVEL_CARD_STEP; ids are "level-<N>" and are permanent once shipped.
const LEVEL_CARD_STEP = 50;
const MAX_LEVEL = 1000;

function levelRarity(level: number): CardRarity {
  if (level <= 100) return "common";
  if (level <= 300) return "uncommon";
  if (level <= 700) return "rare";
  return "legendary";
}

const LEVEL_CARDS: CardDef[] = Array.from({ length: MAX_LEVEL / LEVEL_CARD_STEP }, (_, i) => {
  const level = (i + 1) * LEVEL_CARD_STEP;
  return {
    id: `level-${level}`,
    name: `Level ${level}`,
    rarity: levelRarity(level),
    image: null,
    source: { type: "level" as const, level },
  };
});

// Starter catalog: the level cards above and one card per Heart String.
// Names and rarities are first cuts meant to be renamed and re-rarified
// once the real art arrives; only `id` is permanent.
export const CARDS: CardDef[] = [
  ...LEVEL_CARDS,

  { id: "heart-green", name: "Green Heart String", rarity: "uncommon", image: null, source: { type: "heart-string", color: "green" } },
  { id: "heart-blue", name: "Blue Heart String", rarity: "uncommon", image: null, source: { type: "heart-string", color: "blue" } },
  { id: "heart-red", name: "Red Heart String", rarity: "uncommon", image: null, source: { type: "heart-string", color: "red" } },
  { id: "heart-yellow", name: "Yellow Heart String", rarity: "uncommon", image: null, source: { type: "heart-string", color: "yellow" } },
  { id: "heart-purple", name: "Purple Heart String", rarity: "rare", image: null, source: { type: "heart-string", color: "purple" } },
  { id: "heart-pink", name: "Pink Heart String", rarity: "rare", image: null, source: { type: "heart-string", color: "pink" } },
  { id: "heart-magenta", name: "Magenta Heart String", rarity: "rare", image: null, source: { type: "heart-string", color: "magenta" } },
  { id: "heart-indigo", name: "Indigo Heart String", rarity: "rare", image: null, source: { type: "heart-string", color: "indigo" } },
  { id: "heart-orange", name: "Orange Heart String", rarity: "rare", image: null, source: { type: "heart-string", color: "orange" } },
  { id: "heart-white", name: "White Heart String", rarity: "rare", image: null, source: { type: "heart-string", color: "white" } },
  { id: "heart-black", name: "Black Heart String", rarity: "legendary", image: null, source: { type: "heart-string", color: "black" } },
];

export function cardUnlockId(cardId: string): string {
  return `card-${cardId}`;
}

// The color a card's placeholder art and frame lean on: a Heart String
// card takes its string's own color, everything else takes its rarity's.
export function cardAccent(card: CardDef): string {
  if (card.source.type === "heart-string") return KEY_INFO[card.source.color].accent;
  return RARITY_ACCENT[card.rarity];
}

// Plain-language "how do I get this" text, shown on locked cards so the
// collection doubles as a list of things to go earn.
export function describeCardSource(source: CardSource): string {
  switch (source.type) {
    case "level":
      return `Reach Level ${source.level}.`;
    case "heart-string":
      return `Earn the ${KEY_INFO[source.color].name}.`;
    case "event":
      return `Be here for ${source.label}.`;
  }
}
