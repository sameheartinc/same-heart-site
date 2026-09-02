"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { SKINS, getSkin, type SkinKey } from "@/lib/skins";
import { listMyKeys, evaluateKeys, setCommonsAccent, KEY_INFO, COMMONS_ACCENT_PALETTE, type ProfileKey } from "@/lib/keys";
import { getLevel, nextPrimeThreshold } from "@/lib/primeLevels";
import {
  listMyNotifications,
  markNotificationsRead,
  fetchProfilesByIds,
  authorName,
  getTrendingThread,
  type CommonsNotification,
  type PublicProfile,
  type TrendingThread,
} from "@/lib/commons";
import { pickQuote, type Quote } from "@/lib/quotes";
import { PATHS, type PathKey } from "@/lib/paths";
import { streakVisualTier, checkInWithServer, type StreakMilestone } from "@/lib/streak";
import { listMyUnlocks, evaluateEvolution } from "@/lib/evolution";
import { getMyMonetizationStatus, applyForMonetization, type MonetizationStatus } from "@/lib/monetization";
import { findKindredSparks, setKindredOptOut, type KindredMatch } from "@/lib/kindredSparks";
import { FALLBACK_SKINS, loadWidgetSkins, type WidgetSkin, type WidgetSkinKey } from "@/lib/widgetSkins";
import WidgetFrame from "@/components/WidgetFrame";

type Profile = {
  display_name: string | null;
  designation: string | null;
  frequency: number | null;
  archetype: string | null;
  xp: number;
  standing: string;
  joined_at: string;
  ship_skin: string | null;
  path_key: string | null;
  spark_id: number | null;
  current_streak: number;
  longest_streak: number;
  last_visit_date: string | null;
  commons_accent: string | null;
  hub_background_url: string | null;
  kindred_opt_out: boolean;
};

type LogEntry = {
  id: string;
  occurred_at: string;
  description: string;
  xp_awarded: number;
};

// "Floating ideas that are getting more attention" only start showing
// up once someone's engaged enough to have leveled up a few times --
// Rob's own framing ("evolve for consistent users as they become more
// engaged"). Level 3 (5 XP) is an early but genuine threshold, not the
// very first visit -- see lib/primeLevels.ts.
const TRENDING_UNLOCK_LEVEL = 3;

function sparkLabel(sparkId: number | null): string | null {
  if (sparkId == null) return null;
  return "Spark #" + String(sparkId).padStart(5, "0");
}

