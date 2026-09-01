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

## Return-engagement loop ("candy for a baby") -- BUILT Aug 29, 2026

Raised Aug 28, 2026 as part of the bigger long-term vision (see
VISION.md). Built out Aug 29, 2026: a real daily streak mechanic on the
Hub, on top of the Standing/XP system (which existed as unused
scaffolding until this -- `standing` never actually moved off its
default before this).

What's live: `lib/streak.ts` (the check-in rules -- one count per UTC
calendar day, streak resets if a day's missed) and `lib/standing.ts`
(XP -> Standing tier, purely earned, never purchasable, per the Field
Guide's own promise). app/hub/page.tsx calls the check-in once per Hub
load: awards a flat 8 XP for showing up, plus one-time bonus XP at day
3/7/14/30/60/100 (see MILESTONES in lib/streak.ts), and recomputes
Standing from the new XP total. A small evolving "STREAK" counter box
sits next to the existing "DAY" counter on the Hub, glowing brighter at
each streak tier, and a one-time celebratory banner appears only on the
exact visit a milestone is crossed -- not on every visit, per the
"honest, not manipulative" rule from the original ask. Every check-in
also drops a line in "Your log" so the XP isn't a mystery.

Needs a Supabase migration to actually work -- see the bottom of
supabase/schema.sql (three new columns on `profiles`:
current_streak, longest_streak, last_visit_date) -- run once in the
Supabase SQL Editor before this does anything live.

Not yet built (future iteration, only if this proves people actually
come back for it): tying streak milestones to unlocking new Skins
(currently all three Skins are free-pick, no locking); Commons
contribution levels; Wallet integration once the Wallet itself is
built.

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

## Midjourney artwork skins for the widget-skin engine (in progress)

Raised Sep 1, 2026. The `widget_skins` table (see supabase/schema.sql and
lib/widgetSkins.ts) already has a `kind` field with a "palette" and
"artwork" option, but only "palette" is rendered today -- "artwork" was
scaffolded on purpose, waiting on a real batch of curated images before
it's worth building the rendering for.

Rob's assembling a batch of Midjourney generations now, from a set of 20
prompts covering the four Path elements (Guardian/Seeker/Weaver/Flame),
celestial/Star Day, textural (parchment, frosted glass, woven fabric,
brushed metal), abstract light/energy, retro/tech, and nature. Once he's
picked a set and gotten them into the project (dropped somewhere I can
reach, or told where they land), next steps are: crop/host the chosen
images, add an image-upload path to `/admin/skins` (currently text-only
CSS var fields, no file field), and teach `WidgetFrame` to actually
render `kind: "artwork"` skins as a background image instead of the
`vars`-only palette rendering it does today.

Not actioned yet -- waiting on Rob's curated image set.

## Green Key's door: Impact History page (BUILT Sep 1, 2026)

The last of the four already-earnable Keys' doors that wasn't built yet
(Red's who-is-here and Blue's Commons accent color already existed).
Per PLAN.md: "a personal 'impact history' page compiling every
transmission someone's sent and what it actually scored... a keepsake of
real-world contribution, not a leaderboard."

`app/impact/page.tsx` -- gated the same way `/admin/skins` is: an
honest locked message (not a redirect) for a signed-in profile that
doesn't hold the Green Key yet, explaining what it takes
(`lib/keys.ts`'s existing blurb). Once held, shows three stats
(transmission count, average impact score, total Heartbeats earned)
and every transmission as a card -- title/domain linking to the
original URL, tagline if one was written, world-issue label, score,
Heartbeats awarded, and date. Reads via a new `listMyTransmissions()`
in `lib/exchange.ts` (same public `exchange_transmissions` table the
Commons feed already reads, just filtered to the signed-in profile --
no new RLS needed). The green key's dot on the Hub is now a link into
this page (the other three keys' dots stay inert, since only Blue and
Green have anything to click through to right now). Added `/impact` to
`app/robots.ts`'s disallow list, matching `/hub` and `/admin`. Verified
with `npx tsc --noEmit` (clean) and a diff against the pre-edit files.

Yellow's door (letting a holder influence the Signal's fetch topics)
remains the one built key without a built door -- next natural pick
once this is confirmed working.
