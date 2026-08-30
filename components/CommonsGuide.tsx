"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// The Commons Guide -- a small floating AI chat widget, only shown once
// someone's actually inside the Commons (not on the cinematic first-visit
// entrance). Talks to app/api/commons-guide/route.ts, which is the only
// place the Gemini API key or any real prompt logic lives -- this
// component just renders the conversation and sends what's typed.

interface GuideTurn {
  role: "user" | "guide";
  text: string;
}

const ACCENT = "#c9576a";

export default function CommonsGuide() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<GuideTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  async function send() {
    const message = input.trim();
    if (!message || sending) return;
    setError(null);
    setInput("");
    const nextTurns: GuideTurn[] = [...turns, { role: "user", text: message }];
    setTurns(nextTurns);
    setSending(true);
    scrollToBottom();

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setError("Sign in to talk to the Guide.");
        setSending(false);
        return;
      }

      const res = await fetch("/api/commons-guide", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ message, history: nextTurns.slice(0, -1) }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Something went wrong -- try again.");
      } else {
        setTurns((prev) => [...prev, { role: "guide", text: json.reply }]);
        scrollToBottom();
      }
    } catch {
      setError("Couldn't reach the Guide -- check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ position: "fixed", right: "20px", bottom: "20px", zIndex: 50 }}>
      {open && (
        <div
          style={{
            width: "min(340px, calc(100vw - 40px))",
            height: "min(440px, calc(100vh - 140px))",
            marginBottom: "12px",
            display: "flex",
            flexDirection: "column",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "0.9rem",
                color: ACCENT,
              }}
            >
              The Commons Guide
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{ background: "none", border: "none", color: "var(--ink-dim)", cursor: "pointer", fontSize: "1rem" }}
            >
              ✕
            </button>
          </div>

          <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {turns.length === 0 && (
              <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--ink-dim)", fontSize: "0.85rem", margin: 0 }}>
                Ask me anything about Same Heart -- Paths, Star Day, Skins,
                the Exchange, or what's happening in the Commons right now.
              </p>
            )}
            {turns.map((turn, i) => (
              <div
                key={i}
                style={{
                  alignSelf: turn.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  background: turn.role === "user" ? ACCENT : "var(--void)",
                  color: turn.role === "user" ? "#1a0d10" : "var(--ink)",
                  border: turn.role === "user" ? "none" : "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "8px 12px",
                  fontFamily: "var(--font-body)",
                  fontSize: "0.86rem",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {turn.text}
              </div>
            ))}
            {sending && (
              <div
                style={{
                  alignSelf: "flex-start",
                  color: "var(--ink-dim)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Thinking…
              </div>
            )}
            {error && (
              <div style={{ color: "#e0703a", fontFamily: "var(--font-body)", fontSize: "0.82rem" }}>{error}</div>
            )}
          </div>

          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", display: "flex", gap: "8px" }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask the Guide…"
              disabled={sending}
              style={{
                flex: 1,
                background: "var(--void)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "9px 12px",
                color: "var(--ink)",
                fontFamily: "var(--font-body)",
                fontSize: "0.85rem",
              }}
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !input.trim()}
              style={{
                background: ACCENT,
                border: "none",
                borderRadius: "10px",
                padding: "9px 14px",
                color: "#1a0d10",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "0.8rem",
                cursor: sending ? "default" : "pointer",
                opacity: sending || !input.trim() ? 0.6 : 1,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close the Commons Guide" : "Open the Commons Guide"}
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          border: "none",
          background: ACCENT,
          color: "#1a0d10",
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "1.3rem",
          cursor: "pointer",
          boxShadow: "0 8px 24px rgba(201,87,106,0.45)",
          float: "right",
        }}
      >
        {open ? "✕" : "✦"}
      </button>
    </div>
  );
}
