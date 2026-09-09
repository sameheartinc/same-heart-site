// Voice Tier 4 -- a short personal "signature line" shown under your
// own name at the top of a thread you started (see lib/practices.ts).
// This tier's original idea was a custom post accent color, but that
// turned out to duplicate the Blue Heart String's existing
// commons_accent door (lib/keys.ts) -- resolved with Rob (Sep 9 2026)
// by swapping in this instead.
//
// Deliberately shown only on the full thread page
// (app/commons/t/[id]/page.tsx), not the compact list rows on
// app/commons/page.tsx or app/commons/c/[slug]/page.tsx -- a tagline is
// real, variable-length content, not a small fixed glyph like
// VoiceMarker, and those list rows are already a tight one-line scan.
// Same author-only-on-their-own-thread scoping as VoiceMarker: never
// rendered next to a reply.
import { normalizePracticePoints, practiceTier } from "@/lib/practices";

export default function VoiceSignature({
  practicePoints,
  signature,
}: {
  practicePoints: unknown;
  signature: string | null | undefined;
}) {
  if (practiceTier(normalizePracticePoints(practicePoints), "voice") < 4) return null;
  const trimmed = signature?.trim();
  if (!trimmed) return null;
  return (
    <p
      style={{
        margin: "2px 0 0",
        fontFamily: "var(--font-body)",
        fontStyle: "italic",
        fontSize: "0.8rem",
        color: "var(--ink-faint, #5c6684)",
        opacity: 0.85,
      }}
    >
      {trimmed}
    </p>
  );
}
