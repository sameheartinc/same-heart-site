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
//        { type: "new-member" }                 -- joined after the launch
//                                                  date (see
//                                                  NEW_MEMBER_CARD_LAUNCH_MS)
//        { type: "claim-choice" }                -- offered in the pool
//                                                  someone picks from the
//                                                  moment they secure their
//                                                  account (see
//                                                  CLAIM_CHOICE_CARD_IDS)
//   4. Picking the mythic/platinum tier? Nothing grants below
//      PLATINUM_MIN_LEVEL regardless of what `source` says -- see
//      lib/evolution.ts's CARD_UNLOCKABLES. Consider a `realWorldNote`
//      too (see CardDef) if this one's meant to point at something
//      real, not just digital.
//
// Event cards are claimed automatically the first time someone's Hub
// runs its quiet background check inside the window; once claimed they're
// kept forever, and nobody can claim one after `until`. new-member and
// claim-choice cards are the two exceptions to the Level 50 gate below --
// both are rewards for a specific moment (joining, securing the account),
// not something to wait for.

// Cards start at this Level and not before -- see the header above.
export const CARDS_MIN_LEVEL = 50;

// Six tiers, grey to platinum (Rob, Nov 23 2026): "grey which would be
// regular cards, more purple, blue and red cards as being common and
// rare cards, special cards including holographics and gold cards and
// platinum unbreakable editions." Climbing order is common (grey) ->
// uncommon (blue) -> rare (purple) -> epic (red) -> legendary (gold) ->
// mythic (platinum) -- see RARITY_ACCENT for the actual colors and
// PLATINUM_MIN_LEVEL below for the "once people surpass level 100" gate
// on the mythic tier specifically.
export type CardRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";

// A card's physical "finish" -- independent of rarity, so any tier can
// carry it, though in practice holo/foil is reserved for legendary and
// mythic. Purely cosmetic (a CSS treatment on the art), never read by
// isEligible anywhere -- see components/CollectibleCard.tsx once it
// starts rendering this.
export type CardFinish = "holo" | "foil";

export type CardSource =
  | { type: "level"; level: number }
  | { type: "heart-string"; color: KeyColor }
  | { type: "event"; label: string; from: string; until: string }
  // Granted the moment someone's a real member -- the one exception to
  // "nothing below CARDS_MIN_LEVEL" (see lib/evolution.ts's CARD_UNLOCKABLES,
  // which skips the Level 50 gate specifically for this source type). Only
  // for people who joined on or after NEW_MEMBER_CARD_LAUNCH_MS below --
  // Rob, Nov 9 2026: a welcome gift for people joining from here on, not
  // retroactive to everyone already here.
  | { type: "new-member" }
  // The claim-reward pool (Rob, Nov 23 2026): "once they secure the
  // account they get to choose an unlockable card." Eligible once (a)
  // the profile is a claimed, non-anonymous account and (b) its chosen
  // id (profiles.claim_card_choice, written once by
  // app/api/claim/choose-card/route.ts) matches this card's id -- see
  // lib/evolution.ts's isClaimed/claimedCardChoice signals. Like
  // new-member, this skips the Level 50 gate: the whole point is a
  // reward for securing the account, not something to wait for.
  | { type: "claim-choice" };

export interface CardDef {
  id: string;
  name: string;
  rarity: CardRarity;
  // Path under /public, e.g. "/cards/level-10.png". Null until real art
  // exists -- see HOW TO ADD A CARD above.
  image: string | null;
  // Path under /public to a short looping clip (e.g. "/cards/welcome.mp4"),
  // for a card whose art is a rotating/animated piece rather than a still
  // image. Rendered instead of `image` where both exist (see
  // components/CollectibleCard.tsx) -- `image`, if also set, is used as
  // the video's poster frame while it loads.
  video?: string | null;
  source: CardSource;
  // Optional one-line flavor text shown under the name.
  blurb?: string;
  // Cosmetic finish -- see CardFinish above. Omitted/undefined = plain.
  finish?: CardFinish;
  // Platinum/"unbreakable" cards only: a real-world clue, coordinate, or
  // hint tied to an actual object or location Rob has placed -- shown on
  // the card's detail view once that UI exists. Plain text, never
  // parsed or validated here; what it means is entirely Rob's to define
  // per card. Leave unset for every other tier.
  realWorldNote?: string;
}

