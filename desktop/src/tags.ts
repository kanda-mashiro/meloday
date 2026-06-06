// Tag helpers, mirrored from the web app's src/lib/tags.ts so the capture bar's
// tag input behaves and looks identical. Keep in sync if the web version changes.

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
