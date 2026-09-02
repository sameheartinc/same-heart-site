// Same Heart -- Deep Signals.
//
// Rob's own framing (Sep 2, 2026): anyone can go to Google and search
// things -- what's worth coming back to is the collective experience of
// unlocking something real, one signal at a time, that actually helps
// with two things he named directly: (1) the gap in media/information
// literacy that makes it hard to reason clearly about the world's
// problems, and (2) the drug use crisis in North America and the lack of
// real, productive futures for young people. So each Signal below is a
// genuinely concrete, sourced piece of information on one of those two
// fronts -- not a vague inspirational quote, and not fabricated
// statistics. Every claim here was checked against its cited source on
// Sep 2, 2026; re-check before adding new Signals or if this file gets
// old.
//
// Deliberately a plain, ordered, pure-data sequence -- like Prime Levels
// (lib/primeLevels.ts) itself, there's no new database table. Signal N
// unlocks exactly when someone reaches Level N; the Deep Signals page
// computes "which signals are unlocked" fresh from XP every time, the
// same way Prime Levels computes Level fresh from XP. Nothing to persist,
// nothing to go stale except the content itself.

export type SignalCategory = "media-literacy" | "youth-futures";

export const CATEGORY_LABELS: Record<SignalCategory, string> = {
  "media-literacy": "Reading the Signal Clearly",
  "youth-futures": "Real Paths Forward",
};

export interface DeepSignal {
  id: number;
  unlockLevel: number;
  category: SignalCategory;
  title: string;
  // Shown as the mystery hint on the "next up" card before it unlocks,
  // and again as a subhead once it's actually unlocked.
  teaser: string;
  body: string;
  sourceLabel?: string;
  sourceHref?: string;
  // A small number of Signals point somewhere on Same Heart itself
  // (e.g. Support Services) instead of an external source.
  internalHref?: string;
  internalLabel?: string;
}

