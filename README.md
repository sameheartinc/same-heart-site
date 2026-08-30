# Same Heart -- starter

Real accounts now. Sign up, Star Day gets captured once and saved to your
Supabase database, and the Hub reads it back -- persistent across devices,
not just your browser.

## Open this in Cursor

1. Unzip this folder and open it as a project in Cursor (or copy the new/
   changed files into your existing `same-heart-site` clone -- see
   "What's new in this update" below for the exact list).
2. In a terminal inside Cursor: `npm install`
3. `.env.local` in this zip already has your real Supabase URL and anon
   key filled in -- no editing needed to run it locally.
4. `npm run dev` and open http://localhost:3000.

## Three things to check in your Supabase dashboard before testing sign-up

1. **Authentication -> Providers -> Email -> "Confirm email"** -- while
   you're testing, turn this OFF so a new account can sign in immediately
   instead of waiting on a confirmation email. Turn it back ON before
   real people start signing up.
2. **Authentication -> URL Configuration -> Site URL** -- set this to
   `http://localhost:3000` for now; add `https://sameheart.ca` here too
   once you're testing against the live site.
3. **Authentication -> Attack Protection (sometimes labeled Bot and Abuse
   Protection) -> "Enable CAPTCHA protection"** -- turn this OFF while
   testing. The sign-up form doesn't have a CAPTCHA widget built into it
   yet, so leaving this on blocks every sign-up with a
   "captcha_token not found" error. Turn it back ON before real people
   start signing up (or build a real CAPTCHA widget into the form first).

## The flow to test

1. `/` -- the public landing page. Click "Find your frequency."
2. `/login` -- create an account (email + password).
3. `/star-day` -- enter a birth date once. This writes your frequency,
   archetype, and designation into your `profiles` row, permanently.
4. `/hub` -- reads that data back and shows your Day count, Standing, and
   log. Refresh, or open it on a different browser -- it's the same data,
   because it's a real account now, not local storage.

## What's new in this update

- `lib/starDay.ts` -- the frequency/archetype generator, ported exactly
  from the prototype so results match what you already saw.
- `app/login/page.tsx` -- sign up / sign in.
- `app/star-day/page.tsx` -- the birth-date capture, one-time per account.
- `app/hub/page.tsx` -- reads the real profile + log from Supabase, and
  now has a **Skins** picker (see below).
- `app/page.tsx` -- added a "Find your frequency" link to `/login`.
- `lib/skins.ts` -- new. The three starter Skins (Cosmic Gold, Earth
  Tones, Pastel Dream) live here as plain CSS variable overrides. Adding
  a fourth later is just copying one entry and changing the seven colors.
- `supabase/schema.sql` -- updated to match the schema actually running
  in your Supabase project (profiles + log_entries, Standing/XP fields,
  and the `ship_skin` migration below). If you ever change something in
  the Supabase dashboard directly, update this file to match, so it
  stays a true record of what's live.
- `lib/quotes.ts` -- new. The quote bank (see below). No database or
  Supabase changes needed for this one.
- `app/privacy/page.tsx` -- new. A plain-language privacy policy at
  `/privacy`, reflecting what the site actually does today (Supabase
  accounts, Shopify checkout, basic analytics). Not a substitute for a
  lawyer's review once paid ads or more personal data come into play.
  It links to `/terms` and `/contact`, which don't exist as pages yet.
- `lib/transmit.ts` and `app/star-day/page.tsx` -- new **transmit**
  moment (see below): a synthesized radio-static-into-signal-lock sound
  plus an expanding-ring graphic that plays right after someone submits
  their Star Day, before handing off to the Hub.
- `supabase/schema.sql` and `app/hub/page.tsx` -- new **Signal Number**
  (see below): every profile now gets a permanent, sequential number,
  separate from `designation`.
- `PLAN.md` -- new. The architecture plan for the bigger build (radio
  transmit effects, Signal Number, RSS "collective knowing," the
  Community/forum system, and the curation engine that connects people
  to experiences and to each other). Read this before starting on any
  of those four.

## One-time database update for Skins

`ship_skin` existed in your table already but was never wired up to
anything. Open the Supabase SQL Editor and run the last two statements
at the bottom of `supabase/schema.sql` (the `update profiles ...` and
`alter table profiles alter column ship_skin ...` lines) once. That
moves any existing accounts onto a real skin and fixes the default for
new signups. Safe to run more than once if you're not sure whether you
already did it.

