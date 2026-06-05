export function formatDateId(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const ys = y.toString().padStart(4, '0');
  const ms = m.toString().padStart(2, '0');
  const ds = d.toString().padStart(2, '0');

  return `${ys}-${ms}-${ds}`;
}

export function formatDate(date: Date): string {
  const m = formatMonth(date);
  const d = formatDayOfMonth(date);
  const y = date.getFullYear().toString().padStart(4, '0');

  return `${m} ${d} ${y}`;
}

export function formatDayOfMonth(date: Date): string {
  const d = date.getDate();
  const t = d % 10;

  return d === 11 || d === 12 || d === 13
    ? `${d}th`
    : t === 1
      ? `${d}st`
      : t === 2
        ? `${d}nd`
        : t === 3
          ? `${d}rd`
          : `${d}th`;
}

export const DAY_NAMES: string[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function formatDayOfWeek(date: Date): string {
  return DAY_NAMES[date.getDay()];
}

export const MONTH_NAMES: string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function formatMonth(date: Date): string {
  return MONTH_NAMES[date.getMonth()];
}