export const DEEP_SIGNALS: DeepSignal[] = [
  {
    id: 1,
    unlockLevel: 1,
    category: "media-literacy",
    title: "The Four-Move Signal",
    teaser: "The first real skill for reading anything online -- most people never learn it.",
    body: "When something online grabs you before you've checked it, there's a simple discipline for it: Stop before you react or share. Investigate the source -- who's behind it, and why. Find better coverage -- see what other, more reliable outlets say about the same claim. Trace the claim, quote, or image back to where it actually came from. It's called the SIFT method, developed by digital literacy researcher Mike Caulfield, and it takes seconds once it's a habit.",
    sourceLabel: "The SIFT Method",
    sourceHref: "https://libguides.ucmerced.edu/news/evaluation/sift-method",
  },
  {
    id: 2,
    unlockLevel: 2,
    category: "youth-futures",
    title: "The Strongest Protection Isn't a Warning Label",
    teaser: "The single biggest thing that keeps a young person safe from substance use isn't what you'd expect.",
    body: "Decades of research on adolescent health point to the same finding again and again: feeling genuinely connected to a parent, mentor, or community is one of the strongest protective factors against substance use in young people -- often outperforming anti-drug messaging on its own. Showing up, consistently, for one young person in your own life may do more real prevention work than any campaign.",
    sourceLabel: "HHS -- Substance Use in Adolescence",
    sourceHref: "https://opa.hhs.gov/adolescent-health/substance-use-adolescence",
  },
  {
    id: 3,
    unlockLevel: 3,
    category: "media-literacy",
    title: "Read Sideways, Not Down",
    teaser: "The technique professional fact-checkers actually use -- it's the opposite of what most people do.",
    body: "Most people evaluate a suspicious page by reading further down that same page -- professional fact-checkers do the opposite. They leave immediately and open new tabs to see what other sources say about it. It's called lateral reading, and a large study across Canadian classrooms found that teaching it measurably improved students' ability to spot misinformation.",
    sourceLabel: "UW study: lateral reading in Canadian classrooms",
    sourceHref: "https://cip.uw.edu/2021/12/07/lateral-reading-canada-civix-study",
  },
  {
    id: 4,
    unlockLevel: 4,
    category: "youth-futures",
    title: "A Number Worth Knowing",
    teaser: "The headlines about this haven't caught up to the data yet.",
    body: "Drug overdose deaths in the US fell sharply through 2024 and into 2025 -- reaching a five-year low, and roughly 14% lower in 2025 than the year before, according to CDC data. Wider naloxone access, expanded treatment, and prevention work are cited among the reasons. It doesn't mean the problem is solved, but it's real evidence that deliberate, sustained effort moves this number -- it isn't fixed.",
    sourceLabel: "STAT News: US overdose deaths fell through most of 2025",
    sourceHref: "https://www.statnews.com/2026/01/14/us-overdose-deaths-fell-through-most-of-2025/",
  },
  {
    id: 5,
    unlockLevel: 5,
    category: "media-literacy",
    title: "The Feeling Is the Signal",
    teaser: "The moment content makes you feel something intensely is exactly the moment to slow down.",
    body: "Content engineered to provoke strong emotion -- outrage, fear, triumph -- spreads faster and gets shared before anyone checks it, whether or not it's true. Treat a sudden strong reaction as a built-in checkpoint: notice the feeling, then verify before sharing. The people and systems most interested in your reaction are rarely the ones most interested in your accuracy.",
    sourceLabel: "News Literacy Project",
    sourceHref: "https://newslit.org/",
  },
  {
    id: 6,
    unlockLevel: 6,
    category: "youth-futures",
    title: "Prevention That Actually Works",
    teaser: "Not the assemblies you remember from school -- the version backed by decades of research.",
    body: "The National Institute on Drug Abuse's research-based prevention principles found that one-off 'just say no' style messaging does little on its own. What actually moves outcomes: teaching real skills (problem-solving, coping, practiced refusal skills), starting early, and involving family and community -- not fear or repetition alone.",
    sourceLabel: "NIDA: Preventing Drug Use Among Children and Adolescents",
    sourceHref: "https://nida.nih.gov/sites/default/files/redbook_0.pdf",
  },
  {
    id: 7,
    unlockLevel: 7,
    category: "media-literacy",
    title: "If It's True, It Won't Be Alone",
    teaser: "One of the fastest ways to catch a false claim, in one sentence.",
    body: "A genuinely important or surprising claim that's actually true will almost always be independently reported by more than one credible outlet. If a search turns up only the original post and nothing else covering it, that absence is itself useful information -- it doesn't prove the claim false, but it means real verification hasn't happened yet.",
    sourceLabel: "The SIFT Method",
    sourceHref: "https://libguides.ucmerced.edu/news/evaluation/sift-method",
  },
  {
    id: 8,
    unlockLevel: 8,
    category: "youth-futures",
    title: "Give Someone Somewhere Real to Go",
    teaser: "The prevention strategy that looks nothing like a prevention program.",
    body: "Programs that connect young people to real opportunity -- paid job training, mentorship, structured after-school involvement, a genuine path toward something -- consistently show stronger results against substance use risk than isolated drug-education classes taught on their own. Purpose and a plausible future are protective in a way that information alone isn't.",
    sourceLabel: "Youth.gov: Substance Use Prevention",
    sourceHref: "https://youth.gov/youth-topics/substance-use/prevention",
  },
  {
    id: 9,
    unlockLevel: 9,
    category: "media-literacy",
    title: "Follow It to Where It Actually Came From",
    teaser: "The step most people skip, and the one that changes the meaning most often.",
    body: "A quote, statistic, image, or video stripped from its original context can end up saying the opposite of what it originally meant. Before repeating a striking number or line, trace it back to its original source -- the actual study, the full speech, the unedited clip. Context isn't a footnote; for a lot of viral claims, it's the whole story.",
    sourceLabel: "The SIFT Method",
    sourceHref: "https://libguides.ucmerced.edu/news/evaluation/sift-method",
  },
  {
    id: 10,
    unlockLevel: 10,
    category: "youth-futures",
    title: "If This Is About Someone You Know",
    teaser: "Not everything here is an idea to sit with -- some of it is meant to be used today.",
    body: "If you or someone you know is dealing with substance use, or just needs somewhere real to start, Same Heart's own Support Services page has verified, current helplines for the US and Canada -- crisis lines, treatment referrals, and youth-specific support, all free and confidential.",
    internalLabel: "Open Support Services",
    internalHref: "/support",
  },
];
