// Same Heart -- Standing tiers.
//
// Standing is meant to be the one thing merch money can never buy (see
// the Field Guide: "Money can buy expression -- a skin, a piece of
// merch -- never standing"). Up until now that was aspirational copy --
// the `standing` column existed but nothing ever actually moved it past
// its default. This file is what makes it real: Standing is purely a
// function of earned XP, and XP now comes from actually showing up (see
// lib/streak.ts), not from anything that can be purchased.
//
// Tiers are loosely tuned so a genuinely consistent daily visitor
// reaches Signal in under two weeks, Beacon around a month in, and the
// top tier only after real, sustained return visits -- rounds numbers,
// not a precise formula. Adjust freely; nothing else needs to change
// when these thresholds move.

export interface StandingTier {
  name: string;
  minXp: number;
}

export const STANDING_TIERS: StandingTier[] = [
  { name: "Listener", minXp: 0 },
  { name: "Signal", minXp: 80 },
  { name: "Beacon", minXp: 250 },
  { name: "Constant", minXp: 600 },
  { name: "Same Heart", minXp: 1200 },
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
