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

## Campaign domains pointing at the donate function (future)

Raised Sep 1, 2026. Rob wants to eventually run campaigns from separate,
purpose-built domains (e.g. www.kidsneeddads.com) that send people
straight into Same Heart's donate flow ("The Hearth" -- see
lib/galaxyNodes.ts) rather than through sameheart.ca/galaxy directly.
Asked whether this goes through CanSpace specifically or how a
"connected website" like that actually works.

Explained: it doesn't have to be through any particular registrar --
buying the domain anywhere (CanSpace, Namecheap, Cloudflare, GoDaddy,
etc.) works the same way, since DNS configuration is registrar-agnostic.
Two real options once a domain is bought:
1. Plain domain forwarding at the registrar level -- fastest, no code,
   but the browser address bar ends up showing the sameheart.ca
   destination URL rather than staying on the campaign domain.
2. Add the domain as a real custom domain on the Vercel project (DNS
   pointed at Vercel) and build an actual branded landing page for it in
   this codebase -- stays on the campaign's own domain the whole time,
   proper SSL, and can carry real campaign-specific copy/design while
   still using the same underlying Stripe donate link.

Not actioned -- Rob hasn't bought a campaign domain yet. Revisit once he
has one and knows what the campaign page itself should say.

## "Heart Strings" -- renamed from "Keys" (Sep 1, 2026)
Rob's naming call: what were called "Keys" on the site are now called
"Heart Strings" everywhere a visitor actually sees the word -- headings,
blurbs, the Hub's identity card, the locked-page messages on /impact and
/commons/here, the activity-log lines earned alongside them, the About
page, and the site's meta description. Green/Blue/Red/Yellow Heart
String, same four colors and same four doors as before.
Scope: display text only. Internal code/schema names (KeyColor, KEY_INFO,
the profile_keys table, key_color column, /api/keys/* routes,
listMyKeys/evaluateKeys) were deliberately left as "key" -- renaming a
live database table is a real migration with real risk, and none of it
is visible to anyone using the site. Verified via diff against backups
(every string landed exactly as intended, nothing extra touched) and
`npx tsc --noEmit` (clean).

## Yellow Heart String's door -- Signal Sources admin (BUILT Sep 1, 2026)
The Signal's RSS feed list moves from a hardcoded array (lib/rssFeeds.ts)
into a real `feed_sources` table, manageable from a new /admin/signal
page -- same "form submission, not a code deploy" payoff as /admin/skins
had for widget skins. Built:
  - `feed_sources` table (supabase/schema.sql) -- public read, admin
    write (same RLS shape as widget_skins), seeded with the 7 feeds
    already live in code so nothing about the Signal's coverage changes.
  - app/api/cron/fetch-news/route.ts now reads the active, ordered list
    from feed_sources first, and falls back to lib/rssFeeds.ts's
    hardcoded RSS_FEEDS automatically if the table is ever empty or the
    query fails -- a database hiccup can never go quiet the Signal.
  - /admin/signal -- add, edit, turn on/off, delete a source. Turning a
    source off (or deleting it) only stops *new* articles from it;
    nothing already shown to anyone disappears.
  - /admin -- a one-page front door linking Widget Skins and Signal
    Sources, so "where's the admin page" has one answer. /admin/skins
    now links back to it too.
Verified via diff against backups on every edited file, and
`npx tsc --noEmit` (clean). Not yet exercised against a live Supabase
instance in this session -- worth a quick real add/edit/delete pass in
/admin/signal after this deploys, same as any new admin form.

## Monetization: two-stage gate, Rob as the sole approver (idea logged Sep 1, 2026 -- GATE BUILT Sep 1, 2026, see follow-up entry below; payment rails still not started)
Rob's own framing, worth preserving exactly: users can't monetize their
account until they've reached a real, significant level of standing on
the site -- and as they approach it, the site should actively let them
know they're within reach, the same way the Hub already hints "X XP to
Level Y" for Prime Levels. But reaching the threshold only ever makes
someone *eligible*, never automatically monetized -- Rob personally
reviews and approves every single person before real money is ever
involved. "I am the gatekeeper," his words. This is the same shape as
is_admin (one deliberate human checkpoint, not a roles table or an
auto-grant) applied to a much higher-stakes decision.

Two-stage design this implies, once it's actually built:
  1. Eligibility -- a pure, server-trusted signal computed the same way
     every other progression mechanic on the site is (Keys/Heart
     Strings, Evolution/Unlockables, Prime Levels): some real threshold
     on Standing/Level/Heart Strings held, checked against data the
     server already trusts, never a client claim. Exact threshold is
     undecided -- candidates to weigh later: a specific Standing tier,
     a specific prime Level number, holding all four Heart Strings, or
     some combination. Whatever it is, it should read as *earned*, the
     same way everything else on this site does.
  2. Approval -- a manual step only Rob can take, modeled after the
     is_admin dashboards already built (/admin/skins, /admin/signal):
     an applicant list Rob reviews one at a time, approves or declines.
     Nothing about crossing the eligibility threshold in step 1 grants
     anything by itself -- it only unlocks the ability to apply.

Explicitly NOT being built yet, and shouldn't be until Rob says so:
  - No Stripe Connect wiring, no payment rails, no subscription
    mechanics. Rob's plan is to go to a lawyer and a bank first (real
    business bank account, possibly a loan) before any money actually
    moves between users. Building the payment layer before that exists
    would be exactly the kind of over-building-speculative-content this
    project has deliberately avoided all along.
  - No user-facing "you're getting close to monetizing" UI yet either
    -- showing that hint before Rob can actually approve anyone would
    set an expectation the site can't yet deliver on.

Open questions Rob is sitting with, not yet decided:
  - What the actual eligibility threshold should be.
  - What "approved" concretely unlocks on day one (creator
    subscriptions? sponsorship eligibility? something else?) -- see the
    three monetization shapes discussed in chat (creator subscriptions
    behind Standing, brand-sponsored campaigns, a referral cut on real
    Exchange impact).
  - Legal/financial groundwork: lawyer review, business bank account,
    possibly a loan, and a Stripe Connect account (Express vs Standard)
    -- all real-world steps outside this codebase, all prerequisites
    before step 2 above can mean anything.

Next step whenever Rob's ready: pick the eligibility threshold and what
approval unlocks, and only then build the eligibility signal + Rob's
approval queue -- payment wiring stays out of scope until the legal and
banking side is actually in place.

## Monetization gate -- built (Sep 1, 2026)
The eligibility + application + approval scaffolding described above is
live in code (not yet in the live database -- see the SQL migration
Rob still needs to run, same as any schema.sql change this session).
What exists now:
  - lib/evolution.ts -- a new "monetization-eligible" milestone
    unlockable, granted automatically once all four Heart Strings are
    held (keysHeld >= 4). Reuses the existing Evolution engine
    end-to-end; no new signal-computation code was needed.
  - profiles.monetization_approved and a new monetization_applications
    table (supabase/schema.sql) -- one row per profile, status
    pending/approved/denied, RLS lets a user read only their own row
    and lets admins read/write all of them.
  - app/api/monetization/apply/route.ts -- the only place an
    application is ever created; re-checks eligibility itself from
    profile_unlocks, never a client claim. Supports re-applying after a
    denial.
  - app/api/monetization/decide/route.ts -- the only place an
    application is ever approved or denied; re-checks is_admin itself.
    Sets profiles.monetization_approved but wires up nothing further --
    no payment functionality exists yet.
  - app/api/monetization/list/route.ts -- server-side read for the
    admin queue. Needed because profiles' RLS only ever lets someone
    read their own row (no "admins can read every profile" policy
    exists) -- a client-side join the way /admin/skins reads
    widget_skins directly would have silently returned nothing for
    every applicant but Rob himself. Caught this in review before it
    shipped broken.
  - /admin/monetization -- Rob's approval queue, pending and decided
    lists, Approve/Deny buttons. Added to the /admin index.
  - Hub UI -- inside the existing Heart Strings block: a progress hint
    ("X of 4 Heart Strings...") before eligible, an Apply button once
    eligible, and status messages for pending/approved/denied (with a
    re-apply option after a denial).
Verified via diff against backups on every file (all changes additive,
nothing existing removed or altered) and a clean `npx tsc --noEmit`.

Still not started, on purpose: any Stripe Connect wiring, subscriptions,
or actual payment movement. profiles.monetization_approved is just a
flag other future code can check -- it doesn't unlock anything by
itself yet. That stays blocked on Rob's lawyer, business bank account,
and Stripe Connect setup, exactly as planned.

SQL Rob still needs to run in Supabase (additive, safe to run more than
once):

    alter table profiles add column if not exists monetization_approved boolean not null default false;

    create table if not exists monetization_applications (
      id uuid default gen_random_uuid() primary key,
      profile_id uuid not null references profiles(id) on delete cascade,
      status text not null default 'pending',
      applied_at timestamptz default now(),
      decided_at timestamptz,
      decided_by uuid references profiles(id),
      unique (profile_id)
    );

    alter table monetization_applications enable row level security;

    drop policy if exists "Users can see their own application" on monetization_applications;
    create policy "Users can see their own application" on monetization_applications for select
      using (auth.uid() = profile_id);

    drop policy if exists "Admins manage monetization applications" on monetization_applications;
    create policy "Admins manage monetization applications" on monetization_applications for all
      using (auth.uid() in (select id from profiles where is_admin = true))
      with check (auth.uid() in (select id from profiles where is_admin = true));

    notify pgrst, 'reload schema';

## Three small builds from Rob's Sep 1 feedback batch
Rob noticed several real gaps in one message; three were concrete and
straightforward to build immediately:

1. **"Name your ship" prompt at Level 5** -- Rob noticed people show up
   in Commons replies as "Spark #00034" because they never found the
   small, always-available call-sign editor at the top of the Hub. A
   one-time banner (same visual style as the streak/level-up banners)
   now appears the first time someone reaches Level 5 with no
   display_name set, inviting them to name their ship inline, or
   dismiss with "Maybe later" (remembered via localStorage, same
   pattern as the level-up celebration). Never shows again once
   dismissed or once a name's been set. app/hub/page.tsx.

2. **"My Conversations" page** -- investigated Rob's report that
   conversations weren't clickable in Commons; every thread list found
   in the code (Commons homepage's Live now/Unanswered, a community's
   own thread list, search results, the Hub's notification dropdown)
   was already correctly linked to /commons/t/[id]. Couldn't reproduce
   an actual broken link, so if it recurs, worth pinning down exactly
   which element Rob's clicking. Built the explicitly requested page
   regardless, since it's real value either way: /commons/conversations
   lists every thread someone's started or replied to, across every
   community, sorted by most recent activity, each one properly linked.
   Linked from the Commons homepage's top toolbar as "My Conversations".
   lib/commons.ts's new listMyConversations(), app/commons/conversations/page.tsx.

3. **Hub background photo upload** -- the first user-uploaded image on
   the site. lib/skins.ts's header explicitly avoided this for the
   curated site-wide skins ("no upload flow, no moderation surface, no
   new privacy question... for a purely cosmetic feature") -- worth
   being clear that this migration knowingly takes on that surface.
   What keeps it bounded for now: the uploaded image is only ever
   rendered back to the same person who uploaded it (their own
   Hub/Commons background), so there's no exposure to anyone else's
   browser -- but the file is still hosted on Same Heart's
   infrastructure, and there's no content moderation on it. A real gap
   worth remembering if this ever needs to scale past a small, trusted
   user base. New `hub-backgrounds` Supabase Storage bucket (public
   read; folder-per-user RLS for write, enforced by
   storage.objects policies, not just client-side checks),
   profiles.hub_background_url, a "Background" row in the Hub next to
   the Skin picker (Upload photo / Replace photo / Remove), 8MB client-
   side size cap. Old files aren't deleted from storage when replaced --
   a known simplification, worth a real cleanup pass if storage usage
   ever becomes worth watching.

All three verified via diff against backups (fully additive, nothing
existing removed) and a clean `npx tsc --noEmit`.

SQL Rob needs to run for #3 (additive, safe to run more than once):

    alter table profiles add column if not exists hub_background_url text;

    insert into storage.buckets (id, name, public)
    values ('hub-backgrounds', 'hub-backgrounds', true)
    on conflict (id) do nothing;

    drop policy if exists "Anyone can view hub backgrounds" on storage.objects;
    create policy "Anyone can view hub backgrounds" on storage.objects for select
      using (bucket_id = 'hub-backgrounds');

    drop policy if exists "Users can upload their own hub background" on storage.objects;
    create policy "Users can upload their own hub background" on storage.objects for insert
      with check (bucket_id = 'hub-backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);

    drop policy if exists "Users can update their own hub background" on storage.objects;
    create policy "Users can update their own hub background" on storage.objects for update
      using (bucket_id = 'hub-backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);

    drop policy if exists "Users can delete their own hub background" on storage.objects;
    create policy "Users can delete their own hub background" on storage.objects for delete
      using (bucket_id = 'hub-backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);

    notify pgrst, 'reload schema';

## Exchange photo attachments (built Sep 1, 2026)
Rob asked for "beside the drop a link button... a button where you can
upload a picture." Scoped this narrowly on purpose: a transmission still
requires a real link and is still scored by AI purely from that link --
the photo is a purely decorative attachment, shown as a thumbnail next
to the transmission in the Commons feed and on /impact, never fed into
scoring. Uses a new exchange-photos storage bucket (public read,
folder-per-user write). image_url on exchange_transmissions.

Worth being explicit about the difference from the Hub background
upload logged above: that one is only ever shown back to the person who
uploaded it. This one is public -- every Commons member sees it in the
live feed. That's a real, if small, content-moderation surface (anyone
can attach any image to something the whole Commons sees) with no
reporting or takedown path built yet. Worth a proper look before this
goes out past a small trusted group.

Verified via diff against backups (fully additive except the two
expected signature changes -- transmitLink() gaining an imageUrl
param, and its one call site) and a clean `npx tsc --noEmit`.

SQL Rob needs to run (additive, safe to run more than once):

    alter table exchange_transmissions add column if not exists image_url text;

    insert into storage.buckets (id, name, public)
    values ('exchange-photos', 'exchange-photos', true)
    on conflict (id) do nothing;

    drop policy if exists "Anyone can view exchange photos" on storage.objects;
    create policy "Anyone can view exchange photos" on storage.objects for select
      using (bucket_id = 'exchange-photos');

    drop policy if exists "Users can upload their own exchange photos" on storage.objects;
    create policy "Users can upload their own exchange photos" on storage.objects for insert
      with check (bucket_id = 'exchange-photos' and (storage.foldername(name))[1] = auth.uid()::text);

    notify pgrst, 'reload schema';

## "The algorithm" -- compiling people's info to correlate and connect them (NOT BUILT, paused for discussion)
In the same message as the photo-upload ask, Rob described wanting
"the system so smart it knows to take peoples information and
compiling it for others... building an algorithm for the website and
each user and website as a whole simultaneously" -- using uploaded
photos and other information as "reference points... for future
correlation and communications between relevant members."　Deliberately
did NOT build anything toward this, and explained why directly in
chat rather than silently building a narrower version of it. Real
open questions before this should become code: what specifically gets
compiled and about whom, who can see the compiled result (this is the
part that's most different from everything else built so far -- Keys,
Standing, Path, etc. are all either private to one person or already
freely visible; a system that correlates people's information *for
other people to see* is a new kind of thing on this site), what a user
is actually told and asked to consent to before their information
feeds it, and how it interacts with the fact that Same Heart already
handles real people's real personal and emotional information across
Star Day/Path, the Exchange, and Commons. Not a rejection -- a "let's
design this deliberately before writing it" pause, same spirit as the
monetization gate above.

## Kindred Sparks -- direction confirmed, shelved for now (Rob's call, Sep 1, 2026)
Rob's answer to the algorithm question: the "find people with something
in common" version resonates, not the "compile a fuller picture of
someone for others" version. Good -- that's a meaningfully smaller,
safer thing to build. Not started yet; a real first design still needs:
which already-visible signals count as "something in common" (Path
archetype is the obvious first one -- it's already shown to everyone
via public_profiles; World Issues someone's transmitted about via the
Exchange is a second candidate, also already public), where it shows up
(a small "kindred sparks" widget on the Hub? Its own page?), and whether
it's opt-in or on by default. Deliberately scoped to signals that are
already visible elsewhere on the site rather than anything new or
private, so this stays the safer version of the idea by construction,
not just by good intentions. Rob's explicit call: scrap it for now, keep it in the docket. Not
dead, just not active -- whenever it comes back up, the next step is
still a concrete mockup of what one "kindred spark" suggestion actually
looks like, before writing the matching logic itself.

## The Arcade + icosahedron icons (built Sep 1, 2026)
Two from the same message:
  - Every Galaxy node except the Hearth (which keeps its own
    dodecahedron, chosen deliberately when Rob asked for it as the
    donate node's distinct symbol) now shows a hexagon-faceted
    icosahedron glyph inside its glowing orb, instead of a plain color
    pulse with no icon. Both glyph types now spin continuously while
    the pointer's over the node (2.4s linear loop), and stop under
    prefers-reduced-motion like every other animation on this page.
    lib/galaxyNodes.ts's `icon` field, app/galaxy/page.tsx's new
    .galaxy-node-icon CSS.
  - The Arcade -- a new Galaxy destination (opposite the Hub) for
    Rob's "funny little games" idea. Built as an honest "coming soon"
    placeholder, same ComingSoon shell Wallet and Field Guide already
    use, rather than inventing a game he didn't ask for or a fake list
    with nothing in it. Ready to receive the first real game whenever
    Rob has one specced out -- app/games/page.tsx.
Verified via diff against backups (fully additive except the one
widened type on GalaxyNode.icon) and a clean `npx tsc --noEmit`. No
database migration needed for either.
