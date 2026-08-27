"use client";

import { useState } from "react";
import { AxisScores, ONBOARDING_QUESTIONS, OnboardingOption } from "../lib/paths";
import { scoreOnboarding } from "../lib/paths";

interface PathOnboardingProps {
  onComplete: (scores: AxisScores) => void;
}

// Three quick picks, one screen at a time. Reads as a mood check, feeds
// the path-scoring engine in lib/paths.ts underneath.
export default function PathOnboarding({ onComplete }: PathOnboardingProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Array<OnboardingOption["weights"] | undefined>>(
    []
  );

  function choose(option: OnboardingOption) {
    const next = [...answers];
    next[step] = option.weights;
    setAnswers(next);
    if (step + 1 < ONBOARDING_QUESTIONS.length) {
      setStep(step + 1);
    } else {
      onComplete(scoreOnboarding(next));
    }
  }

  const question = ONBOARDING_QUESTIONS[step];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "22px",
        maxWidth: "560px",
        margin: "0 auto",
      }}
    >
      <div style={{ display: "flex", gap: "6px" }}>
        {ONBOARDING_QUESTIONS.map((q, i) => (
          <span
            key={q.id}
            style={{
              width: "22px",
              height: "3px",
              borderRadius: "2px",
              background: i <= step ? "var(--gold)" : "rgba(255,255,255,0.15)",
              transition: "background 0.4s ease",
            }}
          />
        ))}
      </div>

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

      <div
        style={{
          display: "grid",
          gap: "10px",
          width: "100%",
        }}
      >
        {question.options.map((option) => (
          <button
            key={option.label}
            onClick={() => choose(option)}
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border, #313f5e)",
              borderRadius: "14px",
              padding: "14px 18px",
              color: "var(--ink)",
              fontFamily: "var(--font-body)",
              fontSize: "1rem",
              textAlign: "left",
              cursor: "pointer",
              transition: "border-color 0.2s ease, transform 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--gold)";
              e.currentTarget.style.transform = "translateX(2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border, #313f5e)";
              e.currentTarget.style.transform = "translateX(0)";
            }}
            onTouchStart={() => {}}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
