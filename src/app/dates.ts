// 日付の計算。日付は端末の現地時間の 'YYYY-MM-DD' で扱う。

export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function today(): string {
  return toDateString(new Date());
}

function parse(s: string): Date {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return toDateString(d);
}

// a から b までの日数（b が後なら正）
export function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

// その日を含む週（月曜〜日曜）の日付
export function weekDates(s: string): string[] {
  const d = parse(s);
  const fromMonday = (d.getDay() + 6) % 7;
  const monday = addDays(s, -fromMonday);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export const WEEKDAY_LABEL = ['月', '火', '水', '木', '金', '土', '日'];

export function formatJapaneseDate(s: string): string {
  const d = parse(s);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
