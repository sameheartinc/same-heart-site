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
// Each Practice builds up from Tier 1, one tier at a time, chosen and
// confirmed with Rob as the roadmap goes (see IDEAS.md for the build
// log of each one). A tier is only ever marked BUILT below once it's a
// real, live, gated feature -- never for narrating something the app
// already did for everyone regardless of tier. As of this writing:
// Voice, Kinship, Guidance, and Stewardship are all through Tier 4 --
// check each tier's own inline comment
// for exactly what shipped and where, rather than trusting this count
// to stay current. Whatever's left up to Tier 20 is the full roadmap
// already agreed with Rob, ready to build one at a time, in order, per
// Practice. Tier N+1 past the hand-authored 20 is procedural (see
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
      "Your original threads carry a quiet Voice marker next to your name.", // BUILT (Sep 5 2026) -- components/VoiceMarker.tsx, rendered next to a thread's own author (never a reply's) in app/commons/page.tsx's ThreadList, app/commons/c/[slug]/page.tsx's thread cards, and app/commons/t/[id]/page.tsx's thread header. Needed practice_points exposed on get_public_profiles for the first time (supabase/schema.sql) since this marker has to be visible to every viewer, not just the author themselves.
      "A short personal signature line under your name, on your own threads.", // BUILT (Sep 9 2026) -- profiles.voice_signature (supabase/schema.sql, 80-char cap), components/VoiceSignature.tsx, editable from the Hub's Voice panel, shown only on the full thread page (app/commons/t/[id]/page.tsx), never the compact list rows. Originally "custom post accent color" -- resolved with Rob to swap in this instead once it turned out to duplicate the Blue Heart String's existing commons_accent door (lib/keys.ts).
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
      "Your own reaction history becomes visible to you -- a quiet list only you can see.", // BUILT loosely -- lib/commons.ts's ReactionSummary.mine already surfaces your own reaction state everywhere reactions render; no dedicated gated view exists yet. Counted as satisfying Tier 1 rather than building a redundant screen, but flagged here since every other Tier 1 below points at something newly built specifically for that tier -- a real private "My Reactions" list is a fair thing to build later if Rob wants this tier to mean more.
      "Can leave a private encouragement note on someone's reply.", // BUILT -- lib/commons.ts's sendEncouragementNote, "Encourage" button on replies, delivered via the existing notifications panel
      "Private 'Steady Kinship' streak tracker (never shown publicly, never punishing).", // BUILT (Sep 5 2026) -- profiles.kinship_streak_current/longest/last_date (supabase/schema.sql), updated only inside send_encouragement_note's security-definer function (the first encouragement note of a calendar day moves it; sending more the same day does not). Hub panel gated on kinshipTier >= 3, states only the current/longest counts -- no "streak broken" language, ever.
      "Can send a one-time 'thinking of you' nudge to a thread's author.", // BUILT (Sep 10 2026) -- send_thread_nudge() (supabase/schema.sql), lib/commons.ts's sendThreadNudge, a small "Thinking of you" button on the thread's own page (app/commons/t/[id]/page.tsx), never shown on your own thread. Wordless and capped to once per (sender, thread) pair -- distinct from Tier 2's encouragement note (which has text and targets a reply). Deliberately doesn't touch the Tier 3 streak; see that function's own comment for why.
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
      "Can tag a resource with a category.", // BUILT (Sep 5 2026) -- resource_shelf.issue_key (supabase/schema.sql), lib/resourceShelf.ts's setShelfItemCategory, components/ShelfCategoryPicker.tsx rendered per shelf item in the Hub, gated on guidanceTier >= 3. Reuses lib/worldIssues.ts's WORLD_ISSUES -- the Exchange's own issue taxonomy -- rather than inventing a second category list.
      "Shelf capacity increases (up to 15).", // BUILT (Sep 10 2026) -- lib/resourceShelf.ts's shelfCapacity(guidanceTier), the one place a Guidance Tier maps to a real cap. addToShelf now takes the cap as a real parameter instead of the old flat RESOURCE_SHELF_CAP constant; the Hub's "X of Y saved" label reads the same function so the two can't drift apart.
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
      "Can flag a thread or reply for review -- the first real trust step.", // BUILT -- flag button + commons_flags (commons_flags itself had never actually been migrated until the Sep 4 2026 review-queue build below -- fixed there)
      "Flag carries a bit more review weight, once a review queue exists.", // BUILT -- app/admin/flags, app/api/stewardship/{flags,decide}. "Weight" isn't a literal number yet -- what this tier really promised was a human on the other end, and now there is one.
      "You can see whether a flag you raised was acted on.", // BUILT -- lib/commons.ts's fetchMyFlagStatuses, the Flag button on app/commons/t/[id]/page.tsx reads "Flag resolved"/"Flag dismissed" once acted on
      "Can categorize a flag (spam, distress, off-topic, etc.).", // BUILT (Sep 9 2026) -- app/commons/t/[id]/page.tsx's reactionRow: clicking Flag at Tier 4+ opens an inline picker (spam/distress/off-topic/harassment/other, plus skip/cancel) instead of flagging immediately. No schema change -- commons_flags.category was already a free-text column the admin queue (app/admin/flags) has rendered since Tier 2, and lib/commons.ts's flagContent already took an optional category; this tier is purely the client-side ability to choose one.
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
