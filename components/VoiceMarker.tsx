// Voice Tier 3 -- "your original threads carry a quiet Voice marker
// next to your name" (see lib/practices.ts). Deliberately small and
// low-key -- a single muted glyph, not a badge or pill -- and only
// ever rendered next to a THREAD's own author. Never a reply's: this
// tier is specifically about original posting (the Voice Practice's
// theme), not participation in general.
//
// Reads the tier straight off whatever PublicProfile the caller
// already has in hand (get_public_profiles now returns
// practice_points -- see supabase/schema.sql, Sep 5 2026) rather than
// a second fetch, so dropping this next to an author name anywhere
// author name already renders is a one-line addition.
import { normalizePracticePoints, practiceTier } from "@/lib/practices";

export default function VoiceMarker({ practicePoints }: { practicePoints: unknown }) {
  if (practiceTier(normalizePracticePoints(practicePoints), "voice") < 3) return null;
  return (
    <span
      title="Voice Tier 3+ -- consistent original posting"
      style={{
        marginLeft: "4px",
        color: "var(--gold)",
        opacity: 0.75,
        fontSize: "0.85em",
      }}
    >
      &#10022;
    </span>
  );
}
