// Same Heart -- Practices and Ripple Points (Option A of the two
// 1000-level designs -- see IDEAS.md's "1000-level system" entry and the
// delivered spreadsheet for the full research and both options). This
// file is the whole engine: every Level from here on grants Ripple
// Points, and every Ripple Point gets invested into one of four
// Practices -- Voice, Kinship, Guidance, and Stewardship. Whichever
// Practice a profile has invested the most into is its "leading"
// Practice.
//
// Naming note: renamed from the design doc's "Signal Path" / "Presence"
// language, confirmed with Rob (Sep 2, 2026), to avoid colliding with
// things this site already has -- a "Path" (lib/paths.ts's guardian/
// seeker/weaver/flame, a completely different concept), a "Signal" (Deep
// Signals + the Signal Standing tier), and a "Presence" (touchPresence --
// who's online right now). Practices / Kinship keep all four nameable in
// the same sentence without colliding.
//
// Same trust model as Keys and Evolution: practice_points is NOT
// client-writable (see the column-level revoke in supabase/schema.sql) --
// only /api/practices/invest, running as the service role, may change
// it, after checking the real math itself rather than trusting a client
// claim.
//
// Only Tier 1 of each Practice is actually wired up to a real site
// feature so far (marked BUILT below, chosen and confirmed with Rob one
// at a time -- see IDEAS.md). Tiers 2-20 are the full roadmap already
// agreed with Rob, ready to build one at a time, in order, per Practice.
// Tier N+1 past the hand-authored 20 is procedural (see
// practiceTierText) -- same reasoning Diablo's Paragon board and WoW's
// late talent rows use once the hand-written content runs out.

import { supabase } from "@/lib/supabaseClient";

export type PracticeKey = "voice" | "kinship" | "guidance" | "stewardship";

export const PRACTICE_ORDER: PracticeKey[] = ["voice", "kinship", "guidance", "stewardship"];

export interface PracticeDef {
  key: PracticeKey;
  name: string;
  theme: string;
  tiers: string[]; // index 0 = Tier 1
}

export const PRACTICES: Record<PracticeKey, PracticeDef> = {
  voice: {
    key: "voice",
    name: "Voice",
    theme: "self-expression and original posting",
    tiers: [
      "Can attach one image to an original thread.", // BUILT -- composer + thread display
      "Rich text formatting unlocked in posts (bold, italic).", // BUILT -- composer toolbar + lib/richText.tsx
      "Your original threads carry a quiet Voice marker next to your name.",
      "Custom post accent color.", // NOTE: overlaps with the Blue Heart String's existing commons_accent door (lib/keys.ts) -- resolve which one wins before building this tier.
      "Multi-image posts (up to 3).",
      "Can save a personal draft between visits.",
      "Longer bio field unlocked, once a bio field exists.",
      "Custom thread-cover flourish.",
      "'Steady Voice' badge -- consistent original posting recognized.",
      "Nested quote formatting in replies.",
      "Short audio note attachment (accessibility-friendly alternative to text).",
      "Expanded formatting toolbar (headers, lists).",
      "Can cross-link between two threads.",
      "'Found Voice' -- a private highlight reel of your own top posts.",
      "Can request a topic spotlight from the team.",
      "Custom emoji reaction submission.",
      "Expanded image gallery per post (up to 6).",
      "Can propose a new weekly discussion prompt.",
      "A second permanent thread-cover style choice.",
      "'Voice of the Commons' -- capstone; your posts carry a permanent, quiet visual marker.",
    ],
  },
  kinship: {
    key: "kinship",
    name: "Kinship",
    theme: "showing up for other people",
    tiers: [
      "Your own reaction history becomes visible to you -- a quiet list only you can see.", // BUILT
      "Can leave a private encouragement note on someone's reply.", // BUILT -- lib/commons.ts's sendEncouragementNote, "Encourage" button on replies, delivered via the existing notifications panel
      "Private 'Steady Kinship' streak tracker (never shown publicly, never punishing).",
      "Can send a one-time 'thinking of you' nudge to a thread's author.",
      "Reaction combinations on long threads.",
      "Optional, opt-in Kinship badge on your own profile.",
      "Can highlight a specific reply as 'this helped me'.",
      "Expanded private note history.",
      "'Quiet Constant' -- recognized for steady gentle presence, not volume.",
      "Kinship support extends to private check-ins, once that surface exists.",
      "A private 'who I've shown up for' log, visible only to you.",
      "Can send encouragement to an entire thread, not just one reply.",
      "Kinship streak grace period lengthens (kinder, never punitive).",
      "'Held Space' -- a profile flourish reflecting tenure of presence.",
      "Can privately nominate a thread as 'meant a lot to me'.",
      "Expanded emotional-reaction palette.",
      "Longer, richer encouragement notes.",
      "A private end-of-month reflection summarizing where you showed up.",
      "A third reaction kind, layered onto the existing Heartfelt/Heartache pair -- never replacing them.",
      "'Same Heart Kinship' -- capstone; marked as a trusted steady presence.",
    ],
  },
  guidance: {
    key: "guidance",
    name: "Guidance",
    theme: "curating resources and links for others",
    tiers: [
      "Can attach one external resource link to an original thread.", // BUILT -- composer + thread display
      "Personal 'Resource Shelf' starts (up to 5 saved).", // BUILT -- lib/resourceShelf.ts, Hub panel, "Save" button on thread pages
      "Can tag a resource with a category.",
      "Shelf capacity increases (up to 15).",
      "Can pin one resource to a community's sidebar.",
      "Can annotate why a resource helped.",
      "Your shelf becomes visible to others browsing your profile.",
      "Can suggest a resource for the official Support Services page.",
      "Shelf capacity increases further (up to 40).",
      "'Trailblazer' badge -- resources you've shared are getting used.",
      "Can create a themed collection grouping several resources.",
      "Can co-curate a collection with another member.",
      "Suggested resources get a lightweight review queue (never auto-published).",
      "Shelf capacity effectively unlimited.",
      "'Wide Net' -- a profile flourish for resource curation.",
      "Can request a resource be featured site-wide for a week.",
      "Collections can be followed by others.",
      "Can retire a stale resource with a note explaining why.",
      "A direct line to suggest additions to the crisis-support keyword list.",
      "'Same Heart Guide' -- capstone; permanent guide status on your collections.",
    ],
  },
  stewardship: {
    key: "stewardship",
    name: "Stewardship",
    theme: "trust and light, human moderation",
    tiers: [
      "Can flag a thread or reply for review -- the first real trust step.", // BUILT -- flag button + commons_flags
      "Flag carries a bit more review weight, once a review queue exists.",
      "You can see whether a flag you raised was acted on.",
      "Can categorize a flag (spam, distress, off-topic, etc.).",
      "'Quiet Trust' -- your flags get reviewed faster.",
      "Can request a second opinion before flagging something borderline.",
      "Can leave a private note for the team alongside a flag.",
      "Flag weight increases again.",
      "Can see basic, anonymized community-health signals.",
      "'Steadier Hand' badge.",
      "Can resolve certain low-stakes flags directly (e.g. exact duplicates).",
      "Included in a private, occasional stewardship digest.",
      "Can apply a temporary cooldown to a repeatedly disruptive thread.",
      "Flag weight increases further.",
      "'Kept Light' -- a profile flourish marking real trust.",
      "Invited into a private stewardship channel with the team.",
      "Can propose a new community guideline for review.",
      "Can co-review flagged content alongside another steward.",
      "A direct feedback line to Rob on moderation and trust decisions.",
      "'Council Seat' -- capstone; near-full trusted-steward status.",
    ],
  },
};

