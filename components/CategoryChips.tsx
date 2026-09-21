import { getCategory } from "@/lib/categories";

// A post's topic tags, shown read-only wherever threads are listed or
// opened (see lib/categories.ts). Plain spans on purpose: thread rows
// are already one big link, and filtering by topic lives in the Commons
// topic row, not on each chip.
export default function CategoryChips({ tags, accent = "#c9576a" }: { tags: string[] | null | undefined; accent?: string }) {
  const known = (tags ?? []).map((t) => getCategory(t)).filter((c): c is NonNullable<typeof c> => c !== null);
  if (known.length === 0) return null;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "5px", verticalAlign: "middle" }}>
      {known.map((c) => (
        <span
          key={c.key}
          style={{
            padding: "2px 8px",
            borderRadius: "999px",
            border: `1px solid ${accent}55`,
            color: accent,
            fontFamily: "var(--font-mono)",
            fontSize: "8px",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {c.label}
        </span>
      ))}
    </span>
  );
}
