import { XP_SCALE } from "@/lib/levels";

// Same Heart -- the XP action registry and progression math.
//
// Rob's spec (Sep 20, 2026, "Community XP, Reputation & Unlock System"):
// reward meaningful participation -- discovery, contribution, discussion,
// building -- not screen time; XP is permanent, Momentum/Boost/Streaks are
// temporary and decay; the whole economy must be configurable so it can
// be retuned without rebuilding the platform.
//
// This file is that configuration, plus the pure math built on it. It
// holds no database code and is safe to import anywhere; the one place
// XP is actually granted is lib/xpEngine.ts (server only), which reads
// these rules, verifies the action really happened, and writes the
// result. To retune the economy, edit numbers here.
//
// HOW TO ADD AN ACTION
//   1. Add an entry to ACTIONS below.
//   2. Add a case for its `key` in verifyAction() in lib/xpEngine.ts --
//      an action is only ever paid out after the server has confirmed the
//      real row it points at (never on the client's say-so), which is
//      what makes "click a button to farm XP" impossible.
//   3. Call POST /api/xp/award with { action, targetId } from wherever it
//      happens (see lib/progression.ts's awardAction).

export type XpCategory = "discover" | "contribute" | "engage" | "build" | "community";

export interface XpAction {
  key: string;
  label: string;
  category: XpCategory;
  baseXp: number;
  enabled: boolean;
  // Minimum seconds between two awards of this same action to one person.
  cooldownSeconds?: number;
  // Actions sharing a group draw from one daily allowance (CAP_GROUPS).
  capGroup?: string;
  // Multiplier for the Nth award of this action in a UTC day: index 0 is
  // the first, and the last value repeats forever after. Leave unset for
  // no diminishing returns.
  diminishing?: number[];
  // Text written to the person's own log.
  logDescription: string;
  // Log category the award is filed under (see log_entries.category).
  logCategory: string;
}

// A daily ceiling on *base* XP (before boosts), so a Boost can never be
// used to blow through a cap -- it multiplies what the cap allowed.
export const CAP_GROUPS: Record<string, { dailyBaseXp: number }> = {
  commons: { dailyBaseXp: 15 * XP_SCALE },
  media: { dailyBaseXp: 6 * XP_SCALE * 3 }, // up to 3 rewarded media drops a day
};

// Amounts are written as (old amount) * XP_SCALE (lib/levels.ts), so the
// relative size of every source is exactly what it was before the Sep 21,
// 2026 rescale: replying is 24, starting a thread 40, drawing on one
// shared 120/day allowance. Levels cost 3 * L^2 XP, so these are tuned
// against that curve -- retune the two together (see lib/levels.ts).
export const ACTIONS: Record<string, XpAction> = {
  start_thread: {
    key: "start_thread",
    label: "Started a discussion or question",
    category: "contribute",
    baseXp: 5 * XP_SCALE,
    enabled: true,
    cooldownSeconds: 30,
    capGroup: "commons",
    logDescription: "Started a discussion in the Commons.",
    logCategory: "commons",
  },
  // "Uploading media" / "Creating artwork" from Rob's Contribute list
  // (Sep 20, 2026 spec) -- rewards a thread that genuinely carries an
  // image or a real, embeddable video link, verified server-side (see
  // lib/xpEngine.ts). Deliberately does NOT touch who's allowed to
  // attach one -- that's still Voice Tier 1 for images
  // (app/commons/c/[slug]/CommunityDetail.tsx); this only rewards it once
  // someone can. Its own cap group, separate from the Commons 120/day
  // allowance, since dropping real media is a distinct, valuable thing
  // from posting text.
  share_media: {
    key: "share_media",
    label: "Shared a photo or video",
    category: "contribute",
    baseXp: 6 * XP_SCALE,
    enabled: true,
    cooldownSeconds: 30,
    capGroup: "media",
    logDescription: "Shared a photo or video in the Commons.",
    logCategory: "commons",
  },
  reply: {
    key: "reply",
    label: "Replied in a discussion",
    category: "engage",
    baseXp: 3 * XP_SCALE,
    enabled: true,
    cooldownSeconds: 15,
    capGroup: "commons",
    logDescription: "Replied in the Commons.",
    logCategory: "commons",
  },
};

export function getAction(key: string): XpAction | null {
  return ACTIONS[key] ?? null;
}

// -- Quality gates (anti-gaming) ---------------------------------------
// Below these, an action is real but not meaningful, and earns nothing.

export const MIN_THREAD_TITLE_CHARS = 8;
export const MIN_THREAD_BODY_CHARS = 40;
export const MIN_REPLY_CHARS = 20;

