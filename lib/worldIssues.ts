// Same Heart -- The Exchange's issue taxonomy.
//
// A fixed, curated list of the world's most prevalent problem areas.
// Every link transmitted into the Exchange gets weighed against this
// list by the scoring model (see app/api/exchange/transmit/route.ts) --
// this file is the actual rubric, not just labels, so keep the
// descriptions concrete enough that a model (or a person) could use them
// to judge relevance and severity, not just pick a vibe.
//
// Deliberately a fixed list rather than model-invented categories: it
// keeps scoring consistent over time and makes the Roster/Exchange feed
// filterable by something stable.

export interface WorldIssue {
  key: string;
  label: string;
  description: string;
}

export const WORLD_ISSUES: WorldIssue[] = [
  {
    key: "conflict-peace",
    label: "Conflict & Peace",
    description: "War, armed conflict, ceasefires, refugee displacement, and peace-building efforts.",
  },
  {
    key: "humanitarian-crisis",
    label: "Humanitarian Crisis",
    description: "Famine, natural disasters, disease outbreaks, and large-scale emergency relief.",
  },
  {
    key: "poverty-inequality",
    label: "Poverty & Inequality",
    description: "Economic hardship, wealth inequality, housing insecurity, and access to basic needs.",
  },
  {
    key: "climate-environment",
    label: "Climate & Environment",
    description: "Climate change, extreme weather, biodiversity loss, and environmental degradation.",
  },
  {
    key: "public-health",
    label: "Public Health",
    description: "Disease, healthcare access, mental health, and public wellbeing at scale.",
  },
  {
    key: "human-rights",
    label: "Human Rights & Justice",
    description: "Civil liberties, discrimination, exploitation, and access to justice.",
  },
  {
    key: "education-access",
    label: "Education & Opportunity",
    description: "Access to education, skills, and genuine paths to a better life.",
  },
  {
    key: "governance-corruption",
    label: "Governance & Corruption",
    description: "Corruption, institutional failure, transparency, and the health of democratic systems.",
  },
  {
    key: "misinformation",
    label: "Misinformation & Media Literacy",
    description: "False or misleading information, and efforts to correct the record or explain events clearly.",
  },
  {
    key: "technology-society",
    label: "Technology & Society",
    description: "How new technology (AI included) is reshaping work, safety, and human connection.",
  },
];

export function getWorldIssue(key: string | null | undefined): WorldIssue | null {
  return WORLD_ISSUES.find((i) => i.key === key) ?? null;
}
