"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { ONBOARDING_WORLD } from "@/lib/worlds";
import WorldField from "@/components/WorldField";
import { GALAXY_NODES } from "@/lib/galaxyNodes";

// Position on a circle from an explicit angle (degrees) and radius (% of
// the stage). 0deg = due right, 90 = down, -90 = up, going clockwise.
// Letting each node carry its own angle/radius (instead of evenly
// spacing all five) is what makes some destinations sit close and bold
// while others sit small and far off, on purpose.
function orbitPosition(angleDeg: number, radiusPct: number) {
  const angle = (angleDeg * Math.PI) / 180;
  return {
    left: `${50 + Math.cos(angle) * radiusPct}%`,
    top: `${50 + Math.sin(angle) * radiusPct}%`,
  };
}

// A small ship silhouette standing in for the cursor -- same shape used
// for the ship reveal on /login, just re-colored and shrunk down. Applied
// only inside the Galaxy room, so it reads as "you're flying this thing"
// rather than a site-wide gimmick.
const SHIP_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 100 100'%3E%3Cpath d='M50 4 L79 63 L50 48 L21 63 Z' fill='%23f0d9a8' stroke='%23c9a15a' stroke-width='3'/%3E%3Cpath d='M50 48 L50 95 L37 77 Z M50 48 L50 95 L63 77 Z' fill='%23c9a15a' fill-opacity='0.55'/%3E%3C/svg%3E\") 15 6, auto";

const BASE_TILT_X = 28; // degrees -- the resting "looking down at the console" angle