## One-time database update for Signal Numbers

Run the new line at the bottom of `supabase/schema.sql` once (`alter
table profiles add column if not exists signal_number bigserial;`).
That gives every existing account a number and makes sure every new
signup gets the next one automatically -- Postgres handles the
counting, nothing in the app code has to. Safe to run more than once.

One honest caveat: for accounts that existed *before* you run this,
the number they land on follows Postgres's internal row order, not
necessarily the literal order they signed up in. From the moment you
run it forward, though, numbering is exact -- signup order, no gaps.

## Skins

The Hub now has a Skins section where anyone can pick between three
looks -- Cosmic Gold (the original), Earth Tones (warm clay/umber), and
Pastel Dream (soft light theme). It's purely visual: it changes colors
in the Hub, never Standing, XP, or anything else about the account. The
choice is saved to `profiles.ship_skin` so it's remembered next time
they sign in, on any device.

This is deliberately built as a small, reusable system (`lib/skins.ts`)
rather than one-off styling, so a fourth/fifth skin -- including ones
built from your own art -- is a quick addition later, and so the same
mechanism can extend to the rest of the site (not just the Hub) once
that's wanted.

## The transmit moment

Submit a Star Day and there's now a beat before the Hub loads: a short
burst of static that settles into a clean tone (Web Audio API, fully
synthesized -- no audio file involved), with three gold rings
expanding out from a center point on screen, and "Signal locked"
underneath. It respects `prefers-reduced-motion` (rings are skipped for
anyone with that setting on) and never blocks navigation -- if the
Supabase write fails, the whole effect is skipped and the error shows
normally instead.

This is deliberately built as a standalone function
(`playTransmitSound()` in `lib/transmit.ts`) rather than inline in the
page, so the same "transmit" beat can get reused anywhere else on the
site a send/submit moment deserves one -- posting in a future
Community forum, for instance.

## Signal Number

Every account now carries a permanent Signal Number -- a plain
sequential ID (`Signal No. 000001`, `000002`, ...), shown under the
designation on the Hub. It's separate from `designation`, which is
derived from birth date and isn't unique or sequential. Signal Number
is purely "you were here," an allocation, not a rank -- it doesn't move
and doesn't affect Standing or XP.

## The quote bank

A short line fades in at the top of the Hub, above the Skins picker.
It's a different one basically every visit -- picked fresh each time
someone loads the page, not stored anywhere, so refreshing gets you a
new one too. If a profile's archetype has its own lines written for it
(all twelve archetypes do, a couple each), those get folded into the
draw so it can feel a little more personal, without ever running out
if it doesn't match.

**Honest scale note:** this ships ~150 original lines, not 1000. Writing
1000 that are each actually good -- not padded, not repeating the same
five ideas in different words -- is real content work, not something to
fake in one pass. Three ways to actually get there over time, not
mutually exclusive:

1. I keep adding batches (another ~100-150 at a time) in future updates
   until the bank is genuinely deep. No extra work on your end.
2. You send me your own lines -- things you've written, said, or want
   the brand's voice to include -- and I fold them in alongside mine.
   Given the name of the site, this is probably the best version: some
   of these should be yours.
3. Once the Community forum exists, the quote on login/arrival could
   pull from a small `is_featured` set of member-submitted lines
   instead of only mine -- a nice way to make the forum feel alive from
   day one. Noted for that phase, not built yet.

Where it shows up can also move or duplicate -- e.g. a version on the
`/login` arrival beat, or on the forum once that's built -- since
`pickQuote()` in `lib/quotes.ts` is just a function, not tied to the Hub.

## Deploy to Vercel

Same as before, but now it matters: add `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` under Project Settings -> Environment
Variables on Vercel too -- `.env.local` only affects your local machine,
not the deployed site. Add both, then redeploy (Deployments tab ->
Redeploy) for the live site to pick them up.

## What's deliberately NOT here yet

- The Heart Chart navigation, the companion, and Standing tiers are all
  validated in prototype but not wired into these real pages yet --
  that's a future pass. The Merch site and card-deck collectibles stay
  documented in the Same Heart reference map until their phase comes up.
- RSS "collective knowing," the Community/forum system (with live
  active-user counts and page design), and the click-based curation
  engine that connects people to experiences and to each other -- all
  scoped and sequenced in `PLAN.md`, none of it built yet. That file is
  the plan for what comes after this update.
