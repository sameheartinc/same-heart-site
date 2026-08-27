"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { SKINS, getSkin, type SkinKey } from "@/lib/skins";
import { pickQuote, type Quote } from "@/lib/quotes";
import { PATHS, type PathKey } from "@/lib/paths";

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
};

type LogEntry = {
  id: string;
  occurred_at: string;
  description: string;
  xp_awarded: number;
};

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
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [logDraft, setLogDraft] = useState("");
  const [logSaving, setLogSaving] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

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
          "display_name, designation, frequency, archetype, xp, standing, joined_at, ship_skin, path_key, spark_id"
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

      setUserId(userData.user.id);
      setProfile(profileData as Profile);
      setLog((logData ?? []) as LogEntry[]);
      setIsAnonymous(Boolean((userData.user as { is_anonymous?: boolean }).is_anonymous));
      // A fresh line every visit -- leans toward their archetype's own
      // lines when it has any, but never runs out either way.
      setQuote(pickQuote((profileData as Profile).archetype));
      setLoading(false);
    })();
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
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
  const path = profile.path_key ? PATHS[profile.path_key as PathKey] : null;
  const spark = sparkLabel(profile.spark_id);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--void)",
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
        @media (prefers-reduced-motion: reduce) {
          .hub-quote, .liftoff-btn { animation: none; }
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

        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
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
                color: "var(--gold)",
                marginBottom: "4px",
              }}
            >
              <span>{profile.designation}</span>
              {spark && <span style={{ color: "var(--ink-faint)" }}>&middot; {spark}</span>}
            </div>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.3rem", margin: "0 0 6px" }}>
              {profile.archetype}
            </h1>
            <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--ink-dim)", margin: 0 }}>
              {profile.frequency}Hz &middot; {profile.standing} &middot; {profile.xp} XP
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
          <div style={{ textAlign: "center", padding: "12px 20px", border: "1px solid var(--border)", borderRadius: "12px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.6rem", color: "var(--gold)" }}>
              {dayNumber}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--ink-faint)" }}>DAY</div>
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
              color: "var(--ink-faint)",
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
                  title={s.name}
                  aria-label={s.name}
                  aria-pressed={isActive}
                  onClick={() => chooseSkin(s.key)}
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    cursor: isActive ? "default" : "pointer",
                    padding: 0,
                    background: `linear-gradient(135deg, ${s.vars["--void"]} 50%, ${s.vars["--gold"]} 50%)`,
                    border: isActive ? `2px solid ${s.vars["--gold"]}` : "2px solid transparent",
                    boxShadow: isActive ? `0 0 0 2px var(--void), 0 0 0 3px ${s.vars["--gold"]}66` : "none",
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
              color: "var(--ink-faint)",
              opacity: skinSaving ? 1 : 0,
              transition: "opacity 0.3s ease",
            }}
          >
            saving&hellip;
          </span>
        </div>

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
            background: "var(--panel)",
            border: "1px solid var(--gold)",
            borderRadius: "999px",
            padding: "14px 20px",
            color: "var(--gold)",
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
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "999px",
              padding: "10px 16px",
              color: "var(--ink)",
              fontFamily: "var(--font-body)",
              fontSize: "0.9rem",
            }}
          />
          <button
            type="submit"
            disabled={logSaving || !logDraft.trim()}
            style={{
              background: "var(--gold)",
              border: "none",
              borderRadius: "999px",
              padding: "10px 20px",
              color: "var(--void)",
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
          <p style={{ color: "var(--rose)", fontSize: "0.82rem", marginTop: "-10px", marginBottom: "16px" }}>
            {logError}
          </p>
        )}

        {log.length === 0 ? (
          <p style={{ color: "var(--ink-dim)", fontStyle: "italic", fontFamily: "var(--font-body)" }}>
            Nothing logged yet. This is where it starts filling in.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
            {log.map((entry) => (
              <li key={entry.id} style={{ fontFamily: "var(--font-body)", fontSize: "0.94rem" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--gold)", marginRight: "10px" }}>
                  {new Date(entry.occurred_at).toLocaleDateString()}
                </span>
                {entry.description}
                {entry.xp_awarded > 0 && (
                  <span style={{ color: "var(--gold)", marginLeft: "8px" }}>+{entry.xp_awarded} XP</span>
                )}
              </li>
            ))}
          </ul>
        )}

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
