"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { ONBOARDING_WORLD } from "@/lib/worlds";
import WorldField from "@/components/WorldField";
import { GALAXY_NODES } from "@/lib/galaxyNodes";
import { tapHeartWithServer } from "@/lib/heartTap";

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

// Rob, Sep 3 2026: "10x its currently tilt," then "bolder," then
// "tone back... just a little too aggressive" once the bolder version
// was live. Sep 5 2026: first cut (20% of the settled -140/160 -->
// -28/32, base left at 40deg) was STILL too extreme -- rolled all the
// way back to the original pre-10x values here: 28deg base, -12/14
// sensitivity. If this needs to move again, treat this as the new
// zero point rather than cutting the escalated numbers further.
const BASE_TILT_X = 28; // degrees -- the resting "looking down at the console" angle
const TILT_X_RANGE: [number, number] = [8, 70];
const TILT_Y_RANGE: [number, number] = [-65, 65];

function clampTilt(value: number, [min, max]: [number, number]) {
  return Math.min(max, Math.max(min, value));
}

// Rob, Sep 9 2026: "on the mobile app the icons in galaxy seem to lump
// together... is there a way we can evenly spread out the icons." The
// per-node angleDeg/radiusPct in lib/galaxyNodes.ts is deliberately NOT
// even -- Hearth (120deg/r41), Wallet (150deg/r46) and the Arcade
// (180deg/r50) all sit within one 60deg arc at nearly the same
// distance from center, which reads fine as "visual weight" on a wide
// desktop stage but genuinely overlaps once that same stage shrinks to
// ~92vw on a phone. Rather than touch the hand-tuned desktop layout
// (or the "NOT evenly spaced anymore" design decision behind it),
// this only kicks in under the same 480px breakpoint the node-wrap
// hitbox already shrinks at: below it, every node's angle/radius/scale
// is overridden to a plain, genuinely even ring (360 / node count
// apart, one shared radius, one shared scale) instead of its own
// hand-placed values. Same MOBILE_QUERY string as the CSS media query
// further down, so both stay in lockstep.
const MOBILE_QUERY = "(max-width: 480px)";
const MOBILE_RADIUS_PCT = 40;
const MOBILE_SCALE = 0.78;
// Rob's follow-up (Sep 9 2026, from a real screenshot): the ring itself
// sat visibly right-of-center on his phone -- The Merch Ship and part
// of the Wallet clipped off the right edge while the left side had
// room to spare. The stage is centered by plain flexbox
// (justifyContent: center on <main>), so this is most likely mobile
// Safari's 92vw-is-wider-than-the-real-visible-viewport quirk pushing
// the extra width out to the right. Rather than chase that down,
// nudging the whole stage left by a flat amount on mobile fixes the
// visible symptom directly. Desktop untouched. Started at -32, Rob
// reported still needed more -- moved to -56.
const MOBILE_SHIFT_X = -56;

