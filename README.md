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
   Protection) -> "Enable CAPTCHA protection"** -- leave this OFF until
   the Turnstile Secret Key is set up (see "Two new things to check in
   Supabase for this update" below). Both the anonymous entry point and
   the explicit email/password form now request an invisible Turnstile
   token the same way, so turning this on covers both once the Secret
   Key is in place.

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
  `/privacy`, reflecting what the site actually does today. Not a
  substitute for a lawyer's review once paid ads or more personal data
  come into play.
- `lib/transmit.ts` and `app/star-day/page.tsx` -- new **transmit**
  moment (see below): a synthesized radio-static-into-signal-lock sound
  plus an expanding-ring graphic that plays right after someone submits
  their Star Day, before handing off to the Hub.
- `app/login/page.tsx` -- the explicit email/password form now also
  requests an invisible Turnstile token via `lib/turnstile.ts`, the same
  helper the anonymous entry point already used. Previously only
  anonymous sign-in was covered, so turning CAPTCHA protection on in
  Supabase would have broken the email/password path with a
  "captcha_token not found" error.
- `app/login/page.tsx` -- new **"Continue with Google"** button on the
  sign-up/sign-in form (see below). Not shown in claim mode -- claiming
  an existing anonymous account still goes through email/password, since
  attaching a second sign-in method to an already-anonymous session is a
  different, more involved flow than a fresh sign-in.
- `app/api/commons-guide/route.ts`, `components/CommonsGuide.tsx`,
  `app/commons/page.tsx` -- new **Commons Guide** AI chat widget (see
  below), powered by Google's Gemini API.

## One-time database update for Skins

`ship_skin` existed in your table already but was never wired up to
anything. Open the Supabase SQL Editor and run the last two statements
at the bottom of `supabase/schema.sql` (the `update profiles ...` and
`alter table profiles alter column ship_skin ...` lines) once. That
moves any existing accounts onto a real skin and fixes the default for
new signups. Safe to run more than once if you're not sure whether you
already did it.

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
synthesized -- no audio file involved), with three gold rings expanding
out from a center point on screen, and "Signal locked" underneath. It
respects `prefers-reduced-motion` and never blocks navigation -- if the
Supabase write fails, the effect is skipped and the error shows
normally instead. Built as a standalone function (`playTransmitSound()`
in `lib/transmit.ts`) so the same beat can get reused anywhere else on
the site a send/submit moment deserves one -- posting in the Commons,
for instance.

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

- The Heart Chart navigation, the companion, the Signal quote widget,
  and Standing tiers are all validated in prototype but not wired into
  these real pages yet -- that's a future pass. Community forum/chat,
  the Merch site, card-deck collectibles, and AI Discovery Planets stay
  documented in the Same Heart reference map until their phase comes up.

## The founding sequence: anonymous entry + Path (new)

Touching the mark on `/login` no longer leads straight to an email/password
form. Instead:

1. It creates a real Supabase account instantly, with no form at all,
   using anonymous sign-in (`lib/session.ts`). Everything -- Star Day,
   XP, Skins, the log -- works immediately and persists on refresh.
2. A quick 3-question "mood check" (`components/PathOnboarding.tsx`),
   blended with an ambient read of how the mouse actually moves for a
   few seconds (`lib/cursorSignal.ts`, genuinely a little uncanny),
   assigns one of four Paths -- Guardian, Seeker, Weaver, Flame
   (`lib/paths.ts`). This is a quick personality read, separate from Star
   Day, which stays the deeper, permanent signal from a birth date.
3. A brief reveal + "vessel is ready" beat, with a background that shifts
   color and particle style to match the Path (`components/WorldField.tsx`,
   `lib/worlds.ts`).
4. Straight into `/star-day`, then `/hub`, exactly as before.

A permanent Spark ID (e.g. `Spark #00042`) is stamped the moment that
first account is created -- anonymous or not -- and never changes. It
shows next to the designation in the Hub.

Returning visitors who already have a session (anonymous or a real
account) skip straight past all of this to "Welcome back to the
frequency," same as before.

## Two new things to check in Supabase for this update

1. **Authentication -> Providers -> Anonymous Sign-ins** -- turn this ON.
   Without it, touching the mark falls back to the old email/password
   form automatically (nobody gets stuck), but the instant, formless
   entry is the whole point of this update.
2. Run the new SQL at the bottom of `supabase/schema.sql` (the Spark ID
   and Path columns, appended after the Skins migration). Safe to run
   more than once.

