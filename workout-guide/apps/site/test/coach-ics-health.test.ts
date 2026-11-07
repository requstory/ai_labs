import { describe, expect, it } from 'vitest';
import { buildIcs, _trigger } from '../src/coach/ics';
import { parseHealth } from '../src/coach/health';
import { schedule, DEFAULT_START } from '../src/coach/plan';

const settings = { evening: true, eveningAt: '20:00', morning: true, morningAt: '07:00' };

describe('calendar file', () => {
  const dates = schedule(DEFAULT_START, [], '2026-11-01');
  const ics = buildIcs(dates, 'https://example.com/coach/', settings, 0, new Date('2026-11-07T12:00:00Z'));

  it('has one all-day event per plan day', () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(168);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261109');
    expect(ics).toContain('DTEND;VALUE=DATE:20261110');
    expect(ics).toContain('DTSTART;VALUE=DATE:20270425');
  });

  it('alerts at 20:00 the night before and 07:00 on the day, but not on rest days', () => {
    expect(_trigger(20 * 60 - 24 * 60)).toBe('-PT4H');
    expect(_trigger(7 * 60)).toBe('PT7H');
    expect(_trigger(-(3 * 60 + 30))).toBe('-PT3H30M');
    // 144 training days × 2 alarms
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(288);
  });

  it('starts from a given day and uses CRLF lines no longer than 75 bytes', () => {
    const later = buildIcs(dates, 'https://example.com/coach/', settings, 160);
    expect(later.match(/BEGIN:VEVENT/g)).toHaveLength(8);
    const enc = new TextEncoder();
    for (const line of ics.split('\r\n')) expect(enc.encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});

describe('Health import', () => {
  it('reads the shortcut text', () => {
    expect(parseHealth('COACH-HEALTH\nweight: 112.4 kg\nvo2: 26.4 mL/min·kg\nwaist: 104 cm')).toEqual({ weight: 112.4, vo2: 26.4, waist: 104 });
  });
  it('accepts decimal commas and converts pounds and inches', () => {
    expect(parseHealth('COACH-HEALTH\nweight: 112,4 kg\nvo2: 26,4')).toEqual({ weight: 112.4, vo2: 26.4 });
    expect(parseHealth('COACH-HEALTH\nweight: 248 lb\nwaist: 41 in')).toEqual({ weight: 112.5, waist: 104.1 });
  });
  it('ignores other clipboard text and missing values', () => {
    expect(parseHealth('112.4')).toBeNull();
    expect(parseHealth('COACH-HEALTH\nweight:\nvo2:')).toBeNull();
    expect(parseHealth('COACH-HEALTH\nvo2: 27.1')).toEqual({ vo2: 27.1 });
  });
});
