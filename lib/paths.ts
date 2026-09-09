// The four paths people quietly sort into as they move through the site.
// Nobody picks a path from a menu -- it's read from a short run of small,
// sensory picks (a colour, a texture, three quick questions, an inkblot)
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

// -- Sensory pre-questions (Sep 6 2026) --------------------------------
// Rob wanted the very first touch to feel less like a form and more like
// a psychoactive drift: a colour picked from a field of floating orbs,
// then a texture that comes with its own sound, before the three text
// questions above ever appear (rendered as coloured bubbles once this
// runs -- see components/PathOnboarding.tsx), then an inkblot to close
// it out. Every one of these is a real, if gentle, signal into the same
// four axes everything else here scores against -- see scoreOnboarding.

export interface OrbColorOption {
  id: string;
  hex: string;
  glow: string;
  weights: Partial<AxisScores>;
}

// Four "pure" colours mirror each path's own accent 1:1 (so a clean
// pick reads as a clean lean); four "between" colours blend two
// neighbours, so the wheel feels continuous rather than four buckets in
// a trenchcoat.
export const ORB_COLORS: OrbColorOption[] = [
  { id: "gold", hex: "#c9a15a", glow: "rgba(201,161,90,0.6)", weights: { guardian: 2 } },
  { id: "azure", hex: "#7c9fd9", glow: "rgba(124,159,217,0.6)", weights: { seeker: 2 } },
  { id: "rose", hex: "#c9576a", glow: "rgba(201,87,106,0.6)", weights: { weaver: 2 } },
  { id: "ember", hex: "#e0703a", glow: "rgba(224,112,58,0.6)", weights: { flame: 2 } },
  { id: "violet", hex: "#9b7ec9", glow: "rgba(155,126,201,0.6)", weights: { guardian: 1, seeker: 1 } },
  { id: "teal", hex: "#54b0a4", glow: "rgba(84,176,164,0.6)", weights: { seeker: 1, weaver: 1 } },
  { id: "coral", hex: "#d9808c", glow: "rgba(217,128,140,0.6)", weights: { weaver: 1, flame: 1 } },
  { id: "amber", hex: "#d99149", glow: "rgba(217,145,73,0.6)", weights: { flame: 1, guardian: 1 } },
];

export type TextureId = "smooth" | "rippled" | "woven" | "jagged";

export interface TextureOption {
  id: TextureId;
  label: string;
  soundLabel: string;
  weights: Partial<AxisScores>;
}

// Each texture is paired with a distinct tone (see lib/orbTones.ts) so
// the pick is heard as much as it's seen.
export const TEXTURES: TextureOption[] = [
  { id: "smooth", label: "Smooth", soundLabel: "a low, steady hum", weights: { guardian: 2 } },
  { id: "rippled", label: "Rippled", soundLabel: "a bright, curious chime", weights: { seeker: 2 } },
  { id: "woven", label: "Woven", soundLabel: "a warm hum that answers back", weights: { weaver: 2 } },
  { id: "jagged", label: "Jagged", soundLabel: "a sharp crackle of static", weights: { flame: 2 } },
];

export interface InkblotOption {
  id: string;
  weights: Partial<AxisScores>;
  radii: number[];
}

// Hand-set, not randomly generated -- keeps the shapes reliably
// non-self-intersecting and lets the same four always render the same
// way. Each blot correlates to one path, the same way a "pure" orb
// colour does.
export const INKBLOTS: InkblotOption[] = [
  { id: "a", weights: { guardian: 2 }, radii: [58, 44, 66, 40, 62, 46, 68, 42, 58] },
  { id: "b", weights: { seeker: 2 }, radii: [48, 68, 36, 72, 40, 64, 34, 70, 46] },
  { id: "c", weights: { weaver: 2 }, radii: [54, 38, 60, 46, 56, 36, 64, 44, 52] },
  { id: "d", weights: { flame: 2 }, radii: [68, 30, 76, 34, 60, 26, 80, 32, 66] },
];

// Builds a closed, roughly mirror-symmetric blob path from a list of
// radii (distance from the vertical centre line at evenly spaced
// heights) -- a real inkblot is a fold-and-press shape, so left and
// right are mirrors of the same points by construction here rather
// than independently randomized.
export function buildInkblotPath(radii: number[], size = 200): string {
  const cx = size / 2;
  const top = size * 0.1;
  const bottom = size * 0.9;
  const n = radii.length;
  const step = n > 1 ? (bottom - top) / (n - 1) : 0;

  const right: Array<[number, number]> = radii.map((r, i) => [cx + r, top + i * step]);
  const left: Array<[number, number]> = [...radii]
    .reverse()
    .map((r, i) => [cx - r, bottom - i * step]);
  const points = [...right, ...left];

  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)} `;
  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    const midX = (curr[0] + next[0]) / 2;
    const midY = (curr[1] + next[1]) / 2;
    d += `Q ${curr[0].toFixed(1)} ${curr[1].toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)} `;
  }
  return d + "Z";
}

// -----------------------------------------------------------------------

// Every pick along the way -- colour, texture, the three questions, the
// inkblot -- feeds this the same way: a Partial<AxisScores> worth up to
// 2 points on one or two axes. The max per axis is derived from however
// many picks were actually passed in, so this scales cleanly whether
// it's fed 3 answers or 6.
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
  const maxPerAxis = Math.max(1, answers.length * 2);
  for (const key of PATH_ORDER) {
    scores[key] = clamp01(scores[key] / maxPerAxis);
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
