/** Small formatting helpers shared by views. */

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function longDate(date = new Date()) {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function shortDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function lessonNumber(number) {
  return String(number).padStart(2, '0');
}

export function phaseNumber(number) {
  return String(number).padStart(2, '0');
}

export function typeTone(type = '') {
  if (/capstone/i.test(type)) return 'chip--warn';
  if (/build/i.test(type)) return 'chip--solid';
  if (/learn/i.test(type)) return 'chip--accent';
  return '';
}

export function typeLabel(type = '') {
  if (!type) return 'Lesson';
  return type.length > 18 ? type.slice(0, 17).trim() + '…' : type;
}

export function pct(part, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}
