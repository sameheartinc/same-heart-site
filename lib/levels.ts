// Same Heart -- Levels, and the scale of the whole XP economy.
//
// Rob (Sep 21, 2026): "it's gotta be really hard to max out... it should
// take people years to build an insane profile and would never just reach
// level 1000 because each level is harder and harder to attain -- as you
// increase in levels the amount of XP needed for the next level
// increases." This replaces the old prime-number levels (Level N = the
// Nth prime), whose gaps grew only from about 2 to 7 XP across all 1,000
// levels -- effectively a flat ramp -- and whose Level 1000 sat at just
// 7,919 XP, about a month of the old maximum daily earnings.
//
// THE CURVE
//   XP needed to reach Level L = 3 * L^2
// so the XP cost of each *next* level is 3 * (2L + 1): it rises with
// every single level, forever. Level is a pure function of XP -- no
// stored column, nothing to migrate when it's retuned -- and XP itself is
// permanent (see lib/xpActions.ts), so a level, once reached, is never
// lost.
//
//   Level     XP to reach    Cost of the next level
//        10          300             63
//        25        1,875            153
//        50        7,500            303   <- Cards begin (lib/cards.ts)
//       100       30,000            603
//       250      187,500          1,503
//       500      750,000          3,003
//      1000    3,000,000              --   <- the cap (Level 999 -> 1000 costs 5,997)
//
// THE ECONOMY IT'S TUNED AGAINST
// Every XP source was scaled up by XP_SCALE at the same moment, keeping
// their relative sizes exactly as they were. The theoretical daily
// maximum is then about 1,900 XP (Exchange 1,600 + Commons 150 + check-in
// 64 + Heart Tap up to 112), which would still need roughly 4 years of
// perfect, maxed days to reach Level 1000. A realistically strong day is
// a few hundred XP, which is a decade or more. To retune: change
// LEVEL_XP_COEFFICIENT (the curve) and/or XP_SCALE (the sources), never
// one without checking the other.
//
// This file replaced the old prime-number levels. Existing members' XP was carried
// over so nobody's Level changed -- see the "xp_rescale_v2" migration in
// supabase/schema.sql.

export const MAX_LEVEL = 1000;
export const LEVEL_XP_COEFFICIENT = 3;

// Multiplier applied to every XP source when the curve was introduced.
// Sources reference it (e.g. `3 * XP_SCALE` for a reply is 24) so the
// whole economy can be read against one number.
export const XP_SCALE = 8;

export function xpForLevel(level: number): number {
  const clamped = Math.max(0, Math.min(MAX_LEVEL, Math.floor(level)));
  return LEVEL_XP_COEFFICIENT * clamped * clamped;
}

export function getLevel(xp: number): number {
  if (!Number.isFinite(xp) || xp < LEVEL_XP_COEFFICIENT) return 0;
  let level = Math.min(MAX_LEVEL, Math.floor(Math.sqrt(xp / LEVEL_XP_COEFFICIENT)));
  // Guard against floating-point drift right at a threshold.
  while (level < MAX_LEVEL && xpForLevel(level + 1) <= xp) level++;
  while (level > 0 && xpForLevel(level) > xp) level--;
  return level;
}

// The XP total at which the *next* level begins, or null at the cap.
export function nextLevelThreshold(xp: number): number | null {
  const level = getLevel(xp);
  return level >= MAX_LEVEL ? null : xpForLevel(level + 1);
}
