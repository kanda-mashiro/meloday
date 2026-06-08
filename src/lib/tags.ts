// Tag helpers. Tags now live in a structured `TodoItem.tags` array (names
// without '#'); this module derives display + priority info from them. The tag
// input still recognizes a leading '#' to start a tag (see TAG_RE).

// Inline tag: '#' + unicode letters/numbers, underscore, hyphen or dot (CJK works
// too), so names like "llama.cpp" / "node.js" stay whole.
export const TAG_RE = /#[\p{L}\p{N}_.-]+/gu

/** Does this item carry the given tag (case-insensitive)? */
export function hasTag(tags: string[], tag: string): boolean {
  return tags.some((t) => t.toLowerCase() === tag.toLowerCase())
}

/**
 * A flat human string for DISPLAY-ONLY contexts (e.g. a panel title, a search
 * row). Never re-parsed back into structured data.
 */
export function labelText(item: { tags: string[]; text: string }): string {
  return [...item.tags.map((t) => '#' + t), item.text].filter(Boolean).join(' ')
}

/** Stable hue (0–359) derived from the tag name. */
export function tagHue(tag: string): number {
  let hash = 0
  for (const ch of tag.toLowerCase()) {
    hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0
  }
  return hash % 360
}

// --- priority tags -----------------------------------------------------------
// #p0 (highest) … #p2 render as fixed-color badges + a row accent instead of the
// usual hashed color, so importance reads at a glance. Case-insensitive.
export type PriorityLevel = 'p0' | 'p1' | 'p2'
const PRIORITY_LEVELS: readonly string[] = ['p0', 'p1', 'p2']

/** If `tag` names a priority (p0/p1/p2), return it lowercased, else null. */
export function priorityLevel(tag: string): PriorityLevel | null {
  const k = tag.toLowerCase()
  return PRIORITY_LEVELS.includes(k) ? (k as PriorityLevel) : null
}

/** The highest priority among a label's tags (p0 wins), or null. */
export function topPriority(tags: string[]): PriorityLevel | null {
  let best: PriorityLevel | null = null
  for (const t of tags) {
    const lvl = priorityLevel(t)
    if (lvl && (best === null || lvl < best)) best = lvl
  }
  return best
}
