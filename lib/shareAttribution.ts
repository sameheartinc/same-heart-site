import { supabase } from "@/lib/supabaseClient";

// Same Heart -- tracked share links (Sep 22, 2026, Rob: "if you share
// links from our website onto other sites you would be able to gain
// points"). Two rewards live behind this file, at very different trust
// levels:
//
//   1. A completed signup -- the real reward, and exactly as protected
//      as the referral system already was (see supabase/schema.sql's
//      referred_by/handle_new_user and the Orange Heart String). All this
//      file adds is carrying the sharer's Spark ID forward from wherever
//      someone first landed (any shared thread/community/Exchange page,
//      not just a direct /login link) to whenever they actually sign up,
//      which can be a different page, a while later.
//   2. A small, capped XP nudge for a real distinct visitor clicking
//      through (see awardShareVisit in lib/xpEngine.ts). HONEST
//      LIMITATION: the visitor is identified by a random id stored in
//      their own browser, not a real account -- someone motivated enough
//      (private browsing, clearing storage) could inflate it. That's why
//      it's kept tiny and tightly capped (lib/xpActions.ts's "share" cap
//      group) -- never worth the effort to game, and never the thing
//      that actually moves someone's XP in a meaningful way.

const REF_STORAGE_KEY = "sh_ref_capture";
const VISITOR_KEY_STORAGE_KEY = "sh_visitor_key";
const REF_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days -- a normal attribution window

interface CapturedRef {
  sparkId: string;
  capturedAt: number;
}

export function getOrCreateVisitorKey(): string {
  if (typeof window === "undefined") return "";
  try {
    let key = window.localStorage.getItem(VISITOR_KEY_STORAGE_KEY);
    if (!key) {
      key = crypto.randomUUID();
      window.localStorage.setItem(VISITOR_KEY_STORAGE_KEY, key);
    }
    return key;
  } catch {
    return "";
  }
}

// Called on any page load that carries a real ?ref=<Spark ID> (see
// components/ShareAttributionCapture.tsx, mounted once in app/layout.tsx).
// Keeps the first capture's timestamp if the same ref shows up again, so
// re-clicking your own earlier link doesn't reset the 30-day window.
export function captureRefFromUrl(ref: string): void {
  if (typeof window === "undefined" || !/^\d+$/.test(ref)) return;
  try {
    const existing = getCapturedRef();
    if (existing?.sparkId === ref) return;
    const record: CapturedRef = { sparkId: ref, capturedAt: Date.now() };
    window.localStorage.setItem(REF_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Best-effort -- a failed capture just means no referral credit later, never a visible error.
  }
}

// Read back on app/login/page.tsx as a fallback when the URL there has no
// ?ref= of its own -- someone who arrived via a shared content page and
// only navigated to /login afterward still carries their attribution.
export function getCapturedRef(): CapturedRef | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REF_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CapturedRef;
    if (!parsed.sparkId || Date.now() - parsed.capturedAt > REF_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Real, total distinct visits across every link this person has ever
// shared -- a plain client-side read, safe under share_visits' own RLS
// policy ("your own rows only," see supabase/schema.sql). No XP rides
// on this number (Rob's call, Sep 22, 2026); it's shown next to the
// existing referral count on the Hub purely so sharing feels like it's
// doing something, even before someone signs up because of it.
export async function fetchShareVisitCount(): Promise<number> {
  const { count, error } = await supabase.from("share_visits").select("id", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}

// Fire-and-forget: tells the server "someone just visited <targetKind>
// <targetId> via a link shared by Spark #<sparkId>." Dedup and the
// reward decision both happen server-side (see
// app/api/share/visit/route.ts and lib/xpEngine.ts's awardShareVisit) --
// this never decides or claims an amount itself.
export async function recordShareVisit(sparkId: string, targetKind: string, targetId: string): Promise<void> {
  try {
    const visitorKey = getOrCreateVisitorKey();
    if (!visitorKey) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    await fetch("/api/share/visit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ sparkId, targetKind, targetId, visitorKey }),
    });
  } catch {
    // Best-effort -- a missed click credit is never worth surfacing an error for.
  }
}
