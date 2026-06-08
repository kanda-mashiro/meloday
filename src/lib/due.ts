// Inline deadline ("DDL") token: a "!" immediately followed by a date
// expression, typed anywhere in a todo label. Parsed OUT of the label into a
// structured due date (date-only, "YYYY-MM-DD"); the token is removed from the
// visible text, like a #tag. Relative dates resolve against `today`.
//
// Accepts after "!":  2026-06-12 | 6/12 | 今天 | 明天 | 后天 |
//                     周一..周日/周天/周N | N天后 | N周后 | today | tomorrow

export interface DueParse {
  /** The label with the !token removed. */
  text: string
  /** Resolved due date "YYYY-MM-DD", or null if no valid token was found. */
  due: string | null
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function addDays(base: Date, n: number): Date {
  const d = startOfDay(base)
  d.setDate(d.getDate() + n)
  return d
}
// Next occurrence of ISO weekday 1..7 (Mon..Sun). The same weekday as today
// resolves to NEXT week (so "周五" typed on a Friday means the coming Friday).
function nextWeekday(today: Date, iso: number): Date {
  const cur = today.getDay() === 0 ? 7 : today.getDay()
  let delta = iso - cur
  if (delta <= 0) delta += 7
  return addDays(today, delta)
}

const WEEKDAY: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
}

function resolve(tok: string, today: Date): string | null {
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(tok)
  if (m) return ymd(new Date(+m[1], +m[2] - 1, +m[3]))
  m = /^(\d{1,2})\/(\d{1,2})$/.exec(tok)
  if (m) {
    const d = new Date(today.getFullYear(), +m[1] - 1, +m[2])
    if (d < startOfDay(today)) d.setFullYear(d.getFullYear() + 1) // already past → next year
    return ymd(d)
  }
  if (tok === '今天' || tok.toLowerCase() === 'today') return ymd(today)
  if (tok === '明天' || tok.toLowerCase() === 'tomorrow') return ymd(addDays(today, 1))
  if (tok === '后天') return ymd(addDays(today, 2))
  m = /^周([一二三四五六日天1-7])$/.exec(tok)
  if (m) return ymd(nextWeekday(today, WEEKDAY[m[1]]))
  m = /^(\d+)天后$/.exec(tok)
  if (m) return ymd(addDays(today, +m[1]))
  m = /^(\d+)周后$/.exec(tok)
  if (m) return ymd(addDays(today, +m[1] * 7))
  return null
}

const DUE_RE =
  /!\s*(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}|\d+天后|\d+周后|周[一二三四五六日天1-7]|今天|明天|后天|today|tomorrow)/i

export function parseDue(label: string, today: Date = new Date()): DueParse {
  const m = DUE_RE.exec(label)
  if (!m) return { text: label, due: null }
  const due = resolve(m[1], today)
  if (!due) return { text: label, due: null }
  const text = (label.slice(0, m.index) + label.slice(m.index + m[0].length))
    .replace(/\s{2,}/g, ' ')
    .trim()
  return { text, due }
}

export type DueUrgency = 'overdue' | 'today' | 'soon' | 'later'

// Whole-day diff from today to the due date (negative = overdue).
export function daysUntil(due: string, today: Date = new Date()): number {
  const d = new Date(due + 'T00:00:00')
  return Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86400000,
  )
}

// Urgency bucket for styling, relative to today. "soon" = within 2 days.
export function dueUrgency(due: string, today: Date = new Date()): DueUrgency {
  const days = daysUntil(due, today)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days <= 2) return 'soon'
  return 'later'
}

// Relative, human phrasing of a deadline: 逾期 N 天 / 今天截止 / 明天到期 /
// 还剩 N 天. Re-reads "today" on each call so the meaning shifts as days pass.
export function dueRelative(due: string, today: Date = new Date()): string {
  const days = daysUntil(due, today)
  if (days < 0) return `逾期 ${-days} 天`
  if (days === 0) return '今天截止'
  if (days === 1) return '明天到期'
  return `还剩 ${days} 天`
}
