"use client";

import ComingSoon from "@/components/ComingSoon";

// The Arcade -- a play area for quick, funny little games, separate
// from everything else on the site (no XP, no Heartbeats, nothing
// earned here, just something fun). Rob's own idea, meant to be filled
// in one real game at a time rather than promised all at once; see the
// comment on this node in lib/galaxyNodes.ts.
export default function GamesPage() {
  return (
    <ComingSoon
      monogram="G"
      accent="#9b6fe0"
      name="The Arcade"
      body="A play area for quick, funny little games -- built one at a time,
        right here. Nothing playable yet; the first one's coming."
    />
  );
}
