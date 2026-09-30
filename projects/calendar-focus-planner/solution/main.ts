export type Event = { id: string; title: string; start: number; end: number };
export type Task = { id: string; title: string; minutes: number; priority: number };
export type Slot = { start: number; end: number };
export type Plan = { schemaVersion: number; window: Slot; busy: Slot[]; scheduled: (Task & Slot)[]; unscheduled: (Task & { reason: string })[] };

function stamp(value: string): number {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z)?$/.exec(value);
  if (!match) throw new Error('Use UTC YYYYMMDDTHHMMSSZ or an all-day DATE; timezone rules are not guessed');
  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
  const result = Date.parse(iso);
  if (!Number.isFinite(result) || new Date(result).toISOString() !== iso) throw new Error('Invalid calendar date');
  return result;
}

function decode(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_, char: string) => /[nN]/.test(char) ? '\n' : char);
}

export function parseCalendar(text: string): Event[] {
  if (typeof text !== 'string' || text.length > 1_000_000) throw new Error('Calendar must be text under 1 MB');
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  if (!lines.some(line => line.toUpperCase() === 'BEGIN:VCALENDAR') || !lines.some(line => line.toUpperCase() === 'END:VCALENDAR')) throw new Error('VCALENDAR envelope required');
  const events: Event[] = [];
  const ids = new Set<string>();
  let current: Record<string, string> | null = null;
  let envelope = false, completed = false;
  for (const line of lines) {
    const boundary = line.toUpperCase();
    if (boundary === 'BEGIN:VCALENDAR') {
      if (envelope || completed) throw new Error('One VCALENDAR envelope is required');
      envelope = true;
      continue;
    }
    if (boundary === 'END:VCALENDAR') {
      if (!envelope || current) throw new Error('Unclosed event or calendar');
      envelope = false; completed = true;
      continue;
    }
    if (boundary === 'BEGIN:VEVENT') {
      if (current || !envelope) throw new Error('Event must be inside one calendar');
      current = {};
      continue;
    }
    if (boundary === 'END:VEVENT') {
      if (!current || !current.UID || !current.DTSTART || !current.DTEND) throw new Error('Event needs UID, DTSTART and DTEND');
      if (ids.has(current.UID)) throw new Error('Duplicate event UID');
      const start = stamp(current.DTSTART), end = stamp(current.DTEND);
      if (end <= start) throw new Error('DTEND must be later than DTSTART');
      ids.add(current.UID);
      if (current.STATUS?.toUpperCase() !== 'CANCELLED' && current.TRANSP?.toUpperCase() !== 'TRANSPARENT') events.push({ id: current.UID, title: decode(current.SUMMARY || 'Busy'), start, end });
      current = null;
      continue;
    }
    if (current) {
      if (boundary.startsWith('BEGIN:') || boundary.startsWith('END:')) throw new Error('Nested event components are unsupported');
      const colon = line.indexOf(':');
      if (colon < 1) throw new Error('Malformed event property');
      const descriptor = line.slice(0, colon).toUpperCase(), key = descriptor.split(';')[0];
      if (['RRULE', 'RDATE', 'EXDATE', 'RECURRENCE-ID'].includes(key) || /;TZID=/.test(descriptor)) throw new Error('Expand recurrence and timezone values to UTC before importing');
      if (['UID', 'DTSTART', 'DTEND', 'SUMMARY', 'STATUS', 'TRANSP'].includes(key)) {
        if (Object.hasOwn(current, key)) throw new Error('Duplicate event property');
        if (descriptor.includes(';') && !/^DT(?:START|END);VALUE=DATE$/.test(descriptor)) throw new Error('Unsupported event property parameters');
        current[key] = line.slice(colon + 1);
      }
    }
  }
  if (current) throw new Error('Unclosed event');
  return events;
}

export function availableSlots(events: Event[], window: Slot, bufferMinutes = 0): { busy: Slot[]; free: Slot[] } {
  if (!Number.isFinite(window.start) || !Number.isFinite(window.end) || window.end <= window.start || window.end - window.start > 7 * 86400000) throw new Error('Window must span at most seven days');
  if (!Number.isInteger(bufferMinutes) || bufferMinutes < 0 || bufferMinutes > 120) throw new Error('Buffer must be 0 to 120 minutes');
  const buffer = bufferMinutes * 60000;
  const sorted = events.map(event => {
    if (!Number.isFinite(event.start) || !Number.isFinite(event.end) || event.end <= event.start) throw new Error('Invalid event interval');
    return { start: Math.max(window.start, event.start - buffer), end: Math.min(window.end, event.end + buffer) };
  }).filter(event => event.end > event.start).sort((a, b) => a.start - b.start || a.end - b.end);
  const busy: Slot[] = [];
  for (const event of sorted) {
    const previous = busy[busy.length - 1];
    if (previous && event.start <= previous.end) previous.end = Math.max(previous.end, event.end);
    else busy.push({ ...event });
  }
  const free: Slot[] = [];
  let cursor = window.start;
  for (const event of busy) {
    if (event.start > cursor) free.push({ start: cursor, end: event.start });
    cursor = event.end;
  }
  if (cursor < window.end) free.push({ start: cursor, end: window.end });
  return { busy, free };
}