export default function GalaxyPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [tilt, setTilt] = useState({ x: BASE_TILT_X, y: 0 });
  const reducedMotion = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setChecking(false);
    })();
  }, [router]);

  useEffect(() => {
    reducedMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // The whole console tilts a little further toward wherever the cursor
  // is -- small, capped range, so it reads as "responsive controls," not
  // motion sickness. Skipped entirely under reduced-motion.
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reducedMotion.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 .. 0.5
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      x: BASE_TILT_X + relY * -12,
      y: relX * 14,
    });
  }

  function handleMouseLeave() {
    setTilt({ x: BASE_TILT_X, y: 0 });
  }

  if (checking) return null;

  const ticks = Array.from({ length: 16 });

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: SHIP_CURSOR,
      }}
    >
      <WorldField world={ONBOARDING_WORLD} />

      <style>{`
        @keyframes galaxyCoreGlow {
          0%, 100% { filter: drop-shadow(0 0 14px rgba(201,161,90,0.4)); transform: scale(1); }
          50% { filter: drop-shadow(0 0 26px rgba(201,161,90,0.65)); transform: scale(1.04); }
        }
        @keyframes galaxyNodeIn {
          from { opacity: 0; transform: scale(0.6) translateZ(0); }
          to { opacity: var(--node-opacity, 1); transform: scale(1) translateZ(0); }
        }
        @keyframes galaxyNodeFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes galaxyRingSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes galaxyRingSpinReverse {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        .galaxy-core { animation: galaxyCoreGlow 4s ease-in-out infinite; }
        .galaxy-node-wrap {
          animation: galaxyNodeIn 0.6s ease both;
          cursor: inherit;
        }
        .galaxy-node-float {
          animation: galaxyNodeFloat 5s ease-in-out infinite;
        }
        .galaxy-ring-outer { animation: galaxyRingSpin 140s linear infinite; }
        .galaxy-ring-ticks { animation: galaxyRingSpinReverse 200s linear infinite; }
        .galaxy-node-inner {
          transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .galaxy-node:hover .galaxy-node-inner {
          transform: scale(1.22) translateY(-6px);
        }
        .galaxy-node:hover .galaxy-node-dot {
          box-shadow: 0 0 34px currentColor;
        }
        .galaxy-node:focus-visible .galaxy-node-inner {
          transform: scale(1.22) translateY(-6px);
          outline: none;
        }
        .galaxy-node-label { transition: color 0.28s ease; }
        .galaxy-node:hover .galaxy-node-label { color: var(--gold); }

        /* The node "star": a soft glowing orb tinted by each node's own
           accent color. Used to be a spinning multicolour rainbow disc --
           read as a bright, busy reflection rather than a calm glow, so
           this replaces it with a single-color pulse plus a warm core. */
        .galaxy-node-star {
          position: relative;
          overflow: hidden;
          isolation: isolate;
        }
        .galaxy-node-star::before {
          content: "";
          position: absolute;
          inset: -25%;
          border-radius: 50%;
          background: radial-gradient(circle at 50% 50%, var(--n-accent) 0%, transparent 70%);
          animation: galaxyNodeGlowPulse 4.5s ease-in-out infinite;
          mix-blend-mode: screen;
          opacity: 0.5;
        }
        .galaxy-node-star-core {
          position: absolute;
          inset: 20%;
          border-radius: 50%;
          background: radial-gradient(circle at 50% 50%, #fff9ec 0%, var(--n-accent) 55%, transparent 82%);
          opacity: 0.8;
        }
        @keyframes galaxyNodeGlowPulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%      { opacity: 0.6; transform: scale(1.1); }
        }
        .galaxy-node:hover .galaxy-node-star {
          box-shadow: 0 0 34px var(--n-accent);
        }

        /* Smaller hit-boxes on phones so nodes have real breathing room
           instead of crowding the center of the console. */
        @media (max-width: 480px) {
          .galaxy-node-wrap { width: 106px !important; height: 106px !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          .galaxy-core,
          .galaxy-node-wrap,
          .galaxy-node-float,
          .galaxy-ring-outer,
          .galaxy-ring-ticks,
          .galaxy-node-star::before { animation: none; }
        }
      `}</style>

      <Link
        href="/hub"
        style={{
          position: "absolute",
          top: "30px",
          left: "250px",
          zIndex: 2,
          color: "var(--ink-faint, #5c6684)",
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          textDecoration: "none",
          borderBottom: "1px solid transparent",
          cursor: "inherit",
        }}
      >
        &larr; Return to capsule
      </Link>

      <div
        ref={stageRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          position: "relative",
          zIndex: 1,
          width: "min(680px, 92vw)",
          aspectRatio: "1 / 1",
          perspective: "1400px",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformStyle: "preserve-3d",
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {/* Outer decorative ring -- an instrument-panel schematic, not a
              hitbox. Drifts slowly so the console feels alive at rest. */}
          <div
            aria-hidden="true"
            className="galaxy-ring-outer"
            style={{
              position: "absolute",
              inset: "6%",
              borderRadius: "50%",
              border: "1px solid rgba(201,161,90,0.12)",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "14%",
              borderRadius: "50%",
              border: "1px solid rgba(201,161,90,0.22)",
              pointerEvents: "none",
            }}
          />

          {/* Tick marks around the outer ring -- pure instrument-panel
              flavor, counter-rotating slowly against the outer ring. */}
          <div
            aria-hidden="true"
            className="galaxy-ring-ticks"
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            {ticks.map((_, i) => {
              const pos = orbitPosition((i / ticks.length) * 360 - 90, 49);
              return (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    left: pos.left,
                    top: pos.top,
                    width: "2px",
                    height: "8px",
                    background: "rgba(201,161,90,0.28)",
                    transform: "translate(-50%, -50%)",
                  }}
                />
              );
            })}
          </div>

          {/* Center -- decorative, not a link; the five nodes are the map. */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%) translateZ(40px)",
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mark.png"
              alt="Same Heart"
              className="galaxy-core"
              style={{ width: "56px", height: "auto" }}
            />
            <p
              style={{
                marginTop: "10px",
                fontFamily: "var(--font-display)",
                fontSize: "9px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--gold)",
              }}
            >
              Same Heart
            </p>
          </div>

          {GALAXY_NODES.map((node, i) => {
            const pos = orbitPosition(node.angleDeg, node.radiusPct);
            const opacity = node.dim ? 0.62 : 1;
            return (
              <Link
                key={node.key}
                href={node.href}
                className="galaxy-node galaxy-node-wrap"
                {...(node.external ? { target: "_blank", rel: "noreferrer" } : {})}
                style={{
                  position: "absolute",
                  left: pos.left,
                  top: pos.top,
                  width: "140px",
                  height: "140px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: "translate(-50%, -50%) translateZ(60px)",
                  textDecoration: "none",
                  animationDelay: `${0.15 * i}s`,
                  ["--node-opacity" as string]: opacity,
                  opacity,
                }}
              >
                <div
                  className="galaxy-node-inner galaxy-node-float"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: `${6 * node.scale}px`,
                    animationDelay: `${0.4 * i}s`,
                    transform: `scale(${node.scale})`,
                  }}
                >
                  <span
                    className="galaxy-node-dot galaxy-node-star"
                    style={{
                      width: "58px",
                      height: "58px",
                      borderRadius: "50%",
                      // Was a near-black disc (#050810) so each node's
                      // colored glow popped against a dark sky. Against
                      // the heavenly light sky that read as a dark hole
                      // instead of a glowing orb, so the base is now a
                      // warm, bright light-source color instead.
                      background: "#fef6e4",
                      border: `1px solid ${node.accent}`,
                      boxShadow: `0 0 ${node.dim ? 10 : 18}px ${node.accent}${node.dim ? "33" : "44"}`,
                      transition: "box-shadow 0.28s ease",
                      ["--n-accent" as string]: node.accent,
                    }}
                  >
                    <span className="galaxy-node-star-core" aria-hidden="true" />
                    {node.icon === "dodecahedron" && (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        width="26"
                        height="26"
                        style={{ position: "absolute", inset: 0, margin: "auto", color: node.accent }}
                      >
                        {/* A flat dodecahedron glyph: an outer and inner
                            pentagon with their corners joined, the usual
                            shorthand for a 12-sided form in line-art icon
                            sets -- reads clearly at this size, unlike a
                            true 3D projection would. */}
                        <polygon
                          points="12,2 21,9 17.5,20 6.5,20 3,9"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          strokeLinejoin="round"
                        />
                        <polygon
                          points="12,7.5 15.5,10.2 14.2,14.5 9.8,14.5 8.5,10.2"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinejoin="round"
                          opacity={0.85}
                        />
                        <line x1="12" y1="2" x2="12" y2="7.5" stroke="currentColor" strokeWidth="0.8" opacity={0.7} />
                        <line x1="21" y1="9" x2="15.5" y2="10.2" stroke="currentColor" strokeWidth="0.8" opacity={0.7} />
                        <line x1="17.5" y1="20" x2="14.2" y2="14.5" stroke="currentColor" strokeWidth="0.8" opacity={0.7} />
                        <line x1="6.5" y1="20" x2="9.8" y2="14.5" stroke="currentColor" strokeWidth="0.8" opacity={0.7} />
                        <line x1="3" y1="9" x2="8.5" y2="10.2" stroke="currentColor" strokeWidth="0.8" opacity={0.7} />
                      </svg>
                    )}
                  </span>
                  <span
                    className="galaxy-node-label"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      fontSize: "0.8rem",
                      color: "var(--ink)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {node.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontStyle: "italic",
                      fontSize: "0.7rem",
                      color: "var(--ink-dim)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {node.tagline}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
