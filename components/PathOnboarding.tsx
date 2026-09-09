"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AxisScores,
  INKBLOTS,
  InkblotOption,
  ONBOARDING_QUESTIONS,
  ORB_COLORS,
  OnboardingOption,
  OrbColorOption,
  TEXTURES,
  TextureOption,
  buildInkblotPath,
  scoreOnboarding,
} from "../lib/paths";
import { playSelectChime, playTextureSound } from "../lib/orbTones";

interface PathOnboardingProps {
  onComplete: (scores: AxisScores) => void;
}

type Stage = "color" | "texture" | "question" | "inkblot";

interface AmbientOrb {
  id: number;
  leftPct: number;
  topPct: number;
  size: number;
  duration: number;
  delay: number;
  dx: number;
  dy: number;
  colorIndex: number;
}

const AMBIENT_COUNT = 18;

// Generated client-side, after mount (see the effect below) rather than
// in useMemo -- Math.random() during the very first render would differ
// between the server's HTML and the client's hydration pass and React
// would flag a mismatch. An empty first paint for a few milliseconds,
// then the field fills in, is the standard safe way around that.
function generateAmbientOrbs(): AmbientOrb[] {
  return Array.from({ length: AMBIENT_COUNT }).map((_, i) => ({
    id: i,
    leftPct: 6 + Math.random() * 88,
    topPct: 8 + Math.random() * 78,
    size: 30 + Math.random() * 40,
    duration: 5 + Math.random() * 5,
    delay: Math.random() * -8,
    dx: (Math.random() - 0.5) * 46,
    dy: (Math.random() - 0.5) * 46,
    // Spread across the 8 colours without every orb of one colour
    // clustering by index -- a small fixed stride does the job without
    // needing a real shuffle.
    colorIndex: (i * 3 + 1) % ORB_COLORS.length,
  }));
}

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const TOTAL_STEPS = 2 + ONBOARDING_QUESTIONS.length + 1; // colour, texture, questions, inkblot

