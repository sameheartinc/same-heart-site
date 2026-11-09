"use client";

import { useState } from "react";
import { CardDef, RARITY_ACCENT, cardAccent, describeCardSource } from "@/lib/cards";
import CardVideoLightbox from "@/components/CardVideoLightbox";

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
//
// A card with real video art (lib/cards.ts's `video` field) stays a
// still image in the grid -- autoplaying video in every tile would be
// noisy and heavy on a page with dozens of cards. Rob's spec (Nov 9
// 2026): the grid shows the still, and clicking it opens the video
// full-size, looping, closed with an X -- see CardVideoLightbox.
export default function CollectibleCard({ card, owned }: { card: CardDef; owned: boolean }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const accent = cardAccent(card);
  const rarityColor = RARITY_ACCENT[card.rarity];
  const glyph =
    card.source.type === "level" ? String(card.source.level) : card.source.type === "heart-string" ? "♥" : "✦";
  const showImage = owned && Boolean(card.image);
  const isPlayable = owned && Boolean(card.video);

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
        onClick={isPlayable ? () => setLightboxOpen(true) : undefined}
        role={isPlayable ? "button" : undefined}
        aria-label={isPlayable ? `Play ${card.name} card video` : undefined}
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
          cursor: isPlayable ? "pointer" : "default",
        }}
      >
        {!showImage && (
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
        {isPlayable && (
          // Play-button affordance -- always visible (not hover-only),
          // since most of this site is used on a phone.
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: "8px",
              right: "8px",
              width: "26px",
              height: "26px",
              borderRadius: "50%",
              background: "rgba(9,11,18,0.72)",
              border: `1px solid ${accent}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 10px ${accent}88`,
            }}
          >
            <span style={{ color: "#fff", fontSize: "10px", marginLeft: "2px" }}>&#9654;</span>
          </div>
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

      {lightboxOpen && <CardVideoLightbox card={card} onClose={() => setLightboxOpen(false)} />}

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
