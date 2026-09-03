"use client";

import { useState } from "react";

interface FinderCategoryInfo {
  id: string;
  title: string;
}

interface SupportFinderProps {
  categories: FinderCategoryInfo[];
}

// Deliberately simple, deterministic keyword matching -- never an AI
// call, never anything sent over the network. Someone in a hard moment
// deserves a fast, transparent way to jump to the right list below, not
// a system trying to interpret or respond to what they've written.
// Nothing typed here is stored, logged, or visible to anyone else -- it
// only ever lives in this browser tab's memory, gone the moment the
// page closes or refreshes.
//
// Safety ordering: if crisis language shows up at all, alongside
// anything else in the same message, crisis support is always the
// answer -- never averaged against or outscored by another topic.
const KEYWORDS: Record<string, string[]> = {
  crisis: [
    "suicide", "suicidal", "kill myself", "end my life", "end it all",
    "want to die", "wanting to die", "don't want to live",
    "dont want to live", "self harm", "self-harm", "hurt myself",
    "hurting myself", "cutting myself", "no reason to live",
    "can't go on", "cant go on", "hopeless", "ending it",
    "not worth living", "better off dead",
  ],
  "domestic-violence": [
    "abuse", "abusive", "hits me", "hitting me", "hurts me physically",
    "domestic violence", "afraid of my partner", "scared of my partner",
    "controlling partner", "violence at home", "beats me", "beating me",
    "scared of my husband", "scared of my wife", "stalking me",
    "trafficked", "human trafficking",
  ],
  "substance-use": [
    "drugs", "drug use", "drinking too much", "alcohol", "addiction",
    "addicted", "relapse", "relapsed", "overdose", "substance abuse",
    "using again", "can't stop using", "cant stop using", "withdrawal",
    "getting sober", "high all the time",
  ],
  lgbtq: [
    "lgbtq", "lgbt", "gay", "lesbian", "trans", "transgender", "bisexual",
    "queer", "coming out", "gender identity", "non-binary", "nonbinary",
  ],
  indigenous: [
    "indigenous", "first nations", "inuit", "metis", "native community",
    "residential school",
  ],
  general: [
    "lonely", "so alone", "feel alone", "lost", "don't know where to turn",
    "dont know where to turn", "need help", "overwhelmed", "stressed",
    "anxious", "depressed", "sad", "struggling",
    "need someone to talk to", "no one to talk to",
  ],
};

export default function SupportFinder({ categories }: SupportFinderProps) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);

  const titleById = Object.fromEntries(categories.map((c) => [c.id, c.title]));

  function findHelp(e: React.FormEvent) {
    e.preventDefault();
    const text = input.toLowerCase();
    const scores: Record<string, number> = {};
    for (const [id, words] of Object.entries(KEYWORDS)) {
      scores[id] = words.filter((w) => text.includes(w)).length;
    }
    // Crisis language always wins, regardless of score -- see the note
    // above KEYWORDS. Everything else just goes to whichever category
    // matched the most; a message with nothing recognizable at all gets
    // an honest "couldn't tell" instead of a guess.
    let best: string | null = null;
    if (scores.crisis > 0) {
      best = "crisis";
    } else {
      let topScore = 0;
      for (const [id, score] of Object.entries(scores)) {
        if (score > topScore) {
          topScore = score;
          best = id;
        }
      }
    }
    setResult(best);
    setAsked(true);
  }

  function goToCategory(id: string) {
    document.getElementById(`category-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div
      style={{
        position: "relative",
        background: "var(--panel)",
        border: "1px solid var(--gold)",
        borderRadius: "16px",
        padding: "18px 20px",
        marginBottom: "36px",
      }}
    >
      <p
        style={{
          margin: "0 0 10px",
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "1rem",
          color: "var(--gold)",
        }}
      >
        What are you feeling?
      </p>
      <form onSubmit={findHelp}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Write as much or as little as you want..."
          rows={2}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            background: "var(--void)",
            color: "var(--ink)",
            fontFamily: "var(--font-body)",
            fontSize: "0.9rem",
            marginBottom: "10px",
            resize: "vertical",
          }}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          style={{
            padding: "9px 16px",
            borderRadius: "999px",
            border: "none",
            background: "var(--gold)",
            color: "#1a0d10",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "0.82rem",
            cursor: input.trim() ? "pointer" : "default",
            opacity: input.trim() ? 1 : 0.6,
          }}
        >
          Find help
        </button>
      </form>

      {asked && (
        <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--border)" }}>
          {result ? (
            <>
              <p style={{ margin: "0 0 10px", fontFamily: "var(--font-body)", fontSize: "0.9rem", color: "var(--ink-dim)" }}>
                Based on what you shared, this looks most related to:
              </p>
              <button
                type="button"
                onClick={() => goToCategory(result)}
                style={{
                  padding: "9px 16px",
                  borderRadius: "999px",
                  border: "1px solid var(--gold)",
                  background: "none",
                  color: "var(--gold)",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                {titleById[result]} &darr;
              </button>
              {result === "crisis" && (
                <p style={{ margin: "12px 0 0", fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--ink-dim)" }}>
                  If you&rsquo;re in immediate danger, call{" "}
                  <a href="tel:911" style={{ color: "var(--gold)", fontWeight: 700 }}>
                    911
                  </a>{" "}
                  first.
                </p>
              )}
            </>
          ) : (
            <p style={{ margin: 0, fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "0.88rem", color: "var(--ink-dim)" }}>
              Nothing here quite matched that -- the full list below covers a lot of
              ground, and 211 (further down, under General help &amp; referrals) is a
              good place to start if nothing else fits.
            </p>
          )}
        </div>
      )}

      <p
        style={{
          margin: "14px 0 0",
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          letterSpacing: "0.03em",
          color: "var(--ink-faint, #5c6684)",
        }}
      >
        Nothing you type here is saved, sent anywhere, or seen by anyone -- it only
        helps point you to the right list below.
      </p>
    </div>
  );
}
