"use client";

// Guidance Tier 3 -- "can tag a resource with a category" (see
// lib/practices.ts). A plain select over WORLD_ISSUES (lib/worldIssues.ts),
// the same fixed taxonomy the Exchange already scores transmissions
// against -- reused here rather than a second category system, so a
// Resource Shelf item and a transmission about the same real-world
// issue share one vocabulary. "Uncategorized" writes null, not an
// empty string, matching how ShelfItem.issue_key is typed.
import { WORLD_ISSUES } from "@/lib/worldIssues";

const UNCATEGORIZED = "__uncategorized__";

export default function ShelfCategoryPicker({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (issueKey: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value ?? UNCATEGORIZED}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === UNCATEGORIZED ? null : e.target.value)}
      style={{
        padding: "3px 6px",
        borderRadius: "6px",
        border: "1px solid var(--widget-border)",
        background: "var(--widget-panel, transparent)",
        color: "var(--widget-text-faint)",
        fontFamily: "var(--font-mono)",
        fontSize: "8px",
        letterSpacing: "0.03em",
        textTransform: "uppercase",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <option value={UNCATEGORIZED}>Uncategorized</option>
      {WORLD_ISSUES.map((issue) => (
        <option key={issue.key} value={issue.key}>
          {issue.label}
        </option>
      ))}
    </select>
  );
}
