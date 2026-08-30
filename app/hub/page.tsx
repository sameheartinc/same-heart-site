"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { SKINS, getSkin, type SkinKey } from "@/lib/skins";
import { pickQuote, type Quote } from "@/lib/quotes";

type Profile = {
  display_name: string | null;
  designation: string | null;
  frequency: number | null;
  archetype: string | null;
  xp: number;
  standing: string;
  joined_at: string;
  ship_skin: string | null;
  signal_number: number | null;
};

type LogEntry = {
  id: string;
  occurred_at: string;
  description: string;
  xp_awarded: number;
};

export default function HubPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [skinSaving, setSkinSaving] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("display_name, designation, frequency, archetype, xp, standing, joined_at, ship_skin, signal_number")
        .eq("id", userData.user.id)
        .single();

      if (!profileData?.designation) {
        // Star Day hasn't been set yet -- send them there first.
        router.replace("/star-day");
        return;
      }

      const { data: logData } = await supabase
        .from("log_entries")
        .select("id, occurred_at, description, xp_awarded")
        .eq("profile_id", userData.user.id)
        .order("occurred_at", { ascending: false });

      setUserId(userData.user.id);
      setProfile(profileData as Profile);
      setLog((logData ?? []) as LogEntry[]);
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

  if (loading || !profile) return null;

  const dayNumber = Math.max(
    1,
    Math.floor((Date.now() - new Date(profile.joined_at).getTime()) / 86400000) + 1
  );

  const activeSkin = getSkin(profile.ship_skin);

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
        @media (prefers-reduced-motion: reduce) {
          .hub-quote { animation: none; }
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
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "18px",
            padding: "26px",
            marginBottom: "30px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "18px",
          }}
        >
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--gold)", marginBottom: "4px" }}>
              {profile.designation}
            </div>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.3rem", margin: "0 0 6px" }}>
              {profile.archetype}
            </h1>
            <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--ink-dim)", margin: "0 0 6px" }}>
              {profile.frequency}Hz &middot; {profile.standing} &middot; {profile.xp} XP
            </p>
            {profile.signal_number != null && (
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--ink-faint)",
                  margin: 0,
                }}
              >
                Signal No. {String(profile.signal_number).padStart(6, "0")}
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

        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "18px",
            padding: "22px",
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.05rem", margin: 0 }}>
              Skins
            </h2>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--ink-faint)",
                opacity: skinSaving ? 1 : 0,
                transition: "opacity 0.3s ease",
              }}
            >
              Saving&hellip;
            </span>
          </div>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontStyle: "italic",
              color: "var(--ink-dim)",
              fontSize: "0.88rem",
              margin: "0 0 18px",
            }}
          >
            Make the capsule yours. This changes how it looks for you --
            never your Standing, never your XP.
          </p>
          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
            {SKINS.map((s) => {
              const isActive = activeSkin.key === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => chooseSkin(s.key)}
                  aria-pressed={isActive}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "10px",
                    width: "150px",
                    padding: "12px",
                    borderRadius: "14px",
                    cursor: isActive ? "default" : "pointer",
                    background: s.vars["--void"],
                    border: isActive
                      ? `2px solid ${s.vars["--gold"]}`
                      : "2px solid transparent",
                    boxShadow: isActive ? `0 0 0 1px ${s.vars["--gold"]}55, 0 0 22px ${s.vars["--gold"]}33` : "none",
                    transition: "box-shadow 0.25s ease, border-color 0.25s ease, transform 0.15s ease",
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
                  onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  onTouchStart={() => {}}
                >
                  <div style={{ display: "flex", gap: "6px" }}>
                    <span
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        background: s.vars["--panel"],
                        border: `1px solid ${s.vars["--border"]}`,
                      }}
                    />
                    <span
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        background: s.vars["--gold"],
                      }}
                    />
                    <span
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        background: s.vars["--ink"],
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      color: s.vars["--ink"],
                    }}
                  >
                    {s.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-body)",
                      fontStyle: "italic",
                      fontSize: "0.72rem",
                      color: s.vars["--ink-dim"],
                      lineHeight: 1.3,
                    }}
                  >
                    {s.blurb}
                  </div>
                  {isActive && (
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "8px",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: s.vars["--gold"],
                      }}
                    >
                      Active
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.05rem", marginBottom: "14px" }}>
          Your log
        </h2>
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
            color: "var(--ink-faint, #5c6684)",
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
