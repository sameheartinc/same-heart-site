import { xpForLevel } from "@/lib/levels";

// Same Heart -- Standing tiers.
//
// Standing is meant to be the one thing merch money can never buy (see
// the Field Guide: "Money can buy expression -- a skin, a piece of
// merch -- never standing"). Up until now that was aspirational copy --
// the `standing` column existed but nothing ever actually moved it past
// its default. This file is what makes it real: Standing is purely a
// function of earned XP, and XP now comes from actually showing up (see
// lib/streak.ts), not from anything that can be purchased.

export interface StandingTier {
  name: string;
  minXp: number;
}

// Each tier begins at a *Level*, not a raw XP number, so it stays put
// relative to progression whenever the XP curve or economy is retuned
// (see lib/levels.ts). These are the same Level crossings the tiers have
// always had -- Signal at Level 22, Beacon 53, Constant 109, Same Heart
// 196 (the old XP marks of 80/250/600/1200 were the 22nd/53rd/109th/196th
// primes) -- expressed on the new curve as 1,452 / 8,427 / 35,643 /
// 115,248 XP.
export const STANDING_TIER_LEVELS = { Signal: 22, Beacon: 53, Constant: 109, "Same Heart": 196 };

export const STANDING_TIERS: StandingTier[] = [
  { name: "Listener", minXp: 0 },
  { name: "Signal", minXp: xpForLevel(STANDING_TIER_LEVELS.Signal) },
  { name: "Beacon", minXp: xpForLevel(STANDING_TIER_LEVELS.Beacon) },
  { name: "Constant", minXp: xpForLevel(STANDING_TIER_LEVELS.Constant) },
  { name: "Same Heart", minXp: xpForLevel(STANDING_TIER_LEVELS["Same Heart"]) },
];

export function getStanding(xp: number): string {
  let current = STANDING_TIERS[0].name;
  for (const tier of STANDING_TIERS) {
    if (xp >= tier.minXp) current = tier.name;
  }
  return current;
}

// The tier immediately above the given XP total, if any -- used to show
// "X XP to Beacon" style progress rather than just a bare number.
export function nextStandingTier(xp: number): StandingTier | null {
  return STANDING_TIERS.find((tier) => xp < tier.minXp) ?? null;
}
