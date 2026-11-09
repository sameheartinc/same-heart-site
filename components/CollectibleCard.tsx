"use client";

import { useState } from "react";
import { CardDef, RARITY_ACCENT, cardAccent, describeCardSource } from "@/lib/cards";

// One collectible Card (see lib/cards.ts). Earned cards show their art --
// or, until real art exists, a generated placeholder in the card's own
// color -- and locked ones stay dimmed with the plain-language reason
// they're not yours yet, so the collection doubles as a list of things
// to go earn. Purely presentational: whether a card is owned is decided
// by the caller from profile_unlocks, never here.
//
// Tile shape matches the "aviation deck" language /wallet and /cards
// already use (clipped corners, not rounded ones); an owned card pulses
// faintly in its own rarity color, the same "active instrument light"
// treatment Wallet already gives a held Heart String. Locked tiles stay
// static -- dimmed and grayscale, same as before.
export default function CollectibleCard({ card, owned }: { card: CardDef; owned: boolean }) {
  // If a card's video 404s or otherwise fails (e.g. the real file hasn't
  // been committed yet), fall back to the normal generated placeholder
  // instead of a broken/blank video box -- same "earnable before its art
  // exists" promise lib/cards.ts already makes for `image`.
  const [videoFailed, setVideoFailed] = useState(false);
  const accent = cardAccent(card);
  const rarityColor = RARITY_ACCENT[card.rarity];
  const glyph =
    card.source.type === "level" ? String(card.source.level) : card.source.type === "heart-string" ? "♥" : "✦";
  const showVideo = owned && Boolean(card.video) && !videoFailed;
  const showImage = owned && Boolean(card.image) && !showVideo;
  const hasVisual = showImage || showVideo;

  return (
    <div
      className={owned ? "collectible-tile collectible-tile-owned" : "collectible-tile"}
      style={{
        aspectRatio: "5 / 7",
        position: "relative",
        border: `2px solid ${owned ? rarityColor : "var(--border)"}`,
        background: "var(--panel)",
        opacity: owned ? 1 : 0.55,
        display: "flex",
        flexDirection: "column",
        ["--collectible-glow" as string]: `${rarityColor}66`,
      }}
    >
      <div
        style={{
          flex: 1,
          position: "relative",
          background: showImage
            ? `url(${card.image}) center / cover no-repeat`
            : `radial-gradient(circle at 50% 38%, ${accent}${owned ? "cc" : "33"}, ${accent}${owned ? "22" : "0d"} 70%)`,
          filter: owned ? "none" : "grayscale(1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {showVideo && (
          // A rotating/animated card (see lib/cards.ts's `video` field) --
          // plays instead of a still image. Muted + autoPlay + playsInline
          // so it actually autoplays on mobile Safari, loops forever since
          // there's no "end" to a rotating card, and uses card.image (if
          // set) as the poster frame while it loads.
          <video
            src={card.video ?? undefined}
            poster={card.image ?? undefined}
            autoPlay
            loop
            muted
            playsInline
            onError={() => setVideoFailed(true)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}
        {!hasVisual && (
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: card.source.type === "level" ? "2.6rem" : "3rem",
              color: owned ? "#fff" : "var(--ink-faint, #5c6684)",
              textShadow: owned ? `0 0 16px ${accent}` : "none",
            }}
          >
            {owned ? glyph : "?"}
          </span>
        )}
      </div>
      <div style={{ padding: "10px 10px 12px", background: "var(--panel)", borderTop: "1px solid var(--border)" }}>
        <p
          style={{
            margin: "0 0 3px",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "0.82rem",
            color: "var(--ink)",
          }}
        >
          {owned ? card.name : "Locked"}
        </p>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-mono)",
            fontSize: "8px",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: owned ? rarityColor : "var(--ink-faint, #5c6684)",
          }}
        >
          {owned ? card.rarity : describeCardSource(card.source)}
        </p>
        {owned && card.blurb && (
          <p style={{ margin: "6px 0 0", fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "0.72rem", color: "var(--ink-dim)" }}>
            {card.blurb}
          </p>
        )}
      </div>

      <style jsx>{`
        .collectible-tile {
          clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px));
          overflow: hidden;
        }
        @keyframes collectiblePulse {
          0%,
          100% {
            box-shadow: 0 0 10px var(--collectible-glow);
          }
          50% {
            box-shadow: 0 0 20px var(--collectible-glow);
          }
        }
        .collectible-tile-owned {
          animation: collectiblePulse 2.6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .collectible-tile-owned {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