export default function HubPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [skinSaving, setSkinSaving] = useState(false);
  const [backgroundUploading, setBackgroundUploading] = useState(false);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const [accentSaving, setAccentSaving] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [logDraft, setLogDraft] = useState("");
  const [logSaving, setLogSaving] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [milestone, setMilestone] = useState<StreakMilestone | null>(null);
  const [leveledUpTo, setLeveledUpTo] = useState<number | null>(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [keys, setKeys] = useState<ProfileKey[]>([]);
  const [kindredMatches, setKindredMatches] = useState<KindredMatch[]>([]);
  const [kindredOptOutSaving, setKindredOptOutSaving] = useState(false);
  const [notifications, setNotifications] = useState<CommonsNotification[]>([]);
  const [notifAuthors, setNotifAuthors] = useState<Record<string, PublicProfile>>({});
  const [notifOpen, setNotifOpen] = useState(false);
  // Floating bubbles -- an ambient, no-click-required companion to the
  // NOTICES bell above (ask was: "a little bubble pop up... make it
  // clickable to take them to the community area"), plus a second,
  // level-gated bubble surfacing whatever idea is getting real
  // attention right now. Dismissing either just hides it for this visit
  // (session-only state) -- it isn't "read" until you actually act on it.
  const [trending, setTrending] = useState<TrendingThread | null>(null);
  const [replyBubbleDismissed, setReplyBubbleDismissed] = useState(false);
  const [trendingBubbleDismissed, setTrendingBubbleDismissed] = useState(false);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [monetizationStatus, setMonetizationStatus] = useState<MonetizationStatus>("none");
  const [monetizationSubmitting, setMonetizationSubmitting] = useState(false);
  const [monetizationError, setMonetizationError] = useState<string | null>(null);
  const [skinCatalog, setSkinCatalog] = useState<WidgetSkin[]>(FALLBACK_SKINS);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select(
          "display_name, designation, frequency, archetype, xp, standing, joined_at, ship_skin, path_key, spark_id, current_streak, longest_streak, last_visit_date, commons_accent, hub_background_url, kindred_opt_out"
        )
        .eq("id", userData.user.id)
        .single();

      if (!profileData?.designation) {
        // Star Day hasn't been set yet -- send them there first.
        router.replace("/star-day");
        return;
      }

      const { data: logData, error: logFetchError } = await supabase
        .from("log_entries")
        .select("id, occurred_at, description, xp_awarded")
        .eq("profile_id", userData.user.id)
        .order("occurred_at", { ascending: false });
      if (logFetchError) {
        // Don't let a real failure here silently look identical to "no
        // entries yet" -- that's exactly what masked the missing-table
        // issue before.
        console.error("log_entries fetch failed:", logFetchError);
      }

      let currentProfile = profileData as Profile;
      let currentLog = (logData ?? []) as LogEntry[];

      // The return-engagement check-in: once per calendar day, showing up
      // to the Hub grows the streak, awards a little XP, and -- on real
      // milestones -- shows a small, honest "you did this" moment. Moved
      // fully server-side (app/api/streak/check-in/route.ts) -- this used
      // to compute and write xp/standing/streak straight from the client,
      // which meant those columns were only as trustworthy as whatever the
      // browser sent. The server now re-derives everything itself from
      // lib/streak.ts's same pure logic; this call just asks for it and
      // applies whatever comes back.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const checkIn = accessToken ? await checkInWithServer(accessToken) : null;

      if (checkIn?.changed) {
        currentProfile = {
          ...currentProfile,
          xp: checkIn.xp,
          standing: checkIn.standing,
          current_streak: checkIn.streak.current_streak,
          longest_streak: checkIn.streak.longest_streak,
          last_visit_date: checkIn.streak.last_visit_date,
        };

        if (checkIn.logEntry) {
          currentLog = [checkIn.logEntry as LogEntry, ...currentLog];
        }

        setMilestone(checkIn.milestone);
      }

      const myKeys = await listMyKeys();
      const myUnlocks = await listMyUnlocks();
      const myMonetizationStatus = await getMyMonetizationStatus();
      const myNotifications = await listMyNotifications();
      const notifAuthorProfiles = await fetchProfilesByIds(
        myNotifications.map((n) => n.actor_id).filter((id): id is string => Boolean(id))
      );

      setUserId(userData.user.id);
      setProfile(currentProfile);
      setLog(currentLog);

      // Prime Levels (see lib/primeLevels.ts) -- a one-time "Level up"
      // banner the first time this browser sees a higher level than it
      // last recorded. Purely a client-side courtesy: Level itself is
      // just a pure function of XP, recomputed fresh on every visit, so
      // there's nothing to lose here even if this check is ever missed
      // (a different device, cleared browser storage) -- only the
      // one-time celebration of crossing it would be, not the level.
      try {
        const currentLevel = getLevel(currentProfile.xp);
        const lastSeenRaw = window.localStorage.getItem("same-heart-last-seen-level");
        const lastSeen = lastSeenRaw ? parseInt(lastSeenRaw, 10) : 0;
        if (currentLevel > lastSeen) {
          setLeveledUpTo(currentLevel);
        }
        window.localStorage.setItem("same-heart-last-seen-level", String(currentLevel));

        // "Name your ship" -- Rob noticed people show up elsewhere on
        // the site (Commons replies, etc.) as "Spark #00034" because
        // they never found the small, always-available call-sign editor
        // at the top of this page (see startEditName/saveDisplayName
        // below). Once someone's real enough to have reached Level 5,
        // nudge them once -- never again, and never at all if they've
        // already set a name by then.
        if (currentLevel >= 5 && !currentProfile.display_name) {
          const namePromptSeen = window.localStorage.getItem("same-heart-name-prompt-seen");
          if (!namePromptSeen) setShowNamePrompt(true);
        }
      } catch {
        /* localStorage can throw in some private-browsing contexts -- a
           missed celebration banner isn't worth surfacing an error for. */
      }
      setKeys(myKeys);
      setUnlockedIds(new Set(myUnlocks));
      setMonetizationStatus(myMonetizationStatus);
      setNotifications(myNotifications);
      setNotifAuthors(notifAuthorProfiles);
      setIsAnonymous(Boolean((userData.user as { is_anonymous?: boolean }).is_anonymous));
      // A fresh line every visit -- leans toward their archetype's own
      // lines when it has any, but never runs out either way.
      setQuote(pickQuote(currentProfile.archetype));
      setLoading(false);

      // Quiet background check for anything newly earned -- never blocks
      // the Hub, and a no-op almost every visit.
      evaluateKeys().then((result) => {
        if (result.newlyEarned.length > 0) {
          listMyKeys().then(setKeys);
        }
      });

      // Same quiet, idempotent background check, for the more general
      // rewards described in lib/evolution.ts (the first one being the
      // Aurora widget skin below).
      evaluateEvolution().then((result) => {
        if (result.newlyEarned.length > 0) {
          listMyUnlocks().then((ids) => setUnlockedIds(new Set(ids)));
        }
      });

      // The Capsule's skin catalog now lives in Supabase (see
      // lib/widgetSkins.ts) -- load it once here so lockedSkinKeys below
      // can be computed against the real list, not just the 4 fallback
      // skins baked into the bundle.
      loadWidgetSkins().then(setSkinCatalog);

      // Kindred Sparks -- see lib/kindredSparks.ts. Computed fresh from
      // already-public signals every time the Hub loads; if this person
      // opted out, findKindredSparks itself returns nothing.
      if (!currentProfile.kindred_opt_out) {
        findKindredSparks(userData.user.id).then(setKindredMatches);
      }

      // "Floating ideas getting more attention" -- see lib/commons.ts's
      // getTrendingThread. Level-gated (TRENDING_UNLOCK_LEVEL above) so
      // it only starts appearing once someone's engaged enough to have
      // leveled up a few times, not from their very first visit.
      if (getLevel(currentProfile.xp) >= TRENDING_UNLOCK_LEVEL) {
        getTrendingThread().then(setTrending);
      }
    })();
  }, [router]);

  // Kindred Sparks opt-out -- flips profiles.kindred_opt_out and clears
  // (or reloads) the widget's matches to match the new state immediately,
  // rather than waiting for the next visit.
  async function toggleKindredOptOut() {
    if (!profile || !userId) return;
    const next = !profile.kindred_opt_out;
    setKindredOptOutSaving(true);
    await setKindredOptOut(next);
    setProfile({ ...profile, kindred_opt_out: next });
    if (next) {
      setKindredMatches([]);
    } else {
      findKindredSparks(userId).then(setKindredMatches);
    }
    setKindredOptOutSaving(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // Monetization gate, part 6 -- the Hub's own apply button. Eligibility
  // (holding all four Heart Strings) is already reflected in
  // unlockedIds; this just asks the server to actually record an
  // application, which it does whether the applicant's denied before or
  // never applied at all. Real approval only ever happens in
  // /admin/monetization -- this never sets anything to "approved" itself.
  async function applyMonetization() {
    setMonetizationSubmitting(true);
    setMonetizationError(null);
    const result = await applyForMonetization();
    setMonetizationSubmitting(false);
    if (!result.ok) {
      setMonetizationError(result.error ?? "Couldn't submit your application right now.");
      return;
    }
    if (result.status) setMonetizationStatus(result.status);
  }

  const unreadNotifications = notifications.filter((n) => !n.read_at);
  const newestUnread = unreadNotifications[0] ?? null;

  async function toggleNotifications() {
    const opening = !notifOpen;
    setNotifOpen(opening);
    if (opening && unreadNotifications.length > 0) {
      const ids = unreadNotifications.map((n) => n.id);
      // Optimistic -- the badge should clear the moment you open the
      // panel, not after a round trip.
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n))
      );
      await markNotificationsRead(ids);
    }
  }

  // Clicking the floating reply bubble marks just that one notice read
  // (same optimistic-then-write pattern as toggleNotifications above)
  // and lets the Link's own navigation carry you to the thread.
  async function openReplyBubble(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    await markNotificationsRead([id]);
  }

  async function chooseSkin(key: SkinKey) {
    if (!userId || !profile || profile.ship_skin === key) return;
    const previous = profile.ship_skin;
    // Optimistic update -- the picker should feel instant, not like it's
    // waiting on a network request.
    setProfile({ ...profile, ship_skin: key });
    setSkinSaving(true);
    const { error } = await supabase.from("profiles").update({ ship_skin: key }).eq("id", userId);
    setSkinSaving(false);
    if (error) {
      // Quietly revert -- this is cosmetic, not worth a scary error banner.
      setProfile((p) => (p ? { ...p, ship_skin: previous } : p));
    }
  }

  // Hub background upload -- the first user-uploaded image on the site
  // (see the schema.sql migration's comment for the tradeoff this
  // accepts). Client-side checks here (type, size) are a courtesy, not
  // the real security boundary -- storage.objects' RLS policies are what
  // actually stop anyone from writing outside their own folder, and
  // Supabase itself rejects anything that isn't a real image at the
  // bucket level being irrelevant here since we don't restrict mime
  // types at the bucket -- so this is deliberately generous but bounded
  // by size alone.
  const MAX_BACKGROUND_BYTES = 8 * 1024 * 1024;

  async function uploadHubBackground(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file || !userId || !profile) return;

    if (!file.type.startsWith("image/")) {
      setBackgroundError("That doesn't look like an image.");
      return;
    }
    if (file.size > MAX_BACKGROUND_BYTES) {
      setBackgroundError("Keep it under 8MB.");
      return;
    }

    setBackgroundError(null);
    setBackgroundUploading(true);

    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${userId}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage.from("hub-backgrounds").upload(path, file, {
      upsert: false,
      contentType: file.type,
    });

    if (uploadError) {
      setBackgroundUploading(false);
      setBackgroundError("Couldn't upload that -- try again.");
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("hub-backgrounds").getPublicUrl(path);
    const nextUrl = publicUrlData.publicUrl;

    const { error: saveError } = await supabase
      .from("profiles")
      .update({ hub_background_url: nextUrl })
      .eq("id", userId);

    setBackgroundUploading(false);
    if (saveError) {
      setBackgroundError("Uploaded, but couldn't save it to your profile -- try again.");
      return;
    }
    setProfile({ ...profile, hub_background_url: nextUrl });
  }

  // Doesn't delete the old file from storage -- just clears the profile
  // column so it stops being used. Same "leave it, don't chase cleanup"
  // choice as everywhere else images are swapped on this site; worth a
  // real cleanup pass later if storage usage ever becomes worth watching.
  async function removeHubBackground() {
    if (!userId || !profile) return;
    const previous = profile.hub_background_url;
    setProfile({ ...profile, hub_background_url: null });
    const { error } = await supabase.from("profiles").update({ hub_background_url: null }).eq("id", userId);
    if (error) {
      setProfile((p) => (p ? { ...p, hub_background_url: previous } : p));
      setBackgroundError("Couldn't remove it -- try again.");
    }
  }

  // Blue key's door -- see app/api/keys/set-accent/route.ts, the only
  // place this column is ever actually written. This function just calls
  // it and reverts the optimistic update if the server says no (e.g. the
  // key was somehow lost, or the session expired mid-click).
  async function chooseAccent(color: string) {
    if (!userId || !profile || profile.commons_accent === color) return;
    const previous = profile.commons_accent;
    setProfile({ ...profile, commons_accent: color });
    setAccentSaving(true);
    const ok = await setCommonsAccent(color);
    setAccentSaving(false);
    if (!ok) {
      setProfile((p) => (p ? { ...p, commons_accent: previous } : p));
    }
  }

  // The name painted on the hull -- freeform, optional, editable any time.
  // Falls back to the archetype (e.g. "The Weaver") when cleared, the same
  // fallback authorName() already uses for this column elsewhere.
  function startEditName() {
    if (!profile) return;
    setNameDraft(profile.display_name?.trim() || "");
    setNameError(null);
    setEditingName(true);
  }

  function cancelEditName() {
    setEditingName(false);
    setNameError(null);
  }

  async function saveDisplayName(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !profile || nameSaving) return;
    const trimmed = nameDraft.trim().slice(0, 24);
    if (trimmed.length > 0 && trimmed.length < 2) {
      setNameError("A little longer than that.");
      return;
    }
    const nextValue = trimmed.length > 0 ? trimmed : null;
    if (nextValue === profile.display_name) {
      setEditingName(false);
      return;
    }
    const previous = profile.display_name;
    setNameError(null);
    // Optimistic update, same pattern as chooseSkin/chooseAccent above.
    setProfile({ ...profile, display_name: nextValue });
    setNameSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: nextValue }).eq("id", userId);
    setNameSaving(false);
    if (error) {
      setProfile((p) => (p ? { ...p, display_name: previous } : p));
      setNameError("Couldn't save -- try again.");
      return;
    }
    setEditingName(false);
  }

  // A separate, self-contained save path for the Level 5 prompt banner
  // below -- deliberately not reusing saveDisplayName's editingName
  // state, since this banner has its own open/closed state
  // (showNamePrompt) and needs to dismiss itself (and remember that,
  // via localStorage) on success without touching the call-sign editor
  // at the top of the page at all.
  async function submitNamePrompt(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !profile || nameSaving) return;
    const trimmed = nameDraft.trim().slice(0, 24);
    if (trimmed.length > 0 && trimmed.length < 2) {
      setNameError("A little longer than that.");
      return;
    }
    const nextValue = trimmed.length > 0 ? trimmed : null;
    setNameError(null);
    setNameSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: nextValue }).eq("id", userId);
    setNameSaving(false);
    if (error) {
      setNameError("Couldn't save -- try again.");
      return;
    }
    setProfile((p) => (p ? { ...p, display_name: nextValue } : p));
    dismissNamePrompt();
  }

  function dismissNamePrompt() {
    setShowNamePrompt(false);
    setNameError(null);
    try {
      window.localStorage.setItem("same-heart-name-prompt-seen", "1");
    } catch {
      /* Same reasoning as the Level-up celebration above -- worst case
         this prompt reappears once more next visit, nothing is lost. */
    }
  }

  async function addLogEntry(e: React.FormEvent) {
    e.preventDefault();
    const description = logDraft.trim();
    if (!description || !userId) return;
    setLogError(null);
    setLogSaving(true);
    const { data, error } = await supabase
      .from("log_entries")
      .insert({ profile_id: userId, description, category: "personal" })
      .select("id, occurred_at, description, xp_awarded")
      .single();
    setLogSaving(false);
    if (error) {
      // Surface the real reason, not a generic message -- makes it
      // possible to actually diagnose a failure instead of guessing.
      setLogError(error.message || "Couldn't save that -- try again in a moment.");
      console.error("log_entries insert failed:", error);
      return;
    }
    setLog((prev) => [data as LogEntry, ...prev]);
    setLogDraft("");
  }

  if (loading || !profile) return null;

  const dayNumber = Math.max(
    1,
    Math.floor((Date.now() - new Date(profile.joined_at).getTime()) / 86400000) + 1
  );

  const activeSkin = getSkin(profile.ship_skin);
  // Palette skins (all of them today) render exactly as before -- plain
  // var(--void). An "artwork" skin additionally carries a real image, laid
  // under a dark scrim so the same text/contrast rules still hold. A
  // personal uploaded background (hub_background_url) takes priority over
  // both when set -- it's a more specific choice than picking a curated
  // skin, so it wins.
  const backgroundImage = profile.hub_background_url || activeSkin.image;
  const heroBackground = backgroundImage
    ? `linear-gradient(rgba(5,7,13,0.74), rgba(5,7,13,0.74)), url(${backgroundImage}) center / cover fixed no-repeat`
    : "var(--void)";
  const path = profile.path_key ? PATHS[profile.path_key as PathKey] : null;
  const spark = sparkLabel(profile.spark_id);
  // Prime Levels -- see lib/primeLevels.ts. A pure function of XP, so no
  // fetch or server round-trip needed: it's just as trustworthy as the
  // XP number itself.
  const level = getLevel(profile.xp);
  const nextLevelAt = nextPrimeThreshold(profile.xp);
  const streakTier = streakVisualTier(profile.current_streak ?? 0);
  const shipName = profile.display_name?.trim() || profile.archetype || "Unnamed Vessel";
  // Skins with an unlockId only join the Capsule's cycle once this
  // profile actually holds that unlock -- see lib/evolution.ts. Skins
  // with no unlockId (the original three) are never locked here.
  const lockedSkinKeys: WidgetSkinKey[] = skinCatalog.filter(
    (s) => s.unlockId && !unlockedIds.has(s.unlockId)
  ).map((s) => s.key);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: heroBackground,
        padding: "40px 22px",
        color: "var(--ink)",
        transition: "background 0.5s ease, color 0.5s ease",
        ...(activeSkin.vars as React.CSSProperties),
      }}
    >
      <style>{`
        @keyframes quoteFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hub-quote {
          animation: quoteFadeIn 1.1s ease both;
          animation-delay: 0.15s;
        }
        @keyframes liftPulse {
          0%, 100% { box-shadow: 0 0 0 0 var(--gold-glow, rgba(201,161,90,0.45)); }
          50% { box-shadow: 0 0 0 10px rgba(201,161,90,0); }
        }
        .liftoff-btn { animation: liftPulse 2.6s ease-in-out infinite; }
        .liftoff-btn:hover { animation-play-state: paused; }
        @keyframes streakPulse {
          0%, 100% { box-shadow: 0 0 24px rgba(201,161,90,0.32); }
          50% { box-shadow: 0 0 34px rgba(201,161,90,0.55); }
        }
        .streak-glow-pulse { animation: streakPulse 3.4s ease-in-out infinite; }
        @keyframes bubbleIn {
          from { opacity: 0; transform: translateY(6px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bubbleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .hub-floating-bubbles {
          position: absolute;
          top: -14px;
          left: 0;
          right: 0;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          pointer-events: none;
          z-index: 6;
        }
        .hub-floating-bubble {
          pointer-events: auto;
          animation: bubbleIn 0.5s ease both, bubbleFloat 3.2s ease-in-out 0.5s infinite;
        }
        @media (max-width: 480px) {
          .hub-floating-bubbles {
            position: static;
            flex-direction: column;
            margin-bottom: 10px;
          }
          .hub-floating-bubble { max-width: none !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hub-quote, .liftoff-btn, .streak-glow-pulse { animation: none; }
          .hub-floating-bubble { animation: none; }
        }
      `}</style>

      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        {quote && (
          <p
            key={quote.text}
            className="hub-quote"
            style={{
              fontFamily: "var(--font-body)",
              fontStyle: "italic",
              color: "var(--ink-dim)",
              fontSize: "0.98rem",
              textAlign: "center",
              maxWidth: "42ch",
              margin: "0 auto 24px",
              lineHeight: 1.5,
            }}
          >
            &ldquo;{quote.text}&rdquo;
          </p>
        )}

        {milestone && (
          <div
            className="hub-quote"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--gold)",
              borderRadius: "14px",
              padding: "16px 20px",
              marginBottom: "22px",
              textAlign: "center",
              boxShadow: "0 0 24px rgba(201,161,90,0.25)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "0.95rem",
                color: "var(--gold)",
              }}
            >
              Day {milestone.day} &middot; {milestone.label}
            </p>
            <p
              style={{
                margin: "6px 0 0",
                fontFamily: "var(--font-body)",
                fontStyle: "italic",
                color: "var(--ink-dim)",
                fontSize: "0.85rem",
              }}
            >
              +{milestone.bonusXp} XP for showing up, day after day.
            </p>
          </div>
        )}

        {leveledUpTo !== null && (
          <div
            className="hub-quote"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--gold)",
              borderRadius: "14px",
              padding: "16px 20px",
              marginBottom: "22px",
              textAlign: "center",
              boxShadow: "0 0 24px rgba(201,161,90,0.25)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "0.95rem",
                color: "var(--gold)",
              }}
            >
              Level {leveledUpTo}
            </p>
            <p
              style={{
                margin: "6px 0 0",
                fontFamily: "var(--font-body)",
                fontStyle: "italic",
                color: "var(--ink-dim)",
                fontSize: "0.85rem",
              }}
            >
              Your Heartbeats just crossed a prime number -- that's what a level is here.
            </p>
          </div>
        )}

        {showNamePrompt && (
          <div
            className="hub-quote"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--gold)",
              borderRadius: "14px",
              padding: "16px 20px",
              marginBottom: "22px",
              textAlign: "center",
              boxShadow: "0 0 24px rgba(201,161,90,0.25)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "0.95rem",
                color: "var(--gold)",
              }}
            >
              Level 5 -- name your ship
            </p>
            <p
              style={{
                margin: "6px 0 12px",
                fontFamily: "var(--font-body)",
                fontStyle: "italic",
                color: "var(--ink-dim)",
                fontSize: "0.85rem",
              }}
            >
              You&rsquo;ve shown up enough to be real here -- right now you show up to others
              as {profile.spark_id ? `Spark #${String(profile.spark_id).padStart(5, "0")}` : "a number"}.
              Give your ship a name, or skip this and do it anytime from the top of this page.
            </p>
            <form
              onSubmit={submitNamePrompt}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}
            >
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={24}
                placeholder={profile.archetype ?? "Callsign"}
                style={{
                  textAlign: "center",
                  background: "var(--void)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "1rem",
                  color: "var(--ink)",
                  width: "220px",
                  maxWidth: "80vw",
                }}
              />
              {nameError && (
                <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--rose)" }}>
                  {nameError}
                </p>
              )}
              <div style={{ display: "flex", gap: "16px" }}>
                <button
                  type="submit"
                  disabled={nameSaving}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--gold)",
                    cursor: nameSaving ? "default" : "pointer",
                  }}
                >
                  {nameSaving ? "Saving..." : "Save name"}
                </button>
                <button
                  type="button"
                  onClick={dismissNamePrompt}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--ink-dim)",
                    cursor: "pointer",
                  }}
                >
                  Maybe later
                </button>
              </div>
            </form>
          </div>
        )}

        {isAnonymous && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              background: "var(--panel)",
              border: "1px solid var(--gold)",
              borderRadius: "14px",
              padding: "14px 18px",
              marginBottom: "22px",
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-body)",
                fontStyle: "italic",
                fontSize: "0.88rem",
                color: "var(--ink-dim)",
              }}
            >
              Everything here only lives on this device right now.
            </p>
            <Link
              href="/login?claim=1"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--gold)",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Claim your account &rarr;
            </Link>
          </div>
        )}

        {/* Outside the Capsule, on purpose -- a small floating call
            sign, like a name painted on the hull, separate from the
            fully-skinnable console below. */}
        <div style={{ textAlign: "center", marginBottom: "18px" }}>
          {editingName ? (
            <form
              onSubmit={saveDisplayName}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}
            >
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={24}
                placeholder={profile.archetype ?? "Callsign"}
                style={{
                  textAlign: "center",
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "6px 10px",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "1.1rem",
                  color: "var(--ink)",
                  width: "220px",
                  maxWidth: "80vw",
                }}
              />
              {nameError && (
                <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--rose)" }}>
                  {nameError}
                </p>
              )}
              <div style={{ display: "flex", gap: "14px" }}>
                <button
                  type="submit"
                  disabled={nameSaving}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--gold)",
                    cursor: nameSaving ? "default" : "pointer",
                  }}
                >
                  {nameSaving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={cancelEditName}
                  disabled={nameSaving}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--ink-faint)",
                    cursor: nameSaving ? "default" : "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={startEditName}
              title="Rename your ship"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                margin: "0 auto",
                display: "inline-flex",
                alignItems: "baseline",
                gap: "7px",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "1.1rem",
                  letterSpacing: "0.02em",
                  color: "var(--gold)",
                }}
              >
                {shipName}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--ink-faint)" }}>
                &#9998;
              </span>
            </button>
          )}
          <p
            style={{
              margin: "2px 0 0",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            {profile.frequency}Hz &middot; adrift and holding
          </p>
        </div>

        <div style={{ marginBottom: "16px", position: "relative" }}>
          {/* Floating bubbles -- ambient, no click required. Left: a
              level-gated "an idea is getting attention" callout (see
              TRENDING_UNLOCK_LEVEL, lib/commons.ts's getTrendingThread).
              Right: the newest unread reply notice, always available to
              everyone regardless of level -- this one's just a faster,
              harder-to-miss way to see what the NOTICES bell already
              holds, not a new gate. */}
          {((trending && !trendingBubbleDismissed) || (newestUnread && !replyBubbleDismissed)) && (
            <div className="hub-floating-bubbles">
              <div style={{ maxWidth: "48%" }}>
                {trending && !trendingBubbleDismissed && (
                  <div className="hub-floating-bubble" style={{ maxWidth: "190px" }}>
                    <Link
                      href={`/commons/t/${trending.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 12px",
                        borderRadius: "14px",
                        background: "var(--widget-panel)",
                        border: "1px solid var(--widget-accent)",
                        boxShadow: "0 6px 18px rgba(0,0,0,0.3)",
                        fontFamily: "var(--font-body)",
                        fontSize: "0.72rem",
                        lineHeight: 1.3,
                        color: "var(--widget-text)",
                        textDecoration: "none",
                      }}
                    >
                      <span style={{ fontSize: "0.9rem" }}>&#10024;</span>
                      <span>An idea is getting attention: &ldquo;{trending.title}&rdquo;</span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTrendingBubbleDismissed(true);
                        }}
                        style={{ marginLeft: "4px", color: "var(--widget-text-faint)", cursor: "pointer" }}
                      >
                        &times;
                      </span>
                    </Link>
                  </div>
                )}
              </div>
              <div style={{ maxWidth: "48%", display: "flex", justifyContent: "flex-end" }}>
                {newestUnread && !replyBubbleDismissed && (
                  <div className="hub-floating-bubble" style={{ maxWidth: "190px" }}>
                    <Link
                      href={newestUnread.thread_id ? `/commons/t/${newestUnread.thread_id}` : "/commons"}
                      onClick={() => openReplyBubble(newestUnread.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 12px",
                        borderRadius: "14px",
                        background: "var(--widget-panel)",
                        border: "1px solid var(--widget-accent)",
                        boxShadow: "0 6px 18px rgba(0,0,0,0.3)",
                        fontFamily: "var(--font-body)",
                        fontSize: "0.72rem",
                        lineHeight: 1.3,
                        color: "var(--widget-text)",
                        textDecoration: "none",
                      }}
                    >
                      <span style={{ fontSize: "0.9rem" }}>&#128172;</span>
                      <span>
                        {authorName(notifAuthors[newestUnread.actor_id ?? ""])} {newestUnread.body}
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setReplyBubbleDismissed(true);
                        }}
                        style={{ marginLeft: "4px", color: "var(--widget-text-faint)", cursor: "pointer" }}
                      >
                        &times;
                      </span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
          <WidgetFrame storageKey="same-heart-capsule-skin" lockedSkinKeys={lockedSkinKeys}>
            <div style={{ padding: "22px" }}>
        <div
          style={{
            background: "var(--widget-panel)",
            border: "1px solid var(--widget-border)",
            borderRadius: "18px",
            padding: "26px",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "18px",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: "var(--widget-accent)",
                marginBottom: "4px",
              }}
            >
              <span>{profile.designation}</span>
              {spark && <span style={{ color: "var(--widget-text-faint)" }}>&middot; {spark}</span>}
            </div>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.3rem", margin: "0 0 6px" }}>
              {profile.archetype}
            </h1>
            <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--widget-text-dim)", margin: 0 }}>
              {profile.frequency}Hz &middot; {profile.standing} &middot; {profile.xp} XP &middot; Level {level}
            </p>
            <p
              title="A level is how many prime numbers your Heartbeats total has passed -- 2, 3, 5, 7, 11, and so on. They thin out the higher you go, on purpose."
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.04em",
                color: "var(--widget-text-faint)",
                margin: "2px 0 0",
              }}
            >
              {nextLevelAt !== null
                ? `${nextLevelAt - profile.xp} XP to Level ${level + 1}`
                : "Every prime reached so far"}
            </p>
            {path && (
              <p
                style={{
                  marginTop: "8px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: path.accent,
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: path.accent,
                    display: "inline-block",
                  }}
                />
                Walks as {path.name}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ textAlign: "center", padding: "12px 20px", border: "1px solid var(--widget-border)", borderRadius: "12px" }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.6rem", color: "var(--widget-accent)" }}>
                {dayNumber}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--widget-text-faint)" }}>DAY</div>
            </div>
            <div
              title={streakTier.label}
              className={streakTier.glow >= 4 ? "streak-glow-pulse" : undefined}
              style={{
                textAlign: "center",
                padding: "12px 20px",
                border: `1px solid ${streakTier.glow > 0 ? "var(--widget-accent)" : "var(--widget-border)"}`,
                borderRadius: "12px",
                boxShadow:
                  streakTier.glow > 0
                    ? `0 0 ${6 * streakTier.glow}px rgba(201,161,90,${0.12 * streakTier.glow})`
                    : "none",
                transition: "box-shadow 0.6s ease, border-color 0.6s ease",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: "1.6rem",
                  color: streakTier.glow > 0 ? "var(--widget-accent)" : "var(--widget-text)",
                }}
              >
                {profile.current_streak ?? 0}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--widget-text-faint)" }}>STREAK</div>
            </div>

            {/* Notifications -- v1 is just "someone replied to your
                thread." Always present (it's a mailbox, not an
                achievement), but only calls attention to itself with a
                real unread count. See lib/commons.ts and PLAN.md. */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={toggleNotifications}
                aria-label="Notifications"
                aria-expanded={notifOpen}
                style={{
                  textAlign: "center",
                  padding: "12px 20px",
                  border: `1px solid ${unreadNotifications.length > 0 ? "var(--widget-accent)" : "var(--widget-border)"}`,
                  borderRadius: "12px",
                  background: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  position: "relative",
                }}
              >
                {unreadNotifications.length > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: "6px",
                      right: "6px",
                      minWidth: "16px",
                      height: "16px",
                      padding: "0 4px",
                      borderRadius: "8px",
                      background: "var(--widget-rose)",
                      color: "#fff",
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      lineHeight: "16px",
                      textAlign: "center",
                    }}
                  >
                    {unreadNotifications.length}
                  </span>
                )}
                <div style={{ fontSize: "1.4rem", lineHeight: 1 }}>&#128276;</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--widget-text-faint)", marginTop: "6px" }}>
                  NOTICES
                </div>
              </button>

              {notifOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    zIndex: 5,
                    width: "min(320px, 80vw)",
                    maxHeight: "320px",
                    overflowY: "auto",
                    background: "var(--widget-panel)",
                    border: "1px solid var(--widget-border)",
                    borderRadius: "12px",
                    boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
                    padding: "10px",
                  }}
                >
                  {notifications.length === 0 ? (
                    <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--widget-text-faint)" }}>
                      Nothing yet -- replies to your threads show up here.
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <Link
                        key={n.id}
                        href={n.thread_id ? `/commons/t/${n.thread_id}` : "/commons"}
                        onClick={() => setNotifOpen(false)}
                        style={{
                          display: "block",
                          padding: "8px",
                          borderRadius: "8px",
                          textDecoration: "none",
                          color: "var(--widget-text)",
                          fontFamily: "var(--font-body)",
                          fontSize: "0.82rem",
                          background: n.read_at ? "transparent" : "rgba(201,161,90,0.08)",
                        }}
                      >
                        {authorName(notifAuthors[n.actor_id ?? ""])} {n.body}
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Skins -- deliberately compact: this is one control among several
            in the capsule now, not its own destination. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
            marginBottom: "22px",
            padding: "0 4px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--widget-text-faint)",
            }}
          >
            Skin
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            {SKINS.map((s) => {
              const isActive = activeSkin.key === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  title={s.credit ? `${s.name} -- ${s.credit}` : s.name}
                  aria-label={s.name}
                  aria-pressed={isActive}
                  onClick={() => chooseSkin(s.key)}
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    cursor: isActive ? "default" : "pointer",
                    padding: 0,
                    background: s.image
                      ? `url(${s.image}) center / cover`
                      : `linear-gradient(135deg, ${s.vars["--void"]} 50%, ${s.vars["--gold"]} 50%)`,
                    border: isActive ? `2px solid ${s.vars["--gold"]}` : "2px solid transparent",
                    boxShadow: isActive ? `0 0 0 2px var(--widget-background), 0 0 0 3px ${s.vars["--gold"]}66` : "none",
                    transition: "box-shadow 0.2s ease, transform 0.15s ease",
                  }}
                  onTouchStart={() => {}}
                />
              );
            })}
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              color: "var(--widget-text-faint)",
              opacity: skinSaving ? 1 : 0,
              transition: "opacity 0.3s ease",
            }}
          >
            saving&hellip;
          </span>
        </div>

        {/* Background upload -- a personal photo behind the whole page,
            layered in ahead of the curated skins above (see
            heroBackground). Deliberately its own row, not folded into the
            Skin picker, since it's a different kind of choice: something
            you brought, not something offered. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
            marginBottom: "22px",
            padding: "0 4px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--widget-text-faint)",
            }}
          >
            Background
          </span>
          <label
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--widget-accent)",
              border: "1px solid var(--widget-accent)",
              borderRadius: "999px",
              padding: "5px 12px",
              cursor: backgroundUploading ? "default" : "pointer",
              opacity: backgroundUploading ? 0.6 : 1,
            }}
          >
            {backgroundUploading ? "Uploading..." : profile.hub_background_url ? "Replace photo" : "Upload photo"}
            <input
              type="file"
              accept="image/*"
              onChange={uploadHubBackground}
              disabled={backgroundUploading}
              style={{ display: "none" }}
            />
          </label>
          {profile.hub_background_url && (
            <button
              type="button"
              onClick={removeHubBackground}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--widget-text-faint)",
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          )}
          {backgroundError && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--widget-rose)" }}>
              {backgroundError}
            </span>
          )}
        </div>

        {/* Commons accent -- the Blue Key's door. Only ever appears once
            the key's actually held; the picker itself is the reward, not
            a setting anyone can reach on their own. See lib/keys.ts and
            app/api/keys/set-accent/route.ts. */}
        {keys.some((k) => k.key_color === "blue") && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
              marginBottom: "22px",
              padding: "0 4px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--widget-text-faint)",
              }}
            >
              Accent
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              {COMMONS_ACCENT_PALETTE.map((c) => {
                const isActive = profile?.commons_accent === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    aria-label={c.label}
                    aria-pressed={isActive}
                    onClick={() => chooseAccent(c.value)}
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      cursor: isActive ? "default" : "pointer",
                      padding: 0,
                      background: c.value,
                      border: isActive ? "2px solid var(--widget-accent)" : "2px solid transparent",
                      boxShadow: isActive ? "0 0 0 2px var(--widget-background), 0 0 0 3px rgba(201,161,90,0.4)" : "none",
                      transition: "box-shadow 0.2s ease",
                    }}
                  />
                );
              })}
            </div>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                color: "var(--widget-text-faint)",
                opacity: accentSaving ? 1 : 0,
                transition: "opacity 0.3s ease",
              }}
            >
              saving&hellip;
            </span>
          </div>
        )}

        {/* Keys -- silent until you've actually earned one. Nothing to
            configure, nothing to nag about; it just appears the first
            time it's real. See lib/keys.ts and PLAN.md. */}
        {keys.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
              marginBottom: "22px",
              padding: "0 4px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--widget-text-faint)",
              }}
            >
              Heart Strings
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              {keys.map((k) => {
                const info = KEY_INFO[k.key_color];
                if (!info) return null;
                const dot = (
                  <span
                    title={`${info.name} -- ${info.blurb}`}
                    style={{
                      width: "14px",
                      height: "14px",
                      borderRadius: "50%",
                      background: info.accent,
                      boxShadow: `0 0 8px ${info.accent}99`,
                      display: "inline-block",
                    }}
                  />
                );
                // Green's door is a whole page (see app/impact/page.tsx),
                // not an inline control like Blue's accent picker above --
                // so its dot is the one that's actually clickable.
                if (k.key_color === "green") {
                  return (
                    <Link
                      key={k.key_color}
                      href="/impact"
                      aria-label={`${info.name} -- open your Impact History`}
                    >
                      {dot}
                    </Link>
                  );
                }
                return <span key={k.key_color}>{dot}</span>;
              })}
            </div>

            {/* Monetization gate -- Rob's own design (see IDEAS.md's
                "Monetization: two-stage gate" entry). Holding all four
                Heart Strings only ever unlocks the *ability to apply*;
                applying only ever creates a pending row. Every decision
                is Rob's, made personally in /admin/monetization -- see
                lib/evolution.ts, lib/monetization.ts, and
                app/api/monetization/*. */}
            <div
              style={{
                marginTop: "10px",
                paddingTop: "10px",
                borderTop: "1px solid var(--widget-border)",
                width: "100%",
              }}
            >
              {!unlockedIds.has("monetization-eligible") ? (
                <p
                  title="Holding all four Heart Strings unlocks the ability to apply to monetize your account -- reviewed and approved individually, never automatic."
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                    letterSpacing: "0.04em",
                    color: "var(--widget-text-faint)",
                  }}
                >
                  {keys.length} of 4 Heart Strings -- hold all four to unlock the ability to apply to
                  monetize your account.
                </p>
              ) : monetizationStatus === "none" ? (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      letterSpacing: "0.04em",
                      color: "var(--widget-accent)",
                    }}
                  >
                    All four Heart Strings held -- you can apply to monetize your account.
                  </p>
                  <button
                    onClick={applyMonetization}
                    disabled={monetizationSubmitting}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "8px",
                      border: "1px solid var(--widget-accent)",
                      background: "none",
                      color: "var(--widget-accent)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    {monetizationSubmitting ? "Applying..." : "Apply"}
                  </button>
                </div>
              ) : monetizationStatus === "pending" ? (
                <p
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                    letterSpacing: "0.04em",
                    color: "var(--widget-text-faint)",
                  }}
                >
                  Your application to monetize is pending review.
                </p>
              ) : monetizationStatus === "approved" ? (
                <p
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                    letterSpacing: "0.04em",
                    color: "var(--widget-accent)",
                  }}
                >
                  You&rsquo;re approved to monetize your account.
                </p>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      letterSpacing: "0.04em",
                      color: "var(--widget-text-faint)",
                    }}
                  >
                    Your application wasn&rsquo;t approved this time.
                  </p>
                  <button
                    onClick={applyMonetization}
                    disabled={monetizationSubmitting}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "8px",
                      border: "1px solid var(--widget-text-faint)",
                      background: "none",
                      color: "var(--widget-text-faint)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    {monetizationSubmitting ? "Applying..." : "Apply again"}
                  </button>
                </div>
              )}
              {monetizationError && (
                <p
                  style={{
                    margin: "6px 0 0",
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                    color: "var(--widget-rose)",
                  }}
                >
                  {monetizationError}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Kindred Sparks -- people you might have something in common
            with, matched only on signals already public elsewhere on the
            site (Path, World Issues raised in the Exchange). See
            lib/kindredSparks.ts and IDEAS.md's "Kindred Sparks -- defined"
            entry. Every match always shows its plain-language reason;
            nothing here is ever a bare score. Sits right below Heart
            Strings, shown whenever there's at least one real match or the
            person has opted out (so the opt-out control is always
            reachable, not just when matches happen to exist). */}
        {(kindredMatches.length > 0 || profile?.kindred_opt_out) && (
          <div
            style={{
              marginBottom: "22px",
              padding: "14px 16px",
              borderRadius: "12px",
              border: "1px solid var(--widget-border)",
              background: "var(--widget-panel, transparent)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "8px",
                marginBottom: kindredMatches.length > 0 ? "10px" : 0,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--widget-text-faint)",
                }}
              >
                Kindred Sparks
              </span>
              <button
                onClick={toggleKindredOptOut}
                disabled={kindredOptOutSaving}
                style={{
                  padding: "3px 9px",
                  borderRadius: "8px",
                  border: "1px solid var(--widget-border)",
                  background: "none",
                  color: "var(--widget-text-faint)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "8px",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                {kindredOptOutSaving
                  ? "..."
                  : profile?.kindred_opt_out
                  ? "Opted out -- turn back on"
                  : "Don't include me"}
              </button>
            </div>
            {kindredMatches.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {kindredMatches.map((m) => (
                  <div
                    key={m.profile.id}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      background: "var(--widget-panel-soft, rgba(255,255,255,0.03))",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 3px",
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        color: "var(--widget-text)",
                      }}
                    >
                      {authorName(m.profile)}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontFamily: "var(--font-mono)",
                        fontSize: "9px",
                        letterSpacing: "0.02em",
                        color: "var(--widget-text-faint)",
                      }}
                    >
                      {m.reasons.join(" ")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lift Off -- the way out of the capsule and into the Galaxy. */}
        <button
          onClick={() => router.push("/galaxy")}
          className="liftoff-btn"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            background: "var(--widget-panel)",
            border: "1px solid var(--widget-accent)",
            borderRadius: "999px",
            padding: "14px 20px",
            color: "var(--widget-accent)",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "0.85rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            cursor: "pointer",
            marginBottom: "30px",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M50 6 L78 62 L50 48 L22 62 Z" fill="currentColor" fillOpacity="0.9" />
            <path d="M50 48 L50 94 L38 78 Z M50 48 L50 94 L62 78 Z" fill="currentColor" fillOpacity="0.5" />
          </svg>
          Lift off
        </button>

        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.05rem", marginBottom: "14px" }}>
          Your log
        </h2>

        <form
          onSubmit={addLogEntry}
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "18px",
          }}
        >
          <input
            value={logDraft}
            onChange={(e) => setLogDraft(e.target.value)}
            placeholder="Drop a thought, a win, a dream -- anything."
            maxLength={500}
            style={{
              flex: 1,
              minWidth: "200px",
              background: "var(--widget-panel)",
              border: "1px solid var(--widget-border)",
              borderRadius: "999px",
              padding: "10px 16px",
              color: "var(--widget-text)",
              fontFamily: "var(--font-body)",
              fontSize: "0.9rem",
            }}
          />
          <button
            type="submit"
            disabled={logSaving || !logDraft.trim()}
            style={{
              background: "var(--widget-accent)",
              border: "none",
              borderRadius: "999px",
              padding: "10px 20px",
              color: "var(--widget-background)",
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "0.82rem",
              cursor: logSaving || !logDraft.trim() ? "default" : "pointer",
              opacity: logSaving || !logDraft.trim() ? 0.6 : 1,
            }}
          >
            {logSaving ? "…" : "Log it"}
          </button>
        </form>
        {logError && (
          <p style={{ color: "var(--widget-rose)", fontSize: "0.82rem", marginTop: "-10px", marginBottom: "16px" }}>
            {logError}
          </p>
        )}

        {log.length === 0 ? (
          <p style={{ color: "var(--widget-text-dim)", fontStyle: "italic", fontFamily: "var(--font-body)" }}>
            Nothing logged yet. This is where it starts filling in.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
            {log.map((entry) => (
              <li key={entry.id} style={{ fontFamily: "var(--font-body)", fontSize: "0.94rem" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--widget-accent)", marginRight: "10px" }}>
                  {new Date(entry.occurred_at).toLocaleDateString()}
                </span>
                {entry.description}
                {entry.xp_awarded > 0 && (
                  <span style={{ color: "var(--widget-accent)", marginLeft: "8px" }}>+{entry.xp_awarded} XP</span>
                )}
              </li>
            ))}
          </ul>
        )}
            </div>
          </WidgetFrame>
        </div>

        <button
          onClick={signOut}
          style={{
            marginTop: "40px",
            background: "none",
            border: "none",
            color: "var(--ink-faint)",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
