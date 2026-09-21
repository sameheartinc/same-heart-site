"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIES, MAX_TAGS, getCategory, suggestCategories } from "@/lib/categories";

// The on-the-spot curation step for a new post (see lib/categories.ts):
// as someone writes, matching topics are suggested and selected for them,
// and they can tap to remove one, swap in another, or add from the full
// list. Once they change anything themselves, their choice wins -- the
// picker keeps suggesting, but never overwrites a selection they made.
export default function CategoryPicker({
  title,
  body,
  value,
  onChange,
  accent = "#c9576a",
}: {
  title: string;
  body: string;
  value: string[];
  onChange: (tags: string[]) => void;
  accent?: string;
}) {
  const [suggested, setSuggested] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const touchedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!title.trim() && !body.trim()) touchedRef.current = false;
      const next = suggestCategories(title, body);
      setSuggested(next);
      if (!touchedRef.current) onChangeRef.current(next);
    }, 350);
    return () => clearTimeout(timer);
  }, [title, body]);

  function toggle(key: string) {
    touchedRef.current = true;
    if (value.includes(key)) onChange(value.filter((k) => k !== key));
    else if (value.length < MAX_TAGS) onChange([...value, key]);
  }

  const shown = Array.from(new Set([...value, ...suggested]));
  const more = CATEGORIES.filter((c) => !shown.includes(c.key));
  const full = value.length >= MAX_TAGS;

  return (
    <div style={{ marginBottom: "10px" }}>
      <p
        style={{
          margin: "0 0 6px",
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--ink-faint, #5c6684)",
        }}
      >
        Topics {shown.length === 0 ? "-- suggested as you write" : `-- up to ${MAX_TAGS}, tap to change`}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {shown.map((key) => {
          const category = getCategory(key);
          if (!category) return null;
          const selected = value.includes(key);
          return (
            <button
              type="button"
              key={key}
              onClick={() => toggle(key)}
              disabled={!selected && full}
              aria-pressed={selected}
              style={chipStyle(selected, accent, !selected && full)}
            >
              {category.label}
            </button>
          );
        })}
        <button type="button" onClick={() => setShowAll((v) => !v)} style={moreStyle}>
          {showAll ? "Less" : "+ More"}
        </button>
      </div>
      {showAll && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
          {more.map((category) => (
            <button
              type="button"
              key={category.key}
              onClick={() => toggle(category.key)}
              disabled={full}
              aria-pressed={false}
              style={chipStyle(false, accent, full)}
            >
              {category.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function chipStyle(selected: boolean, accent: string, disabled: boolean): React.CSSProperties {
  return {
    padding: "5px 11px",
    borderRadius: "999px",
    border: `1px ${selected ? "solid" : "dashed"} ${selected ? accent : "var(--border)"}`,
    background: selected ? `${accent}22` : "transparent",
    color: selected ? accent : "var(--ink-dim)",
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    letterSpacing: "0.03em",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.45 : 1,
  };
}

const moreStyle: React.CSSProperties = {
  padding: "5px 11px",
  borderRadius: "999px",
  border: "1px solid transparent",
  background: "none",
  color: "var(--ink-faint, #5c6684)",
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  cursor: "pointer",
};
