import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PLAN, checklistText, schedule, dayOn, targets, mainPhases, parseRun, formatDate, DEFAULT_START, addDays, nextWeekNote,
} from '../src/coach/plan';

describe('coach plan', () => {
  it('has 24 weeks of 7 days with stable ids', () => {
    expect(PLAN).toHaveLength(168);
    expect(new Set(PLAN.map((d) => d.id)).size).toBe(168);
    expect(PLAN[0].id).toBe('w1d1');
    expect(PLAN[167].id).toBe('w24d7');
  });

  it('switches day pattern in week 9', () => {
    expect(PLAN.filter((d) => d.week === 8).map((d) => d.type)).toEqual(['easy', 'A', 'easy', 'rest', 'B', 'long', 'easy']);
    expect(PLAN.filter((d) => d.week === 9).map((d) => d.type)).toEqual(['easy', 'A', 'rest', 'int', 'easy', 'long', 'B']);
  });

  it('writes rows the way the checklist does', () => {
    expect(checklistText(PLAN[1])).toBe(
      'Strength A (2 sets of each, rest 60–90 s). Do the warm-up routine, then: goblet squat × 10 · push-up, hands on a bench × 8 · reverse lunge × 8 each leg · dumbbell shoulder press × 10 · plank 20–30 s. Finish with the stretch routine.',
    );
    expect(checklistText(PLAN[0])).toBe(
      'Easy run/walk. Warm-up: 5 min brisk walk. Main: 30 min of 1 min jog / 2 min walk, at 145–155 bpm (walk if you go over 155). Cool-down: 5 min walk + stretch routine.',
    );
    expect(checklistText(PLAN[167])).toMatch(/Then check your monthly VO₂ max in the Health app and compare it with your target\.$/);
  });

  it('schedules from Mon 9 Nov 2026 to Sun 25 Apr 2027', () => {
    const dates = schedule(DEFAULT_START, [], '2026-11-01');
    expect(dates[0]).toBe('2026-11-09');
    expect(dates[167]).toBe('2027-04-25');
    expect(formatDate(dates[1])).toBe('Tue 10 Nov');
  });

  it('moves the rest of the plan back by the paused days', () => {
    const pauses = [{ start: '2026-11-12', end: '2026-11-14' }];
    const dates = schedule(DEFAULT_START, pauses, '2026-12-01');
    expect(dates[2]).toBe('2026-11-11');
    expect(dates[3]).toBe('2026-11-15');
    expect(dates[167]).toBe(addDays('2027-04-25', 3));
    expect(dayOn('2026-11-13', dates)).toBeNull();
  });

  it('treats an open pause as running up to today', () => {
    const dates = schedule(DEFAULT_START, [{ start: '2026-11-10', end: null }], '2026-11-12');
    expect(dates[1]).toBe('2026-11-13');
  });

  it('works out targets from the starting numbers', () => {
    expect(targets(1, 113, 26)).toEqual({ weight: 112.3, vo2: 26.5 });
    expect(targets(24, 113, 26)).toEqual({ weight: 96.2, vo2: 38 });
  });

  it('builds run timers that add up to the main session', () => {
    for (const d of PLAN.filter((x) => x.run || x.intervals)) {
      const total = mainPhases(d).reduce((a, p) => a + p.seconds, 0);
      const expected = d.intervals ? (d.intervals.hard + d.intervals.easy) * d.intervals.n * 60 : d.run!.total * 60;
      expect(total).toBe(Math.round(expected));
    }
    expect(parseRun('35 min, jogging in 10 min blocks with 1–2 min walks')).toEqual({ kind: 'jogwalk', total: 35, jog: 10, walk: 2 });
  });

  it('flags the week 9 and week 17 changes', () => {
    expect(nextWeekNote(8)).toMatch(/intervals start/);
    expect(nextWeekNote(16)).toMatch(/heavier/);
    expect(nextWeekNote(24)).toBeNull();
  });

  // Optional: compare every row with your own checklist file. COACH_CHECKLIST=/path/to/Daily_checklist.md
  const file = process.env.COACH_CHECKLIST;
  it.skipIf(!file || !existsSync(file))('matches every row of the checklist file', () => {
    const rows = readFileSync(file!, 'utf8').split('\n').filter((l) => /^\| (Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d/.test(l));
    expect(rows).toHaveLength(168);
    rows.forEach((row, i) => expect(row.split(' | ')[1]).toBe(checklistText(PLAN[i])));
  });
});
