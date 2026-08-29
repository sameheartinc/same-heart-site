# Same Heart -- future business ideas & notes

A running list of monetization/product ideas Rob has raised that aren't
being built yet, so they survive between sessions instead of getting
lost in chat history.

## Immigration support services (revenue stream, future)

Raised Aug 27/28, 2026. Idea: eventually offer immigration support
services as a paid offering through Same Heart. Not scoped, not
started -- no product design, no legal/regulatory research done yet
(this is a heavily regulated space in most countries -- who's legally
allowed to give immigration advice varies a lot by jurisdiction, e.g.
in Canada only licensed RCICs/lawyers can charge for immigration
advice; likely similar restrictions in the US and elsewhere). Needs:
- Which country/countries' immigration systems this would cover
- Whether Rob himself is/would become a licensed practitioner, or
  whether this is more "information product" / "concierge" adjacent
  work that stays clear of regulated legal-advice territory
- A real look at the regulatory line before any product work starts

Not actioned. Revisit when Rob wants to scope it out.

## Return-engagement loop ("candy for a baby") -- near-term, buildable

Raised Aug 28, 2026, as part of a bigger long-term vision (see
VISION.md). The concretely buildable piece: give people a real,
evolving reason to come back to the Hub/Commons regularly, on top of
the Standing/XP/Skins system that already exists. Rough shape, not
built yet:
- Daily/streak mechanic -- something that visibly evolves the longer
  someone keeps showing up (a streak counter, a capsule/ship visual
  that changes over time, a new quote or unlock tied to consistency)
- Small, honest surprises rather than manipulative dark-pattern
  notifications -- in keeping with the site's existing "we tell you
  what's real vs not built yet" ethos
- Could tie into: Skins unlocks, Commons contribution levels (already
  noted as a deferred Commons-plan piece), the Wallet once it's built

Good candidate for "what's next" once current deploy/Shopify/news work
settles. Needs real scoping before building.

## Livestreaming via Muvi Live (future)

Raised Aug 29, 2026. Rob wants to eventually offer livestreams through
Muvi Live (live.muvi.com) -- noticed other creators/brands doing the
same. Not scoped, not started.

What Muvi Live actually is (per their own marketing, verified Aug 2026):
a hosted live-streaming + VOD platform with built-in monetization
(pay-per-view paywall, ad-based) and a 14-day free trial. Broadcasts
from a camera, phone, or third-party encoder via RTMP/HLS; auto-records
livestreams into replayable VOD. Integrates into an existing website via
a copy-paste embed code (also has a WordPress plugin, and APIs/SDKs for
custom dev).

What Rob would actually need to make this real:
- A Muvi Live account/subscription (trial first, then a paid plan --
  pricing tiers weren't public on their marketing page, would need to
  check directly with Muvi or start the trial)
- Something to actually stream: a camera/phone, or streaming software
  (e.g. OBS) if going the RTMP route from a computer
- A decision on monetization shape -- free stream, pay-per-view single
  events, or a paywalled series/subscription
- The actual embed step: since sameheart.ca is a custom Next.js site
  (not WordPress/Squarespace), this would mean dropping Muvi's embed
  code/player into a real page component (e.g. a new `/live` route)
  rather than using their WordPress plugin -- straightforward once he's
  ready, just needs the actual embed snippet from his Muvi account
- Content/schedule plan: what's actually being streamed, how often,
  and how it ties into the rest of the Same Heart experience (Commons,
  Signal, etc.)

Not actioned. Revisit when Rob has a Muvi account and wants to build
the embed page.