export function schedule(tasks: Task[], events: Event[], window: Slot, bufferMinutes = 0): Plan {
  if (!Array.isArray(tasks) || tasks.length > 100) throw new Error('At most 100 tasks');
  const ids = new Set<string>();
  for (const task of tasks) {
    if (!task || typeof task.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(task.id) || ids.has(task.id) || typeof task.title !== 'string' || !task.title.trim() || task.title.length > 300 || !Number.isInteger(task.minutes) || task.minutes < 5 || task.minutes > 480 || !Number.isInteger(task.priority) || task.priority < 1 || task.priority > 5) throw new Error('Tasks need unique ids, titles, 5–480 minutes and priority 1–5');
    ids.add(task.id);
  }
  const { busy, free } = availableSlots(events, window, bufferMinutes);
  const scheduled: Plan['scheduled'] = [], unscheduled: Plan['unscheduled'] = [];
  for (const task of [...tasks].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))) {
    const slot = free.find(slot => slot.end - slot.start >= task.minutes * 60000);
    if (!slot) { unscheduled.push({ ...task, reason: 'No contiguous free interval is long enough' }); continue; }
    const start = slot.start, end = start + task.minutes * 60000;
    scheduled.push({ ...task, start, end });
    slot.start = end;
  }
  return { schemaVersion: 1, window: { ...window }, busy, scheduled, unscheduled };
}

function icalText(value: string): string { return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,'); }
function icalTime(value: number): string { return new Date(value).toISOString().replace(/[-:]/g, '').replace('.000', ''); }
function fold(line: string): string {
  const result: string[] = [];
  let part = '', bytes = 0;
  for (const char of line) {
    const n = Buffer.byteLength(char);
    if (bytes + n > 75) { result.push(part); part = ' '; bytes = 1; }
    part += char; bytes += n;
  }
  result.push(part);
  return result.join('\r\n');
}

export function exportCalendar(plan: Plan, createdAt: number): string {
  if (!Number.isFinite(createdAt)) throw new Error('An explicit creation timestamp is required');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AI Engineering from Scratch//Focus Planner//EN', 'CALSCALE:GREGORIAN'];
  for (const task of plan.scheduled) {
    lines.push('BEGIN:VEVENT', 'UID:focus-' + task.id + '-' + task.start + '@local.invalid', 'DTSTAMP:' + icalTime(createdAt), 'DTSTART:' + icalTime(task.start), 'DTEND:' + icalTime(task.end), 'SUMMARY:' + icalText(task.title), 'DESCRIPTION:Proposed focus block. Review before importing.', 'END:VEVENT');
  }
  return lines.concat('END:VCALENDAR').map(fold).join('\r\n') + '\r\n';
}

export function renderPlan(plan: Plan): string {
  const escape = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
  const time = (n: number) => new Date(n).toISOString().slice(11, 16) + ' UTC';
  const rows = plan.scheduled.map(task => `<tr><td>${time(task.start)}–${time(task.end)}</td><td>${escape(task.title)}</td><td>${task.minutes} min</td><td>Priority ${task.priority}; earliest fitting gap</td></tr>`).join('');
  const missing = plan.unscheduled.map(task => `<li><strong>${escape(task.title)}</strong>: ${escape(task.reason)}</li>`).join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Focus plan</title><style>body{font:16px system-ui;color:#1b2b3c;background:#f6f8fa;max-width:1000px;margin:40px auto;padding:20px}h1{font-size:36px}table{width:100%;border-collapse:collapse;background:white}td,th{padding:14px;border-bottom:1px solid #ccd6df;text-align:left}.scroll{overflow:auto}li{padding:10px}small{color:#53677d}</style><small>CALENDAR FOCUS PLANNER</small><h1>A plan that shows what does not fit</h1><p>${new Date(plan.window.start).toISOString().slice(0, 10)}. ${plan.scheduled.length} proposed blocks; ${plan.unscheduled.length} left unscheduled. Existing events are untouched.</p><div class="scroll"><table><thead><tr><th>Time</th><th>Task</th><th>Duration</th><th>Why here</th></tr></thead><tbody>${rows}</tbody></table></div><h2>Needs another day</h2><ul>${missing || '<li>All tasks fit.</li>'}</ul><p>Download the companion focus.ics file and review its blocks before importing. This deterministic first-fit policy favors priority; it does not prove a globally optimal schedule.</p></html>`;
}