// Lowercase, collapse whitespace, strip punctuation -- so "Thanks!!" and
// "thanks" count as the same words when looking for repeated posts.
export function normalizeForDuplicateCheck(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// -- Diminishing returns ------------------------------------------------

export function diminishingMultiplier(action: XpAction, awardsSoFarToday: number): number {
  const table = action.diminishing;
  if (!table || table.length === 0) return 1;
  return table[Math.min(awardsSoFarToday, table.length - 1)];
}

// -- Momentum ------------------------------------------------------------
// Momentum is "how actively you're participating right now": a number
// from 0-100 computed fresh from recent activity every time it's asked
// for, never stored. That is the whole decay mechanism -- old activity
// simply counts for less each day (a 3-day half-life) -- so it can fall
// when someone goes quiet without a job that "removes" anything, and it
// physically cannot touch permanent XP, cards, or history.

export const MOMENTUM_HALF_LIFE_DAYS = 3;
// How much weighted recent activity it takes to reach ~63% Momentum;
// twice that reaches ~86%. The curve flattens on purpose, so a burst of
// spam can't push it toward 100.
export const MOMENTUM_SCALE = 8;
export const MOMENTUM_LOOKBACK_DAYS = 14;

// How much a logged XP award counts toward Momentum, by its log
// category. Showing up (check-in, "system") counts a little; real Commons
// and Exchange contributions count fully or more; one-time grants like
// keys and unlocks ("personal") count for nothing.
export const MOMENTUM_WEIGHT_BY_LOG_CATEGORY: Record<string, number> = {
  system: 0.25,
  commons: 1,
  humanitarian: 1.5,
};

export interface WeightedEvent {
  atMs: number;
  weight: number;
}

export function momentumFromEvents(events: WeightedEvent[], nowMs: number): number {
  const halfLifeMs = MOMENTUM_HALF_LIFE_DAYS * 24 * 60 * 60 * 1000;
  let score = 0;
  for (const e of events) {
    const ageMs = Math.max(0, nowMs - e.atMs);
    score += e.weight * Math.pow(0.5, ageMs / halfLifeMs);
  }
  return Math.round(100 * (1 - Math.exp(-score / MOMENTUM_SCALE)));
}

// -- Boost ----------------------------------------------------------------
// A boost is "your activity is creating momentum," not a purchase: it is
// a modest bonus on XP earned, capped so it can never dominate. Rob's
// range: 10-25%. Three sources stack under one cap -- live Momentum,
// the current streak, and temporary boosts granted by cards, events and
// challenges (profile_boosts rows, each with its own expiry).

export const BOOST_CAP_PERCENT = 25;
export const MOMENTUM_BOOST_MAX_PERCENT = 15;
export const MOMENTUM_BOOST_FLOOR = 20; // no boost below this much Momentum
export const STREAK_BOOST_MAX_PERCENT = 5; // +1% per streak day

export function momentumBoostPercent(momentum: number): number {
  if (momentum <= MOMENTUM_BOOST_FLOOR) return 0;
  const fraction = (momentum - MOMENTUM_BOOST_FLOOR) / (100 - MOMENTUM_BOOST_FLOOR);
  return Math.round(MOMENTUM_BOOST_MAX_PERCENT * Math.min(1, fraction));
}

export function streakBoostPercent(streakDays: number): number {
  return Math.max(0, Math.min(STREAK_BOOST_MAX_PERCENT, Math.floor(streakDays)));
}

export interface BoostPart {
  source: string;
  label: string;
  percent: number;
}

export function combineBoost(parts: BoostPart[]): number {
  const sum = parts.reduce((total, p) => total + Math.max(0, p.percent), 0);
  return Math.min(BOOST_CAP_PERCENT, sum);
}

export function applyBoost(xp: number, percent: number): number {
  return Math.round(xp * (1 + percent / 100));
}

// -- Reputation -----------------------------------------------------------
// XP is how far you've come; Reputation is how useful your contributions
// have been *to other people*. It's computed only from what other people
// did (self-reactions and replying to yourself never count), and any one
// person can contribute at most REPUTATION_PER_PERSON_CAP points in
// total -- so two accounts trading reactions can't manufacture it, and a
// single fan can't carry someone. Heartache reactions don't subtract:
// a downvote pile-on shouldn't be able to erase a person's standing;
// quality problems belong to moderation.

export const REPUTATION_POINTS = {
  heartfeltReaction: 1,
  replyToYourThread: 2,
};
export const REPUTATION_PER_PERSON_CAP = 5;

export interface ReputationSignal {
  fromProfileId: string;
  points: number;
}

export function reputationFromSignals(signals: ReputationSignal[], viewerProfileId: string): number {
  const byPerson = new Map<string, number>();
  for (const s of signals) {
    if (s.fromProfileId === viewerProfileId) continue;
    byPerson.set(s.fromProfileId, (byPerson.get(s.fromProfileId) ?? 0) + s.points);
  }
  let total = 0;
  for (const points of byPerson.values()) total += Math.min(REPUTATION_PER_PERSON_CAP, points);
  return total;
}