If you already created a Cloudflare Turnstile site key (I found one
already set in the other project's `.env.local` and copied the public
site key line into this one's `.env.local` automatically) it's wired up
and gating anonymous sign-ins invisibly. If not, everything above still
works without it -- Turnstile is optional extra protection, not a
requirement.

## Claim your account

Anyone on an anonymous account sees a small banner at the top of the
Hub -- "Claim your account." It leads to `/login?claim=1`, which shows
the familiar email/password form, but instead of creating a second,
disconnected account it calls `supabase.auth.updateUser()` to attach
real credentials to the same account they already have. Nothing about
their Star Day, Path, Spark ID, Skins, or log changes or moves --
they just become recoverable on another device. This hasn't been tested
yet against "Confirm email" turned ON for an existing anonymous session --
worth trying both ways before relying on it for real users.

## Google sign-in (new)

The sign-up/sign-in form now has a "Continue with Google" button above
the email/password fields (not shown in claim mode). Clicking it sends
someone to Google's real account picker, then back to `/login?oauth=1`,
where the page picks up the new session and continues exactly like any
other sign-in -- straight to Star Day for a first-timer, straight to the
Hub for a returning account.

Two things to set up before this actually works (it fails quietly with a
Supabase error otherwise -- nothing breaks, but the button won't do
anything useful until both are done):

1. **Google Cloud Console** -- create an OAuth Client ID (APIs & Services
   -> Credentials -> Create Credentials -> OAuth client ID -> Web
   application). Under "Authorized redirect URIs," add exactly:
   `https://pnuqdzbszcitxmvgnczz.supabase.co/auth/v1/callback`
   (that's your Supabase project's own callback URL, not sameheart.ca --
   Google talks to Supabase directly, then Supabase hands the session
   back to the site). Copy the Client ID and Client Secret it gives you.
2. **Supabase -> Authentication -> Providers -> Google** -- turn it on,
   paste in that Client ID and Client Secret, save. Also confirm
   **Authentication -> URL Configuration -> Redirect URLs** includes
   `http://localhost:3000/**` and `https://sameheart.ca/**` (wildcards,
   so `/login?oauth=1` is allowed) -- this is likely already covered by
   the Site URL entries from the very first setup checklist, but it's
   worth a quick look since Google sign-in is the first thing in this
   project that actually depends on a redirect coming back from outside
   Supabase.

Nothing else needs to change in the code for a second provider later
(Apple, Facebook, etc.) -- it's the same button and the same
`?oauth=1` return handling, just a different `provider` value.

## What this update deliberately leaves out (see the other folder)

Your phone build (`SameHeart/same-heart-site`, moved to sit next to this
folder rather than inside it) has a lot more than the founding sequence:
a full rewards/badge system with gift codes people can send each other, a
Shopify-backed `/shop`, cause campaigns with AI-suggested outreach, and a
waitlist form -- all real, working code, not just planned. None of that
was pulled into this project yet. That's intentionally the next update,
not forgotten: the rewards/gifting engine becomes the real version of the
"wallet" of unlockables you described, and the Shopify integration should
mean the Merch site (your #3 priority) is mostly already built rather
than starting from scratch. Community forum/chat is still the step after
that.

## The Commons (new)

A real, working community space at `/commons` -- not the full "living
sphere" vision (see the original build-plan doc for the whole thing),
but a genuine functional core of it: real communities, real discussions
and questions, real replies, all backed by the database, plus a live
presence count. First visit plays a short cinematic entrance ("THE WORLD
IS TALKING." / "ARE YOU LISTENING?" / a glowing sphere + a question
input); every return visit goes straight to the real Commons home.

**What's actually real:** creating communities, joining them, starting
discussions or questions (in a community or general), replying, a search
box that searches real thread titles/bodies, and a stats bar where every
number is a genuine query against the database (humans active in the
last 5 minutes, conversations active in the last 24h, communities that
exist) -- nothing simulated or hardcoded.

**What's deliberately not built yet** (all real, tracked next phases from
the original vision, not forgotten): live real-time group chat (today's
replies are refresh-based, not instant), the news/Signal feed and topic
clustering, the AI analysis layer and Commons Guide, the Truth Gap
fact/claim/evidence system, Projects, Exchange impact-tracking, the
Human Map, user-capsule visual evolution, contribution-based unlock
levels (right now any signed-in person can start a community or a
thread), and the true navigable 3D sphere (built here as a 2D canvas
that reads as a glowing sphere, not a Three.js/React Three Fiber scene --
a deliberate choice to keep the site light and dependency-free for v1).

## One-time database update for the Commons

Run the Commons block near the bottom of `supabase/schema.sql` in the
Supabase SQL Editor once (communities/threads/replies tables, RLS
policies, the `public_profiles` view, and the `bump_thread_activity`
function). Safe to run more than once.

## The Commons Guide (new)

A small floating AI chat bubble, bottom-right on `/commons` (not shown
on the cinematic first-visit entrance). Click it and ask anything about
Same Heart -- Paths, Star Day, Spark ID, Skins, the Exchange, or what's
currently live in the Commons -- and it answers using Google's Gemini
API. It's a guide, not a member: it never invents specific facts about
your account, and it says so plainly if it doesn't know something.

Two things to set up before it actually answers (until then it shows a
plain "not switched on yet" message instead of erroring):

1. Get a Gemini API key at **aistudio.google.com/api-keys** -- click
   "Create API key" and pick the same Google Cloud project you used for
   Google sign-in, so usage draws on the same free trial credit. Takes
   under a minute, no separate billing setup needed for the trial.
2. Add `GEMINI_API_KEY=<the key>` to `.env.local` for local testing, and
   the same variable under Vercel -> Project Settings -> Environment
   Variables for the live site (then redeploy).
3. Run the new `guide_messages` block at the very bottom of
   `supabase/schema.sql` in the Supabase SQL Editor once -- it's a small
   table that only counts how many questions each person has asked
   today (capped at 40/day) so nobody can run up an unbounded API bill.
   Safe to run more than once.

Nothing here stores or reads the actual content of anyone's questions
past that day's count -- the API key and all prompt logic live only in
`app/api/commons-guide/route.ts`, server-side, never sent to the browser.
