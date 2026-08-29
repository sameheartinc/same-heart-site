// Same Heart -- the return-engagement streak.
//
// The idea (from IDEAS.md): give people a real, honest reason to keep
// coming back, on top of the Standing/XP system -- not a dark-pattern
// notification, just something small that visibly grows the longer
// someone keeps showing up. This file is the pure logic; app/hub/page.tsx
// calls it once per Hub load and persists the result to `profiles`.
//
// Streak days are calendar dates in UTC for simplicity (no per-user
// timezone stored yet) -- in practice that means the day rolls over in
// the evening for anyone in North America, not at their local midnight.
// Good enough for v1; revisit if it ever feels off in practice.

export interface StreakState {
  current_streak: number;
  longest_streak: number;
  last_visit_date: string | null; // "YYYY-MM-DD"
}

export interface StreakMilestone {
  day: number;
  bonusXp: number;
  label: string;
}

export interface CheckInResult {
  changed: boolean; // false = already checked in today, nothing to save
  streak: StreakState;
  xpAwarded: number;
  milestone: StreakMilestone | null; // set only on the visit that just crossed it
}

// One-time bonuses on top of the flat daily amount -- deliberately not a
// smooth curve, so hitting one actually feels like hitting something.
export const MILESTONES: StreakMilestone[] = [
  { day: 3, bonusXp: 12, label: "Momentum" },
  { day: 7, bonusXp: 25, label: "One full cycle" },
  { day: 14, bonusXp: 40, label: "Locked in" },
  { day: 30, bonusXp: 75, label: "Same Heart, for real" },
  { day: 60, bonusXp: 150, label: "Two months running" },
  { day: 100, bonusXp: 300, label: "A hundred days" },
];

export const BASE_CHECKIN_XP = 8;

function toUTCDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isConsecutiveDay(previousDate: string, today: string): boolean {
  const prev = new Date(previousDate + "T00:00:00Z").getTime();
  const cur = new Date(today + "T00:00:00Z").getTime();
  return Math.round((cur - prev) / 86400000) === 1;
}

export function computeCheckIn(state: StreakState, now: Date = new Date()): CheckInResult {
  const today = toUTCDateString(now);

  if (state.last_visit_date === today) {
    // Already counted today -- repeated Hub loads in the same day (a
    // refresh, tabbing back in) must not keep incrementing the streak.
    return { changed: false, streak: state, xpAwarded: 0, milestone: null };
  }

  const continuing = state.last_visit_date
    ? isConsecutiveDay(state.last_visit_date, today)
    : false;
  const newStreak = continuing ? state.current_streak + 1 : 1;
  const newLongest = Math.max(state.longest_streak, newStreak);
  const milestone = MILESTONES.find((m) => m.day === newStreak) ?? null;

  return {
    changed: true,
    streak: {
      current_streak: newStreak,
      longest_streak: newLongest,
      last_visit_date: today,
    },
    xpAwarded: BASE_CHECKIN_XP + (milestone?.bonusXp ?? 0),
    milestone,
  };
}

// Purely cosmetic tiering for the Hub's streak widget -- how "lit up" it
// looks scales with how long the streak has run, independent of XP/Standing.
export function streakVisualTier(streak: number): { label: string; glow: 0 | 1 | 2 | 3 | 4 } {
  if (streak >= 30) return { label: "Steady flame", glow: 4 };
  if (streak >= 14) return { label: "Building heat", glow: 3 };
  if (streak >= 7) return { label: "Warming up", glow: 2 };
  if (streak >= 3) return { label: "Catching on", glow: 1 };
  return { label: "Just arrived", glow: 0 };
}
