// Same Heart -- Commons topic categories.
//
// A fixed, curated list of what people actually talk about in the
// Commons, matched against a post while it's being written so relevant
// topics can be suggested on the spot (see components/CategoryPicker.tsx)
// and stored on the post (commons_threads.tags). This is the first half
// of the curation engine from PLAN.md's "Connecting hearts" section: tag
// what's posted now, so there's a stable vocabulary for the algorithm
// to learn people's interests from later.
//
// Deliberately separate from lib/worldIssues.ts: that list is a scoring
// rubric for the Exchange (how much real-world impact does a link have?),
// while these are conversational topics -- someone sharing a grief story
// or a garden project belongs here even though neither is a "world
// issue." A few keys overlap in spirit (climate, human rights); they stay
// independent so either list can change without touching the other.
//
// Suggestions are plain keyword matching, on purpose: instant, free, no
// API call per keystroke, and fully predictable. Keywords are base forms;
// the matcher tolerates simple plural/verb endings. Keep entries
// concrete and specific -- broad words that show up everywhere ("time",
// "people") would tag every post with everything.

export interface Category {
  key: string;
  label: string;
  keywords: string[];
}

export const CATEGORIES: Category[] = [
  {
    key: "personal-story",
    label: "My Story",
    keywords: ["my story", "my journey", "growing up", "i went through", "i experienced", "looking back", "coming out", "survivor", "lived experience"],
  },
  {
    key: "mental-health",
    label: "Mental Health & Healing",
    keywords: ["anxiety", "depression", "therapy", "therapist", "grief", "grieving", "trauma", "burnout", "healing", "lonely", "loneliness", "panic", "stress", "self care", "mental health"],
  },
  {
    key: "relationships-family",
    label: "Relationships & Family",
    keywords: ["relationship", "partner", "marriage", "divorce", "parent", "parenting", "kid", "child", "children", "family", "dating", "breakup", "friendship", "sibling", "mother", "father"],
  },
  {
    key: "work-money",
    label: "Work & Money",
    keywords: ["job", "career", "boss", "salary", "debt", "budget", "rent", "layoff", "business", "income", "savings", "unemployed", "interview", "invest"],
  },
  {
    key: "health-body",
    label: "Health & Body",
    keywords: ["health", "doctor", "sleep", "diet", "exercise", "illness", "chronic", "pain", "fitness", "nutrition", "disability", "medication", "hospital"],
  },
  {
    key: "learning-skills",
    label: "Learning & Skills",
    keywords: ["learn", "study", "school", "course", "skill", "teach", "teacher", "book", "student", "college", "university", "tutorial", "mentor"],
  },
  {
    key: "creativity-art",
    label: "Creativity & Art",
    keywords: ["art", "artist", "music", "song", "poem", "poetry", "write", "writing", "design", "paint", "painting", "creative", "photography", "drawing", "film"],
  },
  {
    key: "tech-ai",
    label: "Technology & AI",
    keywords: ["ai", "artificial intelligence", "software", "code", "coding", "app", "algorithm", "robot", "robotics", "tech", "technology", "automation", "chatbot", "machine learning"],
  },
  {
    key: "news-world",
    label: "World & News",
    keywords: ["news", "war", "election", "government", "policy", "crisis", "headline", "politics", "ceasefire", "refugee", "economy"],
  },
  {
    key: "climate-nature",
    label: "Climate & Nature",
    keywords: ["climate", "environment", "nature", "garden", "gardening", "wildlife", "pollution", "sustainable", "sustainability", "recycling", "forest", "ocean", "renewable"],
  },
  {
    key: "community-giving",
    label: "Community & Giving",
    keywords: ["volunteer", "donate", "donation", "charity", "neighbour", "neighbor", "community", "mutual aid", "fundraiser", "nonprofit", "help others", "give back"],
  },
  {
    key: "meaning-spirit",
    label: "Meaning & Spirituality",
    keywords: ["faith", "meditation", "spiritual", "spirituality", "purpose", "meaning", "gratitude", "prayer", "mindfulness", "soul", "god"],
  },
  {
    key: "identity-culture",
    label: "Identity & Culture",
    keywords: ["culture", "heritage", "immigrant", "immigration", "language", "identity", "tradition", "diaspora", "belonging", "ancestry", "newcomer"],
  },
  {
    key: "justice-rights",
    label: "Justice & Rights",
    keywords: ["rights", "justice", "discrimination", "equality", "racism", "freedom", "injustice", "prejudice", "equity", "protest"],
  },
  {
    key: "play-fun",
    label: "Play & Fun",
    keywords: ["game", "gaming", "movie", "show", "humor", "joke", "sport", "hobby", "funny", "meme", "travel", "recipe", "cooking"],
  },
  {
    key: "ideas-projects",
    label: "Ideas & Projects",
    keywords: ["idea", "project", "startup", "build", "prototype", "invention", "launch", "collaborate", "collaboration", "side project", "brainstorm"],
  },
];

export const MAX_TAGS = 3;

// A title hit is worth more than a body hit -- what someone chose to
// put in the headline is the strongest signal of what the post is about.
const TITLE_WEIGHT = 2;
const BODY_WEIGHT = 1;
// One stray body mention isn't enough; it takes a title hit or at least
// two different body keywords before a topic is suggested.
const MIN_SCORE = 2;

export function getCategory(key: string | null | undefined): Category | null {
  return CATEGORIES.find((c) => c.key === key) ?? null;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-word match with tolerance for simple endings, so "job" matches
// "jobs" but "art" never matches "article" or "party".
function hasKeyword(text: string, keyword: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegExp(keyword)}(?:s|es|ed|ing|d)?\\b`, "i");
  return pattern.test(text);
}

export function suggestCategories(title: string, body: string, limit = MAX_TAGS): string[] {
  const titleText = title.toLowerCase();
  const bodyText = body.toLowerCase();
  if (!titleText.trim() && !bodyText.trim()) return [];

  const scored: { key: string; score: number; order: number }[] = [];
  CATEGORIES.forEach((category, order) => {
    let score = 0;
    for (const keyword of category.keywords) {
      if (hasKeyword(titleText, keyword)) score += TITLE_WEIGHT;
      if (hasKeyword(bodyText, keyword)) score += BODY_WEIGHT;
    }
    if (score >= MIN_SCORE) scored.push({ key: category.key, score, order });
  });

  return scored
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((s) => s.key);
}

// Anything stored or submitted gets filtered back down to real keys, so
// a tampered or outdated tag can never end up displayed or filtered on.
export function cleanTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const valid = tags.filter((t): t is string => typeof t === "string" && getCategory(t) !== null);
  return Array.from(new Set(valid)).slice(0, MAX_TAGS);
}
