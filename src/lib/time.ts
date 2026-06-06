// Inline time support. A todo label can carry a time anywhere in its body — just
// type it (e.g. "13:30 开会", "复盘 15:00-16:00", "和老板 14:00 对齐"). Like tags,
// this only affects rendering + sorting; the label text is untouched.

import { parseLabel } from './tags'

// A valid 24h time: 00:00–23:59, two-digit minutes.
const T = '(?:[01]?\\d|2[0-3]):[0-5]\\d'
// A bare time anywhere in the body (optionally a range, e.g. "13:30" or
// "13:30-14:00"). The look-behind/ahead keep it from matching inside a longer
// digit run (ports, HH:MM:SS, etc.).
const TIME_RE = new RegExp(
  `(?<![\\d:])(${T})(?:\\s*[-–~到至]\\s*(${T}))?(?![\\d:])`,
  'g',
)

export interface TimeInfo {
  /** Start time in minutes since midnight. */
  start: number
  /** End time in minutes, or null for a single time. */
  end: number | null
  /** End is on the next day (end <= start). */
  crossMidnight: boolean
}

export type RichKind = 'tag' | 'time' | 'text'

export interface RichSegment {
  kind: RichKind
  text: string
  tag?: string
  time?: TimeInfo
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function makeTime(start: string, end: string | null): TimeInfo {
  const s = toMinutes(start)
  const e = end ? toMinutes(end) : null
  return { start: s, end: e, crossMidnight: e !== null && e <= s }
}

function display(start: string, end: string | null): string {
  return end ? `${start}–${end}` : start
}

// Emit text, splitting edge whitespace into its own segments so a completed
// item's strikethrough can cover the words without crossing inter-chip gaps.
function emitText(text: string, out: RichSegment[]): void {
  if (!text) return
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)
  if (!m) {
    out.push({ kind: 'text', text })
    return
  }
  const [, lead, core, trail] = m
  if (lead) out.push({ kind: 'text', text: lead })
  if (core) out.push({ kind: 'text', text: core })
  if (trail) out.push({ kind: 'text', text: trail })
}

// Split a string into text / time segments on bare time occurrences.
function scanTimes(text: string, onTime: (t: TimeInfo) => void): RichSegment[] {
  const segs: RichSegment[] = []
  let last = 0
  TIME_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TIME_RE.exec(text))) {
    if (m.index > last) emitText(text.slice(last, m.index), segs)
    const time = makeTime(m[1], m[2] ?? null)
    onTime(time)
    segs.push({ kind: 'time', text: display(m[1], m[2] ?? null), time })
    last = m.index + m[0].length
  }
  if (last < text.length) emitText(text.slice(last), segs)
  return segs
}

export interface ParsedRich {
  segments: RichSegment[]
  tags: string[]
  /** The primary (first) time in the label, used for sorting. */
  time: TimeInfo | null
}

export function parseLabelRich(label: string): ParsedRich {
  const base = parseLabel(label)
  const out: RichSegment[] = []
  let primary: TimeInfo | null = null

  const claim = (t: TimeInfo) => {
    if (!primary) primary = t
  }

  for (const seg of base.segments) {
    if (seg.tag) {
      out.push({ kind: 'tag', text: seg.text, tag: seg.tag })
      continue
    }
    out.push(...scanTimes(seg.text, claim))
  }

  return { segments: out, tags: base.tags, time: primary }
}

/** The primary time of a label, for sorting (null if none). */
export function getTime(label: string): TimeInfo | null {
  return parseLabelRich(label).time
}
