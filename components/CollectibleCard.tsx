import { CardDef, RARITY_ACCENT, cardAccent, describeCardSource } from "@/lib/cards";

// One collectible Card (see lib/cards.ts). Earned cards show their art --
// or, until real art exists, a generated placeholder in the card's own
// color -- and locked ones stay dimmed with the plain-language reason
// they're not yours yet, so the collection doubles as a list of things
// to go earn. Purely presentational: whether a card is owned is decided
// by the caller from profile_unlocks, never here.
export default function CollectibleCard({ card, owned }: { card: CardDef; owned: boolean }) {
  const accent = cardAccent(card);
  const rarityColor = RARITY_ACCENT[card.rarity];
  const glyph =
    card.source.type === "level" ? String(card.source.level) : card.source.type === "heart-string" ? "♥" : "✦";

  return (
    <div
      style={{
        aspectRatio: "5 / 7",
        borderRadius: "14px",
        overflow: "hidden",
        position: "relative",
        border: `2px solid ${owned ? rarityColor : "var(--border)"}`,
        boxShadow: owned ? `0 0 18px ${rarityColor}44` : "none",
        background: "var(--panel)",
        opacity: owned ? 1 : 0.55,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          flex: 1,
          position: "relative",
          background:
            owned && card.image
              ? `url(${card.image}) center / cover no-repeat`
              : `radial-gradient(circle at 50% 38%, ${accent}${owned ? "cc" : "33"}, ${accent}${owned ? "22" : "0d"} 70%)`,
          filter: owned ? "none" : "grayscale(1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!(owned && card.image) && (
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
    </div>
  );
}