// Grey, blue, purple, red, gold, platinum -- Rob's own tier colors
// (Nov 23 2026), in climbing order.
export const RARITY_ACCENT: Record<CardRarity, string> = {
  common: "#a29cb0", // grey
  uncommon: "#4a8fe0", // blue
  rare: "#9b6fe0", // purple
  epic: "#e0574a", // red
  legendary: "#e8c27a", // gold
  mythic: "#d9ddE6", // platinum
};

// The mythic/platinum tier never grants below this level, regardless of
// what a card's own `source` says -- a structural backstop for Rob's
// "once people surpass level 100" rule, enforced in lib/evolution.ts.
export const PLATINUM_MIN_LEVEL = 100;

// One card every 50 levels across the whole 1000-level ladder (Level 50
// is also where cards begin; Level 1000 is the capstone -- see IDEAS.md's
// 1000-level notes). Rarity climbs with the level. To change the spacing,
// edit LEVEL_CARD_STEP; ids are "level-<N>" and are permanent once shipped.
const LEVEL_CARD_STEP = 50;
const MAX_LEVEL = 1000;

function levelRarity(level: number): CardRarity {
  if (level <= 100) return "common";
  if (level <= 250) return "uncommon";
  if (level <= 500) return "rare";
  if (level <= 750) return "epic";
  if (level <= 950) return "legendary";
  return "mythic"; // Level 1000 only, at the current 50-level step
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

// Only people who joined on or after this moment are eligible for the
// new-member welcome card -- see CardSource's "new-member" case above.
// Nov 9 2026: the day this shipped. Change this if Rob ever wants it
// backfilled to everyone already here instead -- a single-line edit either
// way, nothing else about the card changes.
export const NEW_MEMBER_CARD_LAUNCH_MS = Date.parse("2026-11-09T00:00:00Z");

// The claim-reward pool (Rob, Nov 23 2026) -- see CardSource's
// "claim-choice" case above. Four cards, one per Path, so securing your
// account doubles as a small identity choice: pick the one that's you,
// not necessarily the Path you were already assigned. Any card in CARDS
// with source.type === "claim-choice" is offered; app/login/page.tsx's
// "choose-card" stage reads this list directly rather than hardcoding
// the four ids, so adding a fifth choice later is just another entry
// here.
export const CLAIM_CHOICE_CARD_IDS = [
  "claim-guardian",
  "claim-seeker",
  "claim-weaver",
  "claim-flame",
] as const;

// Starter catalog: the welcome card, the claim-choice pool, the level
// cards, and one card per Heart String. Names and rarities are first
// cuts meant to be renamed and re-rarified once the real art arrives;
// only `id` is permanent.
export const CARDS: CardDef[] = [
  {
    id: "welcome",
    name: "First Light",
    rarity: "uncommon",
    image: "/cards/welcome.png",
    video: "/cards/welcome.mp4",
    source: { type: "new-member" },
    blurb: "The first card every new arrival picks up, the moment they join.",
  },

  {
    id: "claim-guardian",
    name: "Guardian's Watch",
    rarity: "rare",
    image: null,
    source: { type: "claim-choice" },
    blurb: "Chosen, not just assigned -- the one who stands at the door.",
  },
  {
    id: "claim-seeker",
    name: "Seeker's Trailhead",
    rarity: "rare",
    image: null,
    source: { type: "claim-choice" },
    blurb: "Chosen, not just assigned -- the one who takes the unmarked trail.",
  },
  {
    id: "claim-weaver",
    name: "Weaver's Loom",
    rarity: "rare",
    image: null,
    source: { type: "claim-choice" },
    blurb: "Chosen, not just assigned -- the one who turns thread into something that holds.",
  },
  {
    id: "claim-flame",
    name: "Flame's Ember",
    rarity: "rare",
    image: null,
    source: { type: "claim-choice" },
    blurb: "Chosen, not just assigned -- the one who keeps the coal glowing.",
  },

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
    case "new-member":
      return "Join Same Heart.";
    case "claim-choice":
      return "Secure your account to choose this.";
  }
}
