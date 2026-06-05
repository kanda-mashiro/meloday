// Inline hashtag support. Tags live inside a todo's label so the data model
// stays simple and exports remain human-readable.
//
// Two encodings are understood when rendering:
//   1. Pipe form (what the tag-aware input writes):
//        "#for me #recur | 清理邮箱"  →  tags ["for me","recur"], body "清理邮箱"
//      Tags before the first '|' may contain spaces; the '|' ends the tag zone.
//   2. Inline form (loose typing / imported data):
//        "buy #milk and #eggs"  →  inline single-word tags
//
// A multi-word tag must be written in pipe form, since spaces are otherwise
// ambiguous.

// Inline tag: '#' + unicode letters/numbers, underscore or hyphen (CJK works too).
const TAG_RE = /#[\p{L}\p{N}_-]+/gu

export interface LabelSegment {
  /** Display text (tags include the leading '#'). */
  text: string
  /** Tag name without '#', or null for plain text. */
  tag: string | null
}

export interface ParsedLabel {
  segments: LabelSegment[]
  /** Lowercased, de-duplicated tag names. */
  tags: string[]
}

function inlineSegments(text: string): LabelSegment[] {
  const segments: LabelSegment[] = []
  let last = 0
  for (const match of text.matchAll(TAG_RE)) {
    const index = match.index ?? 0
    if (index > last) segments.push({ text: text.slice(last, index), tag: null })
    segments.push({ text: match[0], tag: match[0].slice(1) })
    last = index + match[0].length
  }
  if (last < text.length) segments.push({ text: text.slice(last), tag: null })
  return segments
}

export function parseLabel(label: string): ParsedLabel {
  const pipe = label.indexOf('|')

  // Pipe form: everything before '|' that contains a '#' is the tag zone.
  if (pipe !== -1 && label.slice(0, pipe).includes('#')) {
    const zone = label.slice(0, pipe)
    const body = label.slice(pipe + 1).replace(/^\s+/, '')
    const segments: LabelSegment[] = []
    const tags: string[] = []

    for (const part of zone.split('#')) {
      const name = part.trim()
      if (!name) continue
      segments.push({ text: `#${name}`, tag: name })
      tags.push(name.toLowerCase())
    }

    if (body) {
      segments.push({ text: ' ', tag: null })
      for (const seg of inlineSegments(body)) {
        segments.push(seg)
        if (seg.tag) tags.push(seg.tag.toLowerCase())
      }
    }

    return { segments, tags: [...new Set(tags)] }
  }

  // Inline form.
  const segments = inlineSegments(label)
  const tags = [
    ...new Set(
      segments.filter((s) => s.tag).map((s) => (s.tag as string).toLowerCase()),
    ),
  ]
  return { segments, tags }
}

/** Segments for rendering a label. */
export function parseSegments(label: string): LabelSegment[] {
  return parseLabel(label).segments
}

/** All tag names in a label, lowercased and de-duplicated. */
export function extractTags(label: string): string[] {
  return parseLabel(label).tags
}

/** Does this label carry the given tag? */
export function hasTag(label: string, tag: string): boolean {
  return extractTags(label).includes(tag.toLowerCase())
}

/** Build a label string from committed tags + body (pipe form). */
export function buildLabel(tags: string[], body: string): string {
  const trimmedBody = body.trim()
  const cleanTags = tags.map((t) => t.trim()).filter(Boolean)
  if (cleanTags.length === 0) return trimmedBody
  const tagPart = cleanTags.map((t) => `#${t}`).join(' ')
  return trimmedBody ? `${tagPart} | ${trimmedBody}` : `${tagPart} |`
}

/** Stable hue (0–359) derived from the tag name. */
export function tagHue(tag: string): number {
  let hash = 0
  for (const ch of tag.toLowerCase()) {
    hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0
  }
  return hash % 360
}
