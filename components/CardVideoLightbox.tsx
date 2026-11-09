"use client";

import { useEffect } from "react";
import type { CardDef } from "@/lib/cards";
import { cardAccent } from "@/lib/cards";

// Full-screen lightbox for a card's video (see lib/cards.ts's `video`
// field) -- the still image in the grid tile (CollectibleCard) is what
// everyone sees scrolling the collection; this is what plays when
// someone actually wants to watch it move. Used two ways:
//   - celebratory=false: clicking an owned video card's tile (see
//     CollectibleCard.tsx) opens this plain, same video every time.
//   - celebratory=true: the moment a card is FIRST earned (see
//     app/hub/page.tsx's evaluateEvolution callback) -- same video, a
//     gold sparkle field around it, and a "you unlocked" line up top.
// Either way: loops forever, closes on the X, the backdrop click, or
// Escape -- Rob's spec was "loop and play until they clicked an X."
export default function CardVideoLightbox({
  card,
  onClose,
  celebratory = false,
}: {
  card: CardDef;
  onClose: () => void;
  celebratory?: boolean;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!card.video) return null;
  const accent = cardAccent(card);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${card.name} card`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 950,
        background: "rgba(5,6,12,0.86)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "28px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "360px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {celebratory && (
          <p
            style={{
              margin: "0 0 14px",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--gold)",
              textAlign: "center",
              textShadow: "0 0 12px rgba(201,161,90,0.6)",
            }}
          >
            &#10022; You unlocked {card.name} &#10022;
          </p>
        )}

        <div
          className={celebratory ? "card-lightbox-frame card-lightbox-sparkling" : "card-lightbox-frame"}
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "5 / 7",
            borderRadius: "14px",
            overflow: "hidden",
            border: `2px solid ${accent}`,
            boxShadow: `0 0 50px ${accent}66`,
            background: "#0a0b12",
          }}
        >
          <video
            src={card.video}
            autoPlay
            loop
            muted
            playsInline
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
          {celebratory && (
            <div aria-hidden="true" className="card-lightbox-sparkles">
              {Array.from({ length: 10 }).map((_, i) => (
                <span key={i} className={`sparkle sparkle-${i}`}>
                  &#10022;
                </span>
              ))}
            </div>
          )}
        </div>

        {celebratory && card.blurb && (
          <p
            style={{
              margin: "14px 0 0",
              fontFamily: "var(--font-body)",
              fontStyle: "italic",
              fontSize: "0.82rem",
              color: "rgba(255,255,255,0.78)",
              textAlign: "center",
              maxWidth: "46ch",
            }}
          >
            {card.blurb}
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: "-16px",
            right: "-16px",
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            border: "1px solid rgba(201,161,90,0.5)",
            background: "linear-gradient(135deg, rgba(22,26,40,0.95), rgba(9,11,18,0.98))",
            color: "var(--gold)",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1rem",
            lineHeight: 1,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 14px rgba(201,161,90,0.3)",
          }}
        >
          &#10005;
        </button>
      </div>

      <style jsx>{`
        .card-lightbox-sparkles {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .sparkle {
          position: absolute;
          color: var(--gold);
          font-size: 14px;
          opacity: 0;
          text-shadow: 0 0 8px rgba(201, 161, 90, 0.9);
          animation: sparkleTwinkle 2.4s ease-in-out infinite;
        }
        .sparkle-0 { top: 8%; left: 14%; animation-delay: 0s; }
        .sparkle-1 { top: 18%; left: 82%; animation-delay: 0.3s; }
        .sparkle-2 { top: 34%; left: 6%; animation-delay: 0.6s; }
        .sparkle-3 { top: 46%; left: 90%; animation-delay: 0.9s; }
        .sparkle-4 { top: 62%; left: 10%; animation-delay: 1.2s; }
        .sparkle-5 { top: 70%; left: 88%; animation-delay: 1.5s; }
        .sparkle-6 { top: 86%; left: 22%; animation-delay: 0.45s; }
        .sparkle-7 { top: 90%; left: 70%; animation-delay: 1.8s; }
        .sparkle-8 { top: 4%; left: 50%; animation-delay: 2.1s; }
        .sparkle-9 { top: 54%; left: 48%; animation-delay: 0.75s; }
        @keyframes sparkleTwinkle {
          0%, 100% { opacity: 0; transform: scale(0.6) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.15) rotate(25deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sparkle {
            animation: none;
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}
