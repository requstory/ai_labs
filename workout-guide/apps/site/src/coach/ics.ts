import { PLAN, TYPE_INFO, checklistText, headline, type PlanDay } from './plan';

export type ReminderSettings = { evening: boolean; eveningAt: string; morning: boolean; morningAt: string };

const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** Lines longer than 75 octets must be folded (RFC 5545 §3.1). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join('\r\n ');
}

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
/** Alarm offset from the start (midnight) of an all-day event. */
function trigger(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}PT${h ? `${h}H` : ''}${m || !h ? `${m}M` : ''}`;
}

function eventFor(d: PlanDay, date: string, appUrl: string, r: ReminderSettings, stamp: string): string[] {
  const ymd = date.replace(/-/g, '');
  const next = new Date(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6) + 1);
  const end = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}${String(next.getDate()).padStart(2, '0')}`;
  const info = TYPE_INFO[d.type];
  const summary = d.type === 'rest' ? 'Coach: Rest day' : `Coach: ${info.label} (~${d.minutes} min)`;
  let description = checklistText(d);
  if (d.dow === 0) description += '\n\nWeigh-in this morning: after the toilet, before eating. Note your VO₂ max from the Health app.';
  if (d.dow === 6) description += '\n\nSunday: open Coach for your weekly summary.';
  description += `\n\nOpen in Coach: ${appUrl}#day/${d.id}`;
  const lines = [
    'BEGIN:VEVENT',
    `UID:${d.id}-${ymd}@coach.fitsplit`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${appUrl}#day/${d.id}`,
    'TRANSP:TRANSPARENT',
  ];
  // Alerts: the night before (relative to midnight at the start of the day) and the morning of.
  if (d.type !== 'rest') {
    if (r.evening) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(`Tomorrow: ${info.label}. ${headline(d)}. Lay out your kit tonight.`)}`, `TRIGGER:${trigger(minutesOf(r.eveningAt) - 24 * 60)}`, 'END:VALARM');
    }
    if (r.morning) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(`Today: ${info.label}, ~${d.minutes} min.`)}`, `TRIGGER:${trigger(minutesOf(r.morningAt))}`, 'END:VALARM');
    }
  }
  lines.push('END:VEVENT');
  return lines;
}

/** Builds the calendar file for every plan day from `fromIndex` on, on its scheduled date. */
export function buildIcs(dates: string[], appUrl: string, r: ReminderSettings, fromIndex = 0, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FitSplit//Coach//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Coach'];
  for (const d of PLAN.slice(fromIndex)) lines.push(...eventFor(d, dates[d.index], appUrl, r, stamp));
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export { trigger as _trigger };
