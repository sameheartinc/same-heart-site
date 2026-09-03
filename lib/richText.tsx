import type { ReactNode } from "react";

// Voice Tier 2 -- rich text formatting, bold and italic only (see
// lib/practices.ts). Deliberately NOT a markdown library and NOT
// dangerouslySetInnerHTML: this hand-rolls exactly two patterns and only
// ever produces React elements (<strong>/<em>) wrapping plain-text
// nodes, so there is no way for a post body to inject real HTML or
// scripts no matter what someone types -- React escapes every text node
// it renders, same as {thread.body} always has.
//
// Applies to every thread body regardless of the poster's own Practice
// tier -- there's nothing to enforce server-side anyway (this is display
// logic, not a write), and the composer toolbar is what Tier 2 actually
// gates (see app/commons/c/[slug]/page.tsx). A Tier 0 thread that
// happens to contain "**word**" renders with real bold; that's the same
// low-stakes trade-off any lightweight markdown adoption makes, and
// nothing of real value (XP, trust, money) rides on it.
//
// Supports **bold**, *italic*, and ***bold italic*** -- nothing else.
// No links, headers, or lists (those are later Voice tiers, see
// lib/practices.ts). Threads only for now, same as Tier 1's image/
// resource attachments -- replies aren't run through this yet.
const PATTERN = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*/g;

export function renderRichText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      nodes.push(
        <strong key={key++}>
          <em>{match[1]}</em>
        </strong>
      );
    } else if (match[2] !== undefined) {
      nodes.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      nodes.push(<em key={key++}>{match[3]}</em>);
    }
    lastIndex = PATTERN.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}