export type PracticePoints = Record<PracticeKey, number>;

export const EMPTY_PRACTICE_POINTS: PracticePoints = { voice: 0, kinship: 0, guidance: 0, stewardship: 0 };

// One Ripple Point every 5 Levels -- matches the "Continuous Growth"
// design exactly (see the delivered spreadsheet's Option A - Level
// Ladder sheet).
const LEVELS_PER_RIPPLE_POINT = 5;

export function ripplePointsEarned(level: number): number {
  return Math.floor(level / LEVELS_PER_RIPPLE_POINT);
}

export function normalizePracticePoints(raw: unknown): PracticePoints {
  const points = { ...EMPTY_PRACTICE_POINTS };
  if (raw && typeof raw === "object") {
    for (const key of PRACTICE_ORDER) {
      const value = (raw as Record<string, unknown>)[key];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        points[key] = Math.floor(value);
      }
    }
  }
  return points;
}

export function totalInvested(points: PracticePoints): number {
  return PRACTICE_ORDER.reduce((sum, key) => sum + (points[key] ?? 0), 0);
}

export function unspentRipplePoints(level: number, points: PracticePoints): number {
  return Math.max(0, ripplePointsEarned(level) - totalInvested(points));
}

// Tier N is unlocked once N points are invested in that Practice --
// Tier 1 the moment the first point goes in.
export function practiceTier(points: PracticePoints, key: PracticeKey): number {
  return points[key] ?? 0;
}

export function isPracticeTierUnlocked(points: PracticePoints, key: PracticeKey, tier: number): boolean {
  return practiceTier(points, key) >= tier;
}

// What Tier N of a Practice actually says -- procedural once past the
// hand-authored 20 (see the file header for why).
export function practiceTierText(key: PracticeKey, tier: number): string {
  if (tier < 1) return "";
  const def = PRACTICES[key];
  if (tier <= def.tiers.length) return def.tiers[tier - 1];
  return `Tier ${tier} -- a further small, steady increase in ${def.theme} (procedural past Tier ${def.tiers.length}).`;
}

export function leadingPractice(points: PracticePoints): PracticeKey | null {
  let best: PracticeKey | null = null;
  let bestValue = 0;
  for (const key of PRACTICE_ORDER) {
    const value = points[key] ?? 0;
    if (value > bestValue) {
      bestValue = value;
      best = key;
    }
  }
  return best;
}

// -- Client-facing helpers, same shape as lib/keys.ts / lib/evolution.ts. --

export async function fetchMyPracticePoints(profileId: string): Promise<PracticePoints> {
  const { data, error } = await supabase.from("profiles").select("practice_points").eq("id", profileId).single();
  if (error || !data) return { ...EMPTY_PRACTICE_POINTS };
  return normalizePracticePoints(data.practice_points);
}

// Spends one unspent Ripple Point into a Practice. Server-validated --
// see app/api/practices/invest/route.ts, which recomputes eligibility
// itself rather than trusting anything from here.
export async function investRipplePoint(
  key: PracticeKey
): Promise<{ ok: boolean; error?: string; points?: PracticePoints }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, error: "Sign in first." };

  try {
    const res = await fetch("/api/practices/invest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ practice: key }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json?.error ?? "Couldn't invest that point right now." };
    return { ok: true, points: normalizePracticePoints(json.points) };
  } catch {
    return { ok: false, error: "Couldn't reach the server -- try again in a moment." };
  }
}
