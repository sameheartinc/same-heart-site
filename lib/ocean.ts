// The Big Five (OCEAN) personality trait model -- Openness,
// Conscientiousness, Extraversion, Agreeableness, and a fifth trait
// usually called Neuroticism (framed here as "Emotional Intensity" for
// tone, same underlying axis). This is public-domain psychological
// science with decades of freely published literature behind it (McCrae
// & Costa, the "Five Factor Model"), not a licensed test -- unlike a
// commercial instrument's proprietary scoring key, the five-trait
// structure itself is safe to build an original implementation on top
// of. See IDEAS.md, Sep 18 2026, for why that distinction mattered here.
//
// This is deliberately NOT a second quiz. Rob's direction (same date,
// same entry) was "branches within branches" -- sub-scores nested
// *underneath* the existing Path, not a parallel system asking someone
// to answer more questions. So this reads the AxisScores a person
// already has (see lib/paths.ts's scoreOnboarding/combineScores, stored
// as profiles.path_signals) and blends them through a fixed, original
// weighting matrix below into five OCEAN sub-scores "within" their Path.
// A pure function of data that's already been collected -- same posture
// as lib/levels.ts turning XP into a level, no new signal, no new
// migration.

import { AxisScores, PathKey, PATH_ORDER } from "./paths";

export type OceanTrait =
  | "openness"
  | "conscientiousness"
  | "extraversion"
  | "agreeableness"
  | "neuroticism";

export const OCEAN_ORDER: OceanTrait[] = [
  "openness",
  "conscientiousness",
  "extraversion",
  "agreeableness",
  "neuroticism",
];

export type OceanScores = Record<OceanTrait, number>;

export interface OceanTraitDef {
  key: OceanTrait;
  name: string;
  lowLabel: string;
  highLabel: string;
  blurb: string;
}

export const OCEAN_TRAITS: Record<OceanTrait, OceanTraitDef> = {
  openness: {
    key: "openness",
    name: "Openness",
    lowLabel: "Consistent",
    highLabel: "Curious",
    blurb: "How much you're drawn to the new and unfamiliar over the tried and settled.",
  },
  conscientiousness: {
    key: "conscientiousness",
    name: "Conscientiousness",
    lowLabel: "Spontaneous",
    highLabel: "Deliberate",
    blurb: "How much you plan and follow through versus improvise as you go.",
  },
  extraversion: {
    key: "extraversion",
    name: "Extraversion",
    lowLabel: "Reserved",
    highLabel: "Outgoing",
    blurb: "Where you draw your energy from -- the room around you, or the quiet apart from it.",
  },
  agreeableness: {
    key: "agreeableness",
    name: "Agreeableness",
    lowLabel: "Direct",
    highLabel: "Accommodating",
    blurb: "How readily you bend toward others versus hold your own line.",
  },
  neuroticism: {
    key: "neuroticism",
    name: "Emotional Intensity",
    lowLabel: "Steady",
    highLabel: "Reactive",
    blurb: "How much everyday ups and downs actually move you.",
  },
};

// Each Path's own tendency across the five traits -- not a claim that
// "every Guardian is exactly this," just the fixed signature that
// computeOceanScores blends against someone's actual axis scores below.
// Hand-set once, from the same character sketches already in each
// PathDef's `essence` (lib/paths.ts) -- e.g. Guardian's "grounded and
// protective" reads as high Conscientiousness/Agreeableness, low
// Neuroticism; Flame's "passionate and expressive" reads as high
// Extraversion/Openness, lower Conscientiousness, higher emotional
// intensity.
const PATH_TO_OCEAN: Record<PathKey, OceanScores> = {
  guardian: {
    openness: 0.35,
    conscientiousness: 0.85,
    extraversion: 0.45,
    agreeableness: 0.75,
    neuroticism: 0.3,
  },
  seeker: {
    openness: 0.9,
    conscientiousness: 0.4,
    extraversion: 0.55,
    agreeableness: 0.5,
    neuroticism: 0.45,
  },
  weaver: {
    openness: 0.55,
    conscientiousness: 0.55,
    extraversion: 0.65,
    agreeableness: 0.9,
    neuroticism: 0.4,
  },
  flame: {
    openness: 0.7,
    conscientiousness: 0.35,
    extraversion: 0.9,
    agreeableness: 0.45,
    neuroticism: 0.6,
  },
};

// Blends the four Path axis scores (already 0-1 each, from
// scoreOnboarding/combineScores) into five OCEAN scores, weighting each
// Path's own signature by how strongly that axis actually showed up in
// this person's picks. Someone who leans hard into one Path reads close
// to that Path's own signature; someone split across two or three Paths
// gets a genuine blend, not just their top Path's numbers copied over.
export function computeOceanScores(axisScores: AxisScores): OceanScores {
  const totalWeight = PATH_ORDER.reduce((sum, key) => sum + axisScores[key], 0);

  const blank: OceanScores = {
    openness: 0,
    conscientiousness: 0,
    extraversion: 0,
    agreeableness: 0,
    neuroticism: 0,
  };

  if (totalWeight <= 0) {
    // No real signal to blend (shouldn't normally happen) -- a neutral
    // midpoint on every trait beats dividing by zero.
    for (const trait of OCEAN_ORDER) blank[trait] = 0.5;
    return blank;
  }

  for (const pathKey of PATH_ORDER) {
    const weight = axisScores[pathKey] / totalWeight;
    const signature = PATH_TO_OCEAN[pathKey];
    for (const trait of OCEAN_ORDER) {
      blank[trait] += signature[trait] * weight;
    }
  }

  for (const trait of OCEAN_ORDER) {
    blank[trait] = clamp01(blank[trait]);
  }

  return blank;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// path_signals comes back from Supabase as `unknown` (it's a jsonb
// column) -- this checks it actually has every PathKey as a finite
// number before computeOceanScores ever touches it, so a null/empty/
// stale value (an old profile from before path_signals existed, or the
// column's own '{}' default) just quietly skips the nested OCEAN panel
// instead of rendering NaN everywhere.
export function isAxisScores(value: unknown): value is AxisScores {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return PATH_ORDER.every((key) => typeof record[key] === "number" && Number.isFinite(record[key]));
}
