"use client";

import { useEffect, useState } from "react";
import {
  AxisScores,
  ONBOARDING_QUESTION_COUNT,
  OnboardingOption,
  OnboardingQuestion,
  pickOnboardingQuestions,
  scoreOnboarding,
} from "../lib/paths";
import { playSelectChime } from "../lib/orbTones";

interface PathOnboardingProps {
  onComplete: (scores: AxisScores) => void;
}

// Rob, Nov 13 2026: "too many prompts...i dont really like the set up
// with the shapes and textures...more dynamic and simple, straightforward
// so people can get to the website faster." This used to be five picks
// (a colour, a texture, three questions) before handing off to the
// reveal; it's one question now, still drawn fresh each time from the
// ~100-question bank in lib/paths.ts so it doesn't repeat visit to
// visit, still feeding the same four-axis scoring (scoreOnboarding
// already normalizes by however many answers it's given, so dropping
// from 5 picks to 1 needed no changes there) blended with the live
// cursor-signal read the same as before. One tap and it's done --
// nothing else to touch, nothing to wait out.
export default function PathOnboarding({ onComplete }: PathOnboardingProps) {
  const [sessionQuestions, setSessionQuestions] = useState<OnboardingQuestion[] | null>(null);
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);

  // Lazy-filled after mount, same reason as everywhere else this
  // pattern shows up on the site: a random pick during the server's
  // first render wouldn't match the client's hydration pass.
  useEffect(() => {
    setSessionQuestions(pickOnboardingQuestions(ONBOARDING_QUESTION_COUNT));
  }, []);

  const question = sessionQuestions?.[0];

  function choose(option: OnboardingOption, index: number) {
    if (pickedIndex !== null) return;
    setPickedIndex(index);
    playSelectChime();
    window.setTimeout(() => onComplete(scoreOnboarding([option.weights])), 320);
  }

  if (!question) return null;

  return (
    <div
      className="path-fade-up"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "26px",
        maxWidth: "560px",
        width: "100%",
        margin: "0 auto",
      }}
    >
      <style>{`
        @keyframes pathFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .path-fade-up { animation: pathFadeUp 0.5s ease both; }
        .path-option { transition: transform 0.2s ease, border-color 0.2s ease, opacity 0.3s ease; }
        .path-option:not(:disabled):hover { transform: translateY(-2px); border-color: var(--gold) !important; }
        @media (prefers-reduced-motion: reduce) {
          .path-fade-up { animation: none; }
          .path-option:not(:disabled):hover { transform: none; }
        }
      `}</style>

      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(1.3rem, 3.5vw, 1.8rem)",
          fontWeight: 600,
          textAlign: "center",
          margin: 0,
        }}
      >
        {question.prompt}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
        {question.options.map((option, i) => (
          <button
            key={option.label}
            onClick={() => choose(option, i)}
            disabled={pickedIndex !== null}
            className="path-option"
            style={{
              background: "linear-gradient(135deg, rgba(201,161,90,0.3), rgba(201,161,90,0.08))",
              border: `1px solid ${pickedIndex === i ? "var(--gold)" : "rgba(201,161,90,0.4)"}`,
              borderRadius: "999px",
              padding: "16px 24px",
              color: "var(--ink)",
              fontFamily: "var(--font-body)",
              fontSize: "1rem",
              textAlign: "left",
              cursor: pickedIndex !== null ? "default" : "pointer",
              opacity: pickedIndex !== null && pickedIndex !== i ? 0.35 : 1,
              boxShadow: pickedIndex === i ? "0 0 24px rgba(201,161,90,0.4)" : "none",
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
