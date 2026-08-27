// The four paths people quietly sort into as they move through the site.
// Nobody picks a path from a menu -- it's read from three small answers
// plus how their cursor actually behaves, then blended together. This is
// separate from Star Day (lib/starDay.ts): Path is a quick personality
// read assigned at arrival; Star Day is the deeper, permanent signal from
// a birth date, captured right after.

export type PathKey = "guardian" | "seeker" | "weaver" | "flame";

export interface PathDef {
  key: PathKey;
  name: string;
  tagline: string;
  essence: string;
  accent: string;
  accentSoft: string;
  motion: "steady" | "roaming" | "weaving" | "flicker";
}

export const PATH_ORDER: PathKey[] = ["guardian", "seeker", "weaver", "flame"];

export const PATHS: Record<PathKey, PathDef> = {
  guardian: {
    key: "guardian",
    name: "The Guardian",
    tagline: "Steady is its own kind of brave.",
    essence:
      "Grounded and protective -- the calm at the center of the room, the one people check in with.",
    accent: "#c9a15a",
    accentSoft: "rgba(201,161,90,0.16)",
    motion: "steady",
  },
  seeker: {
    key: "seeker",
    name: "The Seeker",
    tagline: "Still curious about everything.",
    essence:
      "Restless and exploratory -- always circling toward whatever hasn't been explained yet.",
    accent: "#7c9fd9",
    accentSoft: "rgba(124,159,217,0.16)",
    motion: "roaming",
  },
  weaver: {
    key: "weaver",
    name: "The Weaver",
    tagline: "It finds the thread between people.",
    essence:
      "Connective and empathetic -- drawn to whoever is standing alone, good at tying strangers together.",
    accent: "#c9576a",
    accentSoft: "rgba(201,87,106,0.16)",
    motion: "weaving",
  },
  flame: {
    key: "flame",
    name: "The Flame",
    tagline: "It shows up loud because it means it.",
    essence:
      "Passionate and expressive -- the spark that starts the room talking.",
    accent: "#e0703a",
    accentSoft: "rgba(224,112,58,0.16)",
    motion: "flicker",
  },
};

export type AxisScores = Record<PathKey, number>;

export function blankAxisScores(): AxisScores {
  return { guardian: 0, seeker: 0, weaver: 0, flame: 0 };
}

export interface OnboardingOption {
  label: string;
  weights: Partial<AxisScores>;
}

export interface OnboardingQuestion {
  id: string;
  prompt: string;
  options: OnboardingOption[];
}

// Each answer nudges one or two axes. Three questions, one pick each --
// deliberately short, so it reads as a mood check, not a personality quiz.
export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: "room",
    prompt: "You walk into a room full of strangers. First instinct:",
    options: [
      { label: "Find whoever's standing alone", weights: { weaver: 2 } },
      { label: "Clock every exit and detail", weights: { guardian: 2 } },
      { label: "Head for whatever looks unfamiliar", weights: { seeker: 2 } },
      { label: "Say something loud enough to turn heads", weights: { flame: 2 } },
    ],
  },
  {
    id: "hard-day",
    prompt: "On a hard day, what actually helps?",
    options: [
      { label: "A plan, and something to fix", weights: { guardian: 2 } },
      { label: "Getting far away for a while", weights: { seeker: 2 } },
      { label: "Calling the one person who gets it", weights: { weaver: 2 } },
      { label: "Turning the volume up on something", weights: { flame: 2 } },
    ],
  },
  {
    id: "give",
    prompt: "If you could hand someone one thing today, it'd be:",
    options: [
      { label: "Reassurance that they're safe", weights: { guardian: 2 } },
      { label: "A door they hadn't noticed", weights: { seeker: 2 } },
      { label: "An introduction to someone they need", weights: { weaver: 2 } },
      { label: "The nerve to actually try it", weights: { flame: 2 } },
    ],
  },
];

const MAX_ONBOARDING_PER_AXIS = ONBOARDING_QUESTIONS.length * 2;

export function scoreOnboarding(
  answers: Array<Partial<AxisScores> | undefined>
): AxisScores {
  const scores = blankAxisScores();
  for (const answer of answers) {
    if (!answer) continue;
    for (const key of PATH_ORDER) {
      scores[key] += answer[key] ?? 0;
    }
  }
  for (const key of PATH_ORDER) {
    scores[key] = clamp01(scores[key] / MAX_ONBOARDING_PER_AXIS);
  }
  return scores;
}

export function combineScores(
  onboarding: AxisScores,
  cursor: AxisScores,
  onboardingWeight = 0.5
): AxisScores {
  const combined = blankAxisScores();
  for (const key of PATH_ORDER) {
    combined[key] =
      onboarding[key] * onboardingWeight + cursor[key] * (1 - onboardingWeight);
  }
  return combined;
}

export function pickPath(scores: AxisScores): { path: PathKey; confidence: number } {
  const entries = PATH_ORDER.map((key) => [key, scores[key]] as const);
  entries.sort((a, b) => b[1] - a[1]);
  const [topKey, topVal] = entries[0];
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  const share = total > 0 ? topVal / total : 1 / PATH_ORDER.length;
  // Floor it so a thin lead never reads as near-zero confidence.
  const confidence = clamp01(0.25 + share * 0.75);
  return { path: topKey, confidence };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
