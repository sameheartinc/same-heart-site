"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PageLoading from "@/components/PageLoading";
import {
  KEY_INFO,
  YELLOW_KEY_MIN_ARTICLES,
  listMySignalSuggestions,
  suggestSignalSource,
  type SignalSuggestion,
} from "@/lib/keys";

// The Yellow Heart String's door (see PLAN.md's Keys and Doors section,
// and lib/keys.ts). Unlike Green's /impact (a private keepsake) or
// Blue's accent picker (a personal setting), this one reaches outward:
// a holder can propose a real new source for the Signal everyone else
// reads too. It never touches feed_sources directly -- every
// suggestion lands as a pending row Rob reviews in /admin/signal (see
// app/api/signal/suggest and app/api/signal/decide) -- same "earned
// ability, human still gatekeeps anything that reaches everyone" shape
// as the monetization gate.
//
// Gated the same way /impact is: this check only controls what's
// *shown*. feed_source_suggestions' RLS already means nobody can read
// or write another profile's rows, and app/api/signal/suggest
// re-checks the Yellow key itself before ever writing one -- so
// there's nothing to fake here even without this page-level check.
export default function SignalPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasYellowKey, setHasYellowKey] = useState(false);
  const [articlesRead, setArticlesRead] = useState(0);
  const [suggestions, setSuggestions] = useState<SignalSuggestion[]>([]);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [topic, setTopic] = useState("world");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }

      const { count } = await supabase
        .from("signal_engagement")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", userData.user.id);
      setArticlesRead(count ?? 0);

      const { data: keyRows } = await supabase
        .from("profile_keys")
        .select("key_color")
        .eq("profile_id", userData.user.id)
        .eq("key_color", "yellow");

      const held = Boolean(keyRows && keyRows.length > 0);
      setHasYellowKey(held);

      if (held) {
        setSuggestions(await listMySignalSuggestions());
      }

      setChecking(false);
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);
    setSubmitting(true);

    const result = await suggestSignalSource(name, url, topic, note);

    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error ?? "Couldn't submit your suggestion right now.");
      return;
    }

    setName("");
    setUrl("");
    setTopic("world");
    setNote("");
    setFormSuccess(true);
    setSuggestions(await listMySignalSuggestions());
  }

  if (checking) return <PageLoading />;

  if (!hasYellowKey) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "var(--void)",
          color: "var(--ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 22px",
          fontFamily: "var(--font-body)",
        }}
      >
        <div style={{ maxWidth: "440px", textAlign: "center" }}>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-faint, #a29cb0)",
              marginBottom: "14px",
            }}
          >
            Locked
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "1.4rem",
              margin: "0 0 14px",
            }}
          >
            This page opens with the Yellow Heart String
          </h1>
          <p style={{ color: "var(--ink-dim)", lineHeight: 1.6, margin: "0 0 10px" }}>
            {KEY_INFO.yellow.blurb} Read {YELLOW_KEY_MIN_ARTICLES} different articles in the
            Signal on Commons, and this door opens: a real say in what the Signal fetches next.
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--gold)",
              margin: "0 0 22px",
            }}
          >
            {articlesRead} of {YELLOW_KEY_MIN_ARTICLES} read so far
          </p>
          <Link
            href="/commons"
            style={{
              color: "var(--gold)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            &larr; Back to Commons
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--void)",
        color: "var(--ink)",
        padding: "48px 22px 80px",
      }}
    >
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        <Link
          href="/hub"
          style={{
            color: "var(--gold)",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          &larr; Same Heart
        </Link>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.7rem",
            margin: "20px 0 6px",
          }}
        >
          Suggest a Signal Source
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--ink-dim)",
            maxWidth: "60ch",
            margin: "0 0 28px",
          }}
        >
          Earned by holding the Yellow Heart String -- you actually read the Signal, so you get a
          real say in what it fetches next. Every suggestion goes to Rob for a final look before
          it goes live for everyone; nothing here changes the Signal on its own.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            padding: "18px 20px",
            marginBottom: "28px",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            background: "var(--panel)",
          }}
        >
          <Field label="Source name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. High Country News"
              maxLength={80}
              required
              style={inputStyle}
            />
          </Field>
          <Field label="RSS feed URL">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/feed"
              maxLength={500}
              required
              style={inputStyle}
            />
          </Field>
          <Field label="Topic">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="world, solutions, ..."
              maxLength={40}
              style={inputStyle}
            />
          </Field>
          <Field label="Why this source? (optional)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={400}
              rows={3}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-body)" }}
            />
          </Field>

          {formError && (
            <p style={{ margin: 0, color: "var(--widget-rose, #d9503f)", fontSize: "0.85rem" }}>{formError}</p>
          )}
          {formSuccess && (
            <p style={{ margin: 0, color: "var(--gold)", fontSize: "0.85rem" }}>
              Sent to Rob for a look -- thank you.
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              alignSelf: "flex-start",
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid var(--gold)",
              background: "none",
              color: "var(--gold)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              cursor: submitting ? "default" : "pointer",
            }}
          >
            {submitting ? "Sending..." : "Suggest it"}
          </button>
        </form>

        <h2
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-faint, #a29cb0)",
            margin: "0 0 12px",
          }}
        >
          Your suggestions
        </h2>

        {suggestions.length === 0 ? (
          <p style={{ color: "var(--ink-faint, #a29cb0)", fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
            Nothing sent yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {suggestions.map((s) => (
              <div
                key={s.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  background: "var(--panel)",
                  padding: "12px 16px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>{s.name}</span>
                  <StatusBadge status={s.status} />
                </div>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    color: "var(--ink-faint, #a29cb0)",
                    wordBreak: "break-all",
                  }}
                >
                  {s.url}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--ink-faint, #a29cb0)",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: SignalSuggestion["status"] }) {
  const colors: Record<SignalSuggestion["status"], string> = {
    pending: "var(--ink-faint, #a29cb0)",
    approved: "var(--gold)",
    declined: "var(--widget-rose, #d9503f)",
  };
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "9px",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: colors[status],
      }}
    >
      {status}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  background: "var(--void)",
  color: "var(--ink)",
  fontFamily: "var(--font-mono)",
  fontSize: "0.85rem",
};