export default function GalaxyPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [tilt, setTilt] = useState({ x: BASE_TILT_X, y: 0 });
  const reducedMotion = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  // Starts false (matches what a server render would assume, same
  // reasoning as PathOnboarding's post-mount orb field) and is only
  // ever flipped by the matchMedia listener below, so there's no
  // server/client hydration mismatch here even though the real answer
  // depends on viewport width.
  const [isMobile, setIsMobile] = useState(false);

  // The Same Heart mark's secret tap bonus (Sep 9 2026, Rob's idea --
  // see lib/heartTap.ts and app/api/galaxy/heart-tap/route.ts for the
  // rest of it). heartParticles is purely cosmetic -- every tap adds a
  // few, each one removes itself once its CSS animation finishes (see
  // handleHeartTap below), capped to the last 40 so a long tapping
  // spree can't grow this list forever. tapThreshold is picked fresh,
  // randomly, once per page load (never re-rendered as text, so unlike
  // the mobile-viewport state above there's no hydration concern in
  // picking it this way) -- "a bunch" of taps, not a fixed, guessable
  // number. secretFired guards the one server call per visit; nothing
  // here ever reveals whether today's bonus was already claimed --
  // that's entirely the server's call (see the route).
  const [heartParticles, setHeartParticles] = useState<{ id: number; dx: number; dy: number; rot: number }[]>([]);
  const [bonusFlash, setBonusFlash] = useState<string | null>(null);
  const heartIdRef = useRef(0);
  const tapCountRef = useRef(0);
  const secretFiredRef = useRef(false);
  // Rob, Sep 9 2026, after trying it live: "maybe like 20" -- was
  // 10-16, now centered there instead (17-23).
  const [tapThreshold] = useState(() => 17 + Math.floor(Math.random() * 7));

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // The whole console tilts toward wherever the cursor is, clamped (see
  // TILT_X_RANGE/TILT_Y_RANGE above) so a full corner-to-corner mouse
  // sweep leans the console noticeably without ever tipping it past
  // vertical into a broken-looking flip. Skipped entirely under
  // reduced-motion.
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reducedMotion.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 .. 0.5
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      x: clampTilt(BASE_TILT_X + relY * -12, TILT_X_RANGE),
      y: clampTilt(relX * 14, TILT_Y_RANGE),
    });
  }

  function handleMouseLeave() {
    setTilt({ x: BASE_TILT_X, y: 0 });
  }

  // Every tap: a few little hearts fly off, always, no server call --
  // pure delight, uncapped. Only once this VISIT's tap count crosses
  // its own (randomly picked, see tapThreshold above) threshold does
  // this attempt the real, secret, once-a-day XP roll -- and even then
  // only once, ever, per page load (secretFiredRef), so holding the
  // mark down doesn't spam the server. Nothing here ever shows if that
  // roll was rejected as already-claimed-today -- see handleSecretTap.
  function handleHeartTap() {
    const burst = Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => ({
      id: heartIdRef.current++,
      dx: Math.round((Math.random() - 0.5) * 70),
      dy: Math.round(-46 - Math.random() * 44),
      rot: Math.round((Math.random() - 0.5) * 55),
    }));
    setHeartParticles((prev) => [...prev.slice(-40), ...burst]);

    tapCountRef.current += 1;
    if (!secretFiredRef.current && tapCountRef.current >= tapThreshold) {
      secretFiredRef.current = true;
      attemptSecretBonus();
    }
  }

  async function attemptSecretBonus() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const result = await tapHeartWithServer(token);
    if (result?.awarded && typeof result.xp === "number") {
      setBonusFlash(`+${result.xp} XP`);
      setTimeout(() => setBonusFlash(null), 2200);
    }
    // result.awarded === false (already claimed today) or a failed
    // call both fall through to here doing nothing on screen -- the
    // whole point is a tap never explains itself either way.
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
          50% { transform: translateY(var(--float-amp, -6px)); }
        }
        @keyframes galaxyIconFlicker {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
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
        /* The Same Heart mark's secret tap bonus, Sep 9 2026 -- see
           handleHeartTap in the component. A discrete, short (900ms),
           user-triggered reaction rather than continuous ambient
           motion, so this is deliberately left out of the
           prefers-reduced-motion block further down, same reasoning a
           "like" button's burst usually is. --hx/--hy/--hr come from
           each particle's own inline style (randomized per tap). */
        .galaxy-heart-particle {
          position: absolute;
          left: 50%;
          top: 30%;
          pointer-events: none;
          font-size: 13px;
          color: #ff6f91;
          transform: translate(-50%, -50%);
          animation: galaxyHeartFloat 900ms ease-out forwards;
        }
        @keyframes galaxyHeartFloat {
          0% { opacity: 0.9; transform: translate(-50%, -50%) scale(0.5) rotate(0deg); }
          15% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(calc(var(--hr, 0deg) * 0.2)); }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + var(--hx, 0px)), calc(-50% + var(--hy, -60px))) scale(0.55) rotate(var(--hr, 0deg));
          }
        }
        /* Rob, Sep 9 2026, after trying the bare-text version live:
           "maybe no flash... just a little bubble that shows the xp
           gained." Rebuilt as an actual rounded chip (background,
           border, padding) instead of plain glowing text floating in
           open space -- same gold accent, same gentle rise-and-fade,
           just contained in something instead of bare on the page. */
        .galaxy-bonus-flash {
          position: absolute;
          left: 50%;
          top: -14px;
          transform: translate(-50%, 0);
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(20, 15, 6, 0.82);
          border: 1px solid rgba(201,161,90,0.55);
          box-shadow: 0 0 14px rgba(201,161,90,0.4);
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.04em;
          color: var(--gold);
          pointer-events: none;
          white-space: nowrap;
          animation: galaxyBonusFlash 2.2s ease-out forwards;
        }
        @keyframes galaxyBonusFlash {
          0% { opacity: 0; transform: translate(-50%, 6px) scale(0.85); }
          15% { opacity: 1; transform: translate(-50%, -4px) scale(1); }
          75% { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -22px) scale(1); }
        }
        .galaxy-node-wrap {
          animation: galaxyNodeIn 0.6s ease both;
          cursor: inherit;
        }
        /* Duration and amplitude come from each node's own inline
           --float-duration/--float-amp (see the per-node map below) --
           Rob's "more modular play": every node used to share this
           exact 5s rhythm with only a start-delay offset, so they'd
           stay locked in the same relative phase forever and read as
           one wave passing through a fixed formation rather than
           independent things quietly alive on their own. */
        .galaxy-node-float {
          animation: galaxyNodeFloat var(--float-duration, 5s) ease-in-out infinite;
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
          /* Rob, Sep 9 2026: "a faded coloured square that stretches
             slightly past the circle." overflow: hidden + border-radius
             is supposed to clip the ::before glow below to a circle, but
             combined with mix-blend-mode it's a known Safari bug where
             that clipping can leak a faint square past the rounded
             corners on exactly this kind of blended, blurred content.
             clip-path is respected far more reliably here -- this is the
             actual fix, overflow: hidden stays only as a harmless
             belt-and-braces for non-Safari browsers. */
          clip-path: circle(50%);
          /* Lets the icon's rotateY/rotateX spin (see .galaxy-node-icon
             below) read as real depth rather than a flat squash. */
          perspective: 600px;
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
        /* Small specular highlight, Sep 9 2026 -- Rob asked for the
           orbs to read as more three-dimensional. A soft bright patch
           held near the top-left (not centered, not animated) is the
           classic "glossy sphere" cue -- paired with the matching
           off-center core gradient below and the inset shadows on the
           orb's own inline boxShadow (see the JSX), all three point at
           the same light source rather than fighting each other. */
        .galaxy-node-star::after {
          content: "";
          position: absolute;
          top: 13%;
          left: 17%;
          width: 34%;
          height: 22%;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 78%);
          pointer-events: none;
        }
        .galaxy-node-star-core {
          position: absolute;
          inset: 20%;
          border-radius: 50%;
          /* Off-center (was 50% 50%) -- a centered glow reads as a flat
             pulse; pulling the bright point toward the same top-left
             corner as the specular highlight above reads as one lit
             sphere instead. */
          background: radial-gradient(circle at 33% 30%, #fff9ec 0%, var(--n-accent) 58%, transparent 82%);
          opacity: 0.8;
        }
        @keyframes galaxyNodeGlowPulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%      { opacity: 0.6; transform: scale(1.1); }
        }
        .galaxy-node:hover .galaxy-node-star {
          box-shadow: 0 0 34px var(--n-accent);
        }

        /* The polyhedron glyphs (dodecahedron/icosahedron) inside each
           node's orb -- a slow, continuous spin for as long as the
           pointer stays over the node, not just a one-time flip. Uses
           rotateY/rotateX (paired with the perspective on
           .galaxy-node-star above) rather than a flat 2D rotate(), so
           the shape actually tumbles in depth -- the back face mirrors
           through by default (no separate back-face art needed), which
           reads fine for a simple line-art glyph like this. */
        .galaxy-node-icon {
          transform-origin: 50% 50%;
          /* Started at a barely-there 0.88-1 opacity swing; Rob asked
             for bolder, so this now dips much further (0.55-1) on a
             quicker ~2.6s cycle -- a real, noticeable pulse rather than
             a faint shimmer. Each icon's own inline animation-delay
             (set where it's rendered below) still staggers the phase so
             all eight never flicker in unison. Already covered by the
             prefers-reduced-motion rule further down, same as every
             other animation on this page. */
          animation: galaxyIconFlicker 2.6s ease-in-out infinite;
        }
        .galaxy-node:hover .galaxy-node-icon {
          animation: galaxyIconSpin 2.4s linear infinite;
        }
        @keyframes galaxyIconSpin {
          0%   { transform: rotateY(0deg) rotateX(0deg); }
          50%  { transform: rotateY(180deg) rotateX(18deg); }
          100% { transform: rotateY(360deg) rotateX(0deg); }
        }

        /* Smaller hit-boxes on phones so nodes have real breathing room
           instead of crowding the center of the console. Shrunk again
           (106px -> 82px, Sep 9 2026) alongside the even mobile ring
           above -- at 106px, neighboring nodes' invisible tap targets
           still overlapped even once their visible orbs no longer did,
           which could steal a tap meant for the node next door. 82px
           stays comfortably above typical minimum touch-target
           guidance while actually clearing its neighbors. */
        @media (max-width: 480px) {
          .galaxy-node-wrap { width: 82px !important; height: 82px !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          .galaxy-core,
          .galaxy-node-wrap,
          .galaxy-node-float,
          .galaxy-ring-outer,
          .galaxy-ring-ticks,
          .galaxy-node-icon,
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
          transform: isMobile ? `translateX(${MOBILE_SHIFT_X}px)` : undefined,
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

          {/* Center -- not a link (the five/eight nodes are the map),
              but tappable (see handleHeartTap above): a small, entirely
              unannounced easter egg. Desktop keeps its Sep 3 2026 nudge
              up-and-left of true center per Rob's request at the time;
              on mobile Rob asked for it centered instead (Sep 9 2026,
              "its way to the upper left") -- left/top stay at 50%/50%
              either way so orbitPosition's own math (and every node
              position built on it) is untouched; the offset lives only
              in this element's own transform. */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: isMobile
                ? "translate(-50%, -50%) translateZ(40px)"
                : "translate(calc(-50% - 26px), calc(-50% - 22px)) translateZ(40px)",
              textAlign: "center",
            }}
          >
            <button
              type="button"
              onClick={handleHeartTap}
              aria-label="Same Heart"
              style={{
                position: "relative",
                background: "none",
                border: "none",
                padding: 0,
                margin: 0,
                cursor: "inherit",
                font: "inherit",
                color: "inherit",
                outline: "none",
                // Rob, Sep 9 2026: "the screen had a square box come
                // up" on mobile -- that's Safari/Chrome's own default
                // tap-highlight rectangle, which every plain <button>
                // gets for free unless told otherwise. Wasn't there
                // before because this used to be a plain, non-
                // interactive div. touchAction: manipulation also
                // skips the ~300ms double-tap-to-zoom delay some
                // mobile browsers still apply to tappable elements.
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/mark.png"
                alt=""
                className="galaxy-core"
                style={{ width: "56px", height: "auto" }}
              />
              <span
                style={{
                  display: "block",
                  marginTop: "10px",
                  fontFamily: "var(--font-display)",
                  fontSize: "9px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--gold)",
                }}
              >
                Same Heart
              </span>
              {heartParticles.map((h) => (
                <span
                  key={h.id}
                  aria-hidden="true"
                  className="galaxy-heart-particle"
                  style={{
                    ["--hx" as string]: `${h.dx}px`,
                    ["--hy" as string]: `${h.dy}px`,
                    ["--hr" as string]: `${h.rot}deg`,
                  }}
                  onAnimationEnd={() => setHeartParticles((prev) => prev.filter((p) => p.id !== h.id))}
                >
                  &#10084;
                </span>
              ))}
              {bonusFlash && (
                <span aria-hidden="true" className="galaxy-bonus-flash">
                  {bonusFlash}
                </span>
              )}
            </button>
          </div>

          {GALAXY_NODES.map((node, i) => {
            // Mobile: an even ring (360 / count apart, one shared radius)
            // instead of this node's own hand-placed angle/radius --
            // see the MOBILE_QUERY comment above. Desktop is untouched.
            const angleDeg = isMobile ? (360 / GALAXY_NODES.length) * i - 90 : node.angleDeg;
            const radiusPct = isMobile ? MOBILE_RADIUS_PCT : node.radiusPct;
            const scale = isMobile ? MOBILE_SCALE : node.scale;
            const pos = orbitPosition(angleDeg, radiusPct);
            const opacity = node.dim ? 0.62 : 1;
            // "More modular play" (Rob, Sep 3 2026): each node's own
            // float duration/amplitude, not one shared rhythm -- see
            // .galaxy-node-float's comment above. Deterministic off the
            // node's own index (not Math.random()) so this never causes
            // a server/client hydration mismatch, same reasoning as the
            // seeded() stars on the landing page.
            const floatDuration = 4 + (i % 4) * 0.9;
            const floatAmp = -(5 + (i % 3) * 2.5);
            const iconFlickerDelay = (i * 0.53) % 3.8;
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
                    gap: `${6 * scale}px`,
                    animationDelay: `${0.4 * i}s`,
                    transform: `scale(${scale})`,
                    ["--float-duration" as string]: `${floatDuration}s`,
                    ["--float-amp" as string]: `${floatAmp}px`,
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
                      // Sep 9 2026, Rob: "make it more 3 dimensional" --
                      // the two inset shadows are the fix. A dark one
                      // pulling toward the bottom-right and a light one
                      // toward the top-left read as one consistent light
                      // source hitting a sphere, rather than a flat
                      // tinted disc -- same light direction the
                      // off-center star-core gradient and the specular
                      // highlight (.galaxy-node-star::after) below use.
                      // The original outer glow stays last in the list.
                      boxShadow: `inset -3px -4px 7px rgba(20,14,6,0.28), inset 3px 4px 6px rgba(255,255,255,0.55), 0 0 ${node.dim ? 10 : 18}px ${node.accent}${node.dim ? "33" : "44"}`,
                      transition: "box-shadow 0.28s ease",
                      ["--n-accent" as string]: node.accent,
                    }}
                  >
                    <span className="galaxy-node-star-core" aria-hidden="true" />
                    {node.icon === "dodecahedron" && (
                      <svg
                        className="galaxy-node-icon"
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        width="34"
                        height="34"
                        style={{ position: "absolute", inset: 0, margin: "auto", color: node.accent, animationDelay: `${iconFlickerDelay}s` }}
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
                    {node.icon === "icosahedron" && (
                      <svg
                        className="galaxy-node-icon"
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        width="34"
                        height="34"
                        style={{ position: "absolute", inset: 0, margin: "auto", color: node.accent, animationDelay: `${iconFlickerDelay}s` }}
                      >
                        {/* Same "outer shape + inner shape + joined
                            corners" shorthand as the dodecahedron above,
                            a hexagon in place of a pentagon -- reads as a
                            faceted gem/icosahedron at icon size, same
                            reasoning as that comment: clearer than a true
                            3D projection would be this small. This is
                            the default glyph for every node except the
                            Hearth. */}
                        <polygon
                          points="12,3 19.8,7.5 19.8,16.5 12,21 4.2,16.5 4.2,7.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          strokeLinejoin="round"
                        />
                        <polygon
                          points="12,7.5 15.9,9.75 15.9,14.25 12,16.5 8.1,14.25 8.1,9.75"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinejoin="round"
                          opacity={0.85}
                        />
                        <line x1="12" y1="3" x2="12" y2="7.5" stroke="currentColor" strokeWidth="0.8" opacity={0.7} />
                        <line x1="19.8" y1="7.5" x2="15.9" y2="9.75" stroke="currentColor" strokeWidth="0.8" opacity={0.7} />
                        <line x1="19.8" y1="16.5" x2="15.9" y2="14.25" stroke="currentColor" strokeWidth="0.8" opacity={0.7} />
                        <line x1="12" y1="21" x2="12" y2="16.5" stroke="currentColor" strokeWidth="0.8" opacity={0.7} />
                        <line x1="4.2" y1="16.5" x2="8.1" y2="14.25" stroke="currentColor" strokeWidth="0.8" opacity={0.7} />
                        <line x1="4.2" y1="7.5" x2="8.1" y2="9.75" stroke="currentColor" strokeWidth="0.8" opacity={0.7} />
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