// Three quick sensory picks (a colour, a texture, an inkblot) wrapped
// around the three original questions -- everything feeds the same
// four-axis scoring in lib/paths.ts's scoreOnboarding. Rendered as one
// continuous drift rather than a form: a field of floating orbs the
// visitor touches, not a list of options they read.
export default function PathOnboarding({ onComplete }: PathOnboardingProps) {
  const [stage, setStage] = useState<Stage>("color");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [ambientOrbs, setAmbientOrbs] = useState<AmbientOrb[] | null>(null);
  const [pickedColor, setPickedColor] = useState<OrbColorOption | null>(null);
  const [pickedOrbId, setPickedOrbId] = useState<number | null>(null);
  const [pickedTexture, setPickedTexture] = useState<TextureOption | null>(null);
  const [questionAnswers, setQuestionAnswers] = useState<
    Array<OnboardingOption["weights"] | undefined>
  >([]);
  const [finishingInkblot, setFinishingInkblot] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setAmbientOrbs(generateAmbientOrbs());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const stepIndex =
    stage === "color"
      ? 0
      : stage === "texture"
      ? 1
      : stage === "question"
      ? 2 + questionIndex
      : TOTAL_STEPS - 1;

  const ambientHex = pickedColor?.hex ?? null;
  const ambientGlow = pickedColor?.glow ?? null;

  function chooseColor(option: OrbColorOption, orbId: number) {
    if (pickedColor) return;
    setPickedColor(option);
    setPickedOrbId(orbId);
    playSelectChime();
    window.setTimeout(() => setStage("texture"), 650);
  }

  function chooseTexture(option: TextureOption) {
    if (pickedTexture) return;
    setPickedTexture(option);
    playTextureSound(option.id);
    window.setTimeout(() => {
      setStage("question");
    }, 900);
  }

  function chooseQuestionOption(option: OnboardingOption) {
    const next = [...questionAnswers];
    next[questionIndex] = option.weights;
    setQuestionAnswers(next);
    playSelectChime();
    window.setTimeout(() => {
      if (questionIndex + 1 < ONBOARDING_QUESTIONS.length) {
        setQuestionIndex(questionIndex + 1);
      } else {
        setStage("inkblot");
      }
    }, 380);
  }

  function chooseInkblot(option: InkblotOption) {
    if (finishingInkblot) return;
    setFinishingInkblot(option.id);
    playSelectChime();
    window.setTimeout(() => {
      const allAnswers = [
        pickedColor?.weights,
        pickedTexture?.weights,
        ...questionAnswers,
        option.weights,
      ];
      onComplete(scoreOnboarding(allAnswers));
    }, reducedMotion ? 200 : 850);
  }

  const question = ONBOARDING_QUESTIONS[questionIndex];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "22px" }}>
      <style>{`
        @keyframes pathFloatDrift {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(var(--dx, 12px), var(--dy, 12px)); }
        }
        @keyframes pathOrbPulse {
          0% { transform: scale(1); }
          40% { transform: scale(1.55); }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes pathSquiggleOut {
          0%   { transform: scale(1) skew(0deg, 0deg); filter: blur(0px); opacity: 1; }
          20%  { transform: scale(1.05) skew(6deg, -4deg); filter: blur(0.5px); opacity: 1; }
          40%  { transform: scale(0.95) skew(-8deg, 5deg); filter: blur(1.5px); opacity: 0.85; }
          60%  { transform: scale(1.03) skew(7deg, -6deg); filter: blur(3px); opacity: 0.55; }
          80%  { transform: scale(0.88) skew(-5deg, 4deg); filter: blur(5px); opacity: 0.25; }
          100% { transform: scale(0.65) skew(0deg, 0deg); filter: blur(9px); opacity: 0; }
        }
        @keyframes pathFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .path-ambient-orb {
          animation-name: pathFloatDrift;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          transition: background 1.1s ease, box-shadow 1.1s ease, opacity 0.6s ease;
        }
        .path-ambient-orb.picking { cursor: pointer; }
        .path-orb-pulse { animation: pathOrbPulse 0.6s ease-out forwards; }
        .path-squiggle-out { animation: pathSquiggleOut 0.85s ease-in forwards; }
        .path-fade-up { animation: pathFadeUp 0.5s ease both; }
        @media (prefers-reduced-motion: reduce) {
          .path-ambient-orb { animation: none !important; }
          .path-orb-pulse { animation: none !important; opacity: 0 !important; }
          .path-squiggle-out { animation: none !important; opacity: 0 !important; transition: opacity 0.2s ease; }
        }
      `}</style>

      {/* Ambient field -- fixed to the viewport so it fills the whole
          screen regardless of how narrow the rest of this page's column
          is. Clickable only during the colour stage; a quiet, recoloured
          backdrop for every stage after. */}
      <div
        aria-hidden={stage !== "color"}
        style={{ position: "fixed", inset: 0, zIndex: 3, pointerEvents: "none", overflow: "hidden" }}
      >
        {ambientOrbs?.map((orb) => {
          const option = ORB_COLORS[orb.colorIndex];
          const hex = ambientHex ?? option.hex;
          const glow = ambientGlow ?? option.glow;
          const isPicking = stage === "color" && !pickedColor;
          return (
            <div
              key={orb.id}
              role={isPicking ? "button" : undefined}
              aria-label={isPicking ? `Choose ${option.id}` : undefined}
              onClick={isPicking ? () => chooseColor(option, orb.id) : undefined}
              className={`path-ambient-orb${isPicking ? " picking" : ""}`}
              style={
                {
                  position: "absolute",
                  left: `${orb.leftPct}%`,
                  top: `${orb.topPct}%`,
                  width: `${orb.size}px`,
                  height: `${orb.size}px`,
                  borderRadius: "50%",
                  background: `radial-gradient(circle at 35% 30%, ${withAlpha(
                    hex,
                    0.9
                  )}, ${withAlpha(hex, 0.35)} 70%)`,
                  boxShadow: `0 0 ${orb.size * 0.6}px ${glow}`,
                  pointerEvents: isPicking ? "auto" : "none",
                  opacity: stage === "inkblot" ? 0.35 : 1,
                  animationDuration: `${orb.duration}s`,
                  animationDelay: `${orb.delay}s`,
                  ["--dx" as string]: `${orb.dx}px`,
                  ["--dy" as string]: `${orb.dy}px`,
                } as React.CSSProperties
              }
            />
          );
        })}
        {pickedOrbId !== null && ambientOrbs && stage !== "color" && (
          <div
            className="path-orb-pulse"
            style={{
              position: "absolute",
              left: `${ambientOrbs.find((o) => o.id === pickedOrbId)?.leftPct ?? 50}%`,
              top: `${ambientOrbs.find((o) => o.id === pickedOrbId)?.topPct ?? 50}%`,
              width: "60px",
              height: "60px",
              marginLeft: "-30px",
              marginTop: "-30px",
              borderRadius: "50%",
              border: `2px solid ${pickedColor?.hex ?? "#fff"}`,
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* Progress -- one dot per pick across the whole flow, not just
          the three text questions. */}
      <div style={{ display: "flex", gap: "6px", position: "relative", zIndex: 4 }}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <span
            key={i}
            style={{
              width: "18px",
              height: "3px",
              borderRadius: "2px",
              background:
                i <= stepIndex ? pickedColor?.hex ?? "var(--gold)" : "rgba(255,255,255,0.15)",
              transition: "background 0.6s ease",
            }}
          />
        ))}
      </div>

      <div
        key={stage + questionIndex}
        className="path-fade-up"
        style={{
          position: "relative",
          zIndex: 4,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "22px",
          maxWidth: "560px",
          width: "100%",
        }}
      >
        {stage === "color" && (
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.2rem, 3.2vw, 1.6rem)",
              fontWeight: 600,
              textAlign: "center",
              margin: 0,
            }}
          >
            Touch the colour that feels like you.
          </p>
        )}

        {stage === "texture" && pickedColor && (
          <>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.2rem, 3.2vw, 1.6rem)",
                fontWeight: 600,
                textAlign: "center",
                margin: 0,
              }}
            >
              Touch the texture that sounds right.
            </p>
            <div style={{ display: "flex", gap: "22px", flexWrap: "wrap", justifyContent: "center" }}>
              {TEXTURES.map((texture) => (
                <TextureShape
                  key={texture.id}
                  texture={texture}
                  hex={pickedColor.hex}
                  onChoose={() => chooseTexture(texture)}
                  onPreview={() => playTextureSound(texture.id)}
                  disabled={Boolean(pickedTexture)}
                />
              ))}
            </div>
          </>
        )}

        {stage === "question" && pickedColor && question && (
          <>
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
                  onClick={() => chooseQuestionOption(option)}
                  className="path-ambient-orb"
                  style={
                    {
                      background: `linear-gradient(135deg, ${withAlpha(
                        pickedColor.hex,
                        0.32
                      )}, ${withAlpha(pickedColor.hex, 0.1)})`,
                      border: `1px solid ${withAlpha(pickedColor.hex, 0.5)}`,
                      borderRadius: "999px",
                      padding: "15px 24px",
                      color: "var(--ink)",
                      fontFamily: "var(--font-body)",
                      fontSize: "1rem",
                      textAlign: "left",
                      cursor: "pointer",
                      boxShadow: `0 0 20px ${withAlpha(pickedColor.hex, 0.18)}`,
                      animationDuration: `${5 + i * 0.6}s`,
                      animationDelay: `${-i * 1.4}s`,
                      ["--dx" as string]: `${(i % 2 === 0 ? 1 : -1) * 6}px`,
                      ["--dy" as string]: "8px",
                      transition: "transform 0.2s ease, border-color 0.2s ease",
                    } as React.CSSProperties
                  }
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = pickedColor.hex;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = withAlpha(pickedColor.hex, 0.5);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        )}

        {stage === "inkblot" && pickedColor && (
          <>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.2rem, 3.2vw, 1.6rem)",
                fontWeight: 600,
                textAlign: "center",
                margin: 0,
              }}
            >
              Which one feels closer?
            </p>
            <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", justifyContent: "center" }}>
              {INKBLOTS.map((blot) => (
                <button
                  key={blot.id}
                  onClick={() => chooseInkblot(blot)}
                  disabled={Boolean(finishingInkblot)}
                  aria-label="Choose this shape"
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    cursor: finishingInkblot ? "default" : "pointer",
                  }}
                >
                  <svg
                    width="86"
                    height="86"
                    viewBox="0 0 200 200"
                    className={finishingInkblot ? "path-squiggle-out" : undefined}
                    style={{
                      filter: `drop-shadow(0 0 12px ${withAlpha(pickedColor.hex, 0.35)})`,
                    }}
                  >
                    <path
                      d={buildInkblotPath(blot.radii)}
                      fill={withAlpha(pickedColor.hex, blot.id === finishingInkblot ? 0.85 : 0.55)}
                    />
                  </svg>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TextureShape({
  texture,
  hex,
  onChoose,
  onPreview,
  disabled,
}: {
  texture: TextureOption;
  hex: string;
  onChoose: () => void;
  onPreview: () => void;
  disabled: boolean;
}) {
  const base: React.CSSProperties = {
    width: "92px",
    height: "92px",
    borderRadius: "50%",
    cursor: disabled ? "default" : "pointer",
    transition: "transform 0.2s ease",
  };

  let shape: React.ReactNode;
  switch (texture.id) {
    case "smooth":
      shape = (
        <div
          style={{
            ...base,
            background: `radial-gradient(circle at 35% 30%, ${withAlpha(hex, 0.95)}, ${withAlpha(
              hex,
              0.4
            )} 75%)`,
            boxShadow: `0 0 30px ${withAlpha(hex, 0.45)}`,
          }}
        />
      );
      break;
    case "rippled":
      shape = (
        <div
          style={{
            ...base,
            background: `repeating-radial-gradient(circle at 50% 50%, ${withAlpha(
              hex,
              0.85
            )} 0px, ${withAlpha(hex, 0.85)} 4px, ${withAlpha(hex, 0.2)} 4px, ${withAlpha(
              hex,
              0.2
            )} 10px)`,
            boxShadow: `0 0 30px ${withAlpha(hex, 0.35)}`,
          }}
        />
      );
      break;
    case "woven":
      shape = (
        <div
          style={{
            ...base,
            background: `repeating-linear-gradient(45deg, ${withAlpha(hex, 0.75)} 0px, ${withAlpha(
              hex,
              0.75
            )} 4px, transparent 4px, transparent 9px),
              repeating-linear-gradient(-45deg, ${withAlpha(hex, 0.55)} 0px, ${withAlpha(
              hex,
              0.55
            )} 4px, transparent 4px, transparent 9px)`,
            backgroundColor: withAlpha(hex, 0.18),
            boxShadow: `0 0 30px ${withAlpha(hex, 0.35)}`,
          }}
        />
      );
      break;
    case "jagged":
      shape = (
        <div
          style={{
            ...base,
            borderRadius: "0",
            clipPath:
              "polygon(50% 0%, 61% 22%, 85% 12%, 78% 35%, 100% 43%, 78% 58%, 90% 82%, 64% 70%, 55% 96%, 45% 70%, 18% 82%, 32% 58%, 0% 48%, 24% 33%, 14% 10%, 40% 22%)",
            background: withAlpha(hex, 0.85),
            boxShadow: `0 0 24px ${withAlpha(hex, 0.55)}`,
          }}
        />
      );
      break;
  }

  return (
    <button
      onClick={onChoose}
      onMouseEnter={onPreview}
      disabled={disabled}
      aria-label={`${texture.label} -- ${texture.soundLabel}`}
      style={{ background: "transparent", border: "none", padding: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "scale(0.94)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {shape}
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.8rem",
          color: "var(--ink-dim)",
          textAlign: "center",
          maxWidth: "110px",
        }}
      >
        {texture.label}
        <br />
        <span style={{ fontStyle: "italic", fontSize: "0.72rem" }}>{texture.soundLabel}</span>
      </span>
    </button>
  );
}
