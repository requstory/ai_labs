// The 24-week plan from the daily checklist, as data. Everything here is pure so it can be tested.

export type DayType = 'easy' | 'A' | 'B' | 'long' | 'int' | 'rest';
export type ExerciseItem = { slug: string; name: string; amount: string };
export type PlanDay = {
  id: string; // stable id, e.g. "w1d2" — never changes, even if the plan is paused
  index: number; // 0..167
  week: number; // 1..24
  dow: number; // 0 = Monday … 6 = Sunday, in the plan's own week
  phase: 1 | 2 | 3;
  recovery: boolean;
  type: DayType;
  warm?: string;
  main?: string;
  cool?: string;
  sets?: number;
  goUp?: boolean;
  rest?: string;
  restSec?: number;
  exercises?: ExerciseItem[];
  intervals?: { n: number; hard: number; easy: number };
  run?: RunSpec;
  minutes: number;
  extra?: string;
};
export type RunSpec =
  | { kind: 'jogwalk'; total: number; jog: number; walk: number }
  | { kind: 'steady'; total: number };

/** Tints are CSS variables so they adapt to light and dark (see coach.css). */
export const TYPE_INFO: Record<DayType, { label: string; tint: string; icon: string }> = {
  easy: { label: 'Easy run/walk', tint: 'var(--t-easy)', icon: 'running' },
  A: { label: 'Strength A', tint: 'var(--t-a)', icon: 'goblet-squat' },
  B: { label: 'Strength B', tint: 'var(--t-b)', icon: 'dumbbell-romanian-deadlift' },
  long: { label: 'Long session', tint: 'var(--t-long)', icon: 'walking' },
  int: { label: 'Intervals', tint: 'var(--t-int)', icon: 'running' },
  rest: { label: 'Rest day', tint: 'var(--t-rest)', icon: 'childs-pose' },
};

export const EXERCISE_NAMES: Record<string, string> = {
  'high-knees': 'Marching on the spot', 'arm-circles': 'Arm circles', 'bodyweight-squat': 'Bodyweight squat',
  'good-morning': 'Hip hinge', 'leg-swings-stretch': 'Leg swings', 'forward-lunge': 'Bodyweight lunge',
  'wall-calf-stretch': 'Calf stretch against a wall', 'standing-quad-stretch': 'Standing quad stretch',
  'hamstring-stretch': 'Hamstring stretch, heel on a low step', 'kneeling-hip-flexor-stretch': 'Kneeling hip-flexor stretch',
  'doorway-chest-stretch': 'Chest stretch in a doorway', 'childs-pose': "Child's pose", 'cat-cow-stretch': 'Cat-cow',
  'worlds-greatest-stretch': "World's greatest stretch", 'torso-twist-stretch': 'Torso twist',
  'butterfly-stretch': 'Butterfly stretch', 'cross-body-shoulder-stretch': 'Cross-body shoulder stretch',
  running: 'Jog', walking: 'Walk',
};

export const WARMUP: ExerciseItem[] = [
  { slug: 'high-knees', name: 'Marching or brisk walking on the spot', amount: '1 min' },
  { slug: 'arm-circles', name: 'Arm circles', amount: '10 each way' },
  { slug: 'bodyweight-squat', name: 'Bodyweight squats', amount: '10' },
  { slug: 'good-morning', name: 'Hip hinges', amount: '10' },
  { slug: 'leg-swings-stretch', name: 'Leg swings', amount: '10 each leg' },
  { slug: 'forward-lunge', name: 'Bodyweight lunges', amount: '5 each leg' },
];

/** Stretch routine: 30 s holds; "each side" items take 60 s (30 s per side). Total 5 min. */
export type TimedItem = { slug: string; name: string; seconds: number; sides?: boolean; note?: string };
export const STRETCH: TimedItem[] = [
  { slug: 'wall-calf-stretch', name: 'Calf stretch against a wall', seconds: 60, sides: true },
  { slug: 'standing-quad-stretch', name: 'Standing quad stretch', seconds: 60, sides: true },
  { slug: 'hamstring-stretch', name: 'Hamstring stretch, heel on a low step', seconds: 60, sides: true },
  { slug: 'kneeling-hip-flexor-stretch', name: 'Kneeling hip-flexor stretch', seconds: 60, sides: true },
  { slug: 'doorway-chest-stretch', name: 'Chest stretch in a doorway', seconds: 30 },
  { slug: 'childs-pose', name: "Child's pose", seconds: 30 },
];

/** Optional rest-day mobility routine, 10 min. Not part of the checklist. */
export const MOBILITY: TimedItem[] = [
  { slug: 'cat-cow-stretch', name: 'Cat-cow', seconds: 60, note: 'Slow, with your breathing' },
  { slug: 'worlds-greatest-stretch', name: "World's greatest stretch", seconds: 120, sides: true, note: '5 slow reps each side' },
  { slug: 'kneeling-hip-flexor-stretch', name: 'Kneeling hip-flexor stretch', seconds: 90, sides: true, note: '45 s each side' },
  { slug: 'hamstring-stretch', name: 'Hamstring stretch', seconds: 90, sides: true, note: '45 s each side' },
  { slug: 'torso-twist-stretch', name: 'Torso twist', seconds: 60, note: '10 each side, controlled' },
  { slug: 'cross-body-shoulder-stretch', name: 'Cross-body shoulder stretch', seconds: 60, sides: true, note: '30 s each side' },
  { slug: 'butterfly-stretch', name: 'Butterfly stretch', seconds: 60 },
  { slug: 'childs-pose', name: "Child's pose", seconds: 60, note: 'Breathe into your back' },
];

type StrengthSet = { rest: string; restSec: number; A: ExerciseItem[]; B: ExerciseItem[] };
const ex = (slug: string, name: string, amount: string): ExerciseItem => ({ slug, name, amount });
const STRENGTH: Record<1 | 2 | 3, StrengthSet> = {
  1: {
    rest: '60–90 s', restSec: 75,
    A: [ex('goblet-squat', 'goblet squat', '× 10'), ex('incline-push-up', 'push-up, hands on a bench', '× 8'), ex('reverse-lunge', 'reverse lunge', '× 8 each leg'), ex('standing-dumbbell-press', 'dumbbell shoulder press', '× 10'), ex('plank', 'plank', '20–30 s')],
    B: [ex('dumbbell-romanian-deadlift', 'Romanian deadlift', '× 10'), ex('one-arm-dumbbell-row', 'one-arm dumbbell row', '× 10 each arm'), ex('glute-bridge', 'glute bridge', '× 12'), ex('step-up', 'step-up onto a low step', '× 8 each leg'), ex('side-plank', 'side plank', '20 s each side'), ex('calf-raise', 'calf raise', '× 15')],
  },
  2: {
    rest: '60–90 s', restSec: 75,
    A: [ex('goblet-squat', 'goblet squat', '× 12'), ex('push-up', 'push-up', '× 10 (hands on a bench if needed)'), ex('reverse-lunge', 'reverse lunge', '× 10 each leg'), ex('standing-dumbbell-press', 'dumbbell shoulder press', '× 10'), ex('plank', 'plank', '30–40 s')],
    B: [ex('dumbbell-romanian-deadlift', 'Romanian deadlift', '× 12'), ex('one-arm-dumbbell-row', 'one-arm dumbbell row', '× 12 each arm'), ex('single-leg-glute-bridge', 'single-leg glute bridge', '× 10 each leg'), ex('step-up', 'step-up holding dumbbells', '× 10 each leg'), ex('side-plank', 'side plank', '30 s each side'), ex('calf-raise', 'calf raise', '× 15')],
  },
  3: {
    rest: '90 s', restSec: 90,
    A: [ex('goblet-squat', 'goblet squat, heavier', '× 8–10'), ex('push-up', 'push-up', '× 12 (feet raised if easy)'), ex('reverse-lunge', 'reverse lunge holding dumbbells', '× 10 each leg'), ex('standing-dumbbell-press', 'dumbbell shoulder press, heavier', '× 8–10'), ex('plank-shoulder-tap', 'plank with shoulder taps', '40–45 s')],
    B: [ex('dumbbell-romanian-deadlift', 'Romanian deadlift, heavier', '× 8–10'), ex('one-arm-dumbbell-row', 'one-arm dumbbell row, heavier', '× 10 each arm'), ex('single-leg-glute-bridge', 'single-leg glute bridge', '× 12 each leg'), ex('step-up', 'step-up holding dumbbells', '× 12 each leg'), ex('side-plank', 'side plank', '40 s each side'), ex('single-leg-calf-raise', 'single-leg calf raise', '× 12 each leg')],
  },
};

type WeekRow = { recovery: boolean; sets: number; goUp: boolean; easy: string; long: string; iv?: [number, number, number] };
const w = (recovery: number, sets: number, goUp: number, easy: string, long: string, iv?: [number, number, number]): WeekRow =>
  ({ recovery: !!recovery, sets, goUp: !!goUp, easy, long, iv });
export const WEEKS: WeekRow[] = [
  w(0, 2, 0, '30 min of 1 min jog / 2 min walk', '45 min brisk walk'),
  w(0, 2, 0, '30 min of 1 min jog / 2 min walk', '50 min brisk walk'),
  w(0, 3, 0, '35 min of 2 min jog / 2 min walk', '50 min walk with 3 × 2 min easy jogs'),
  w(1, 2, 0, '25 min of 2 min jog / 2 min walk', '40 min brisk walk'),
  w(0, 3, 0, '35 min of 3 min jog / 1 min walk', '55 min walk with 4 × 3 min easy jogs'),
  w(0, 3, 0, '40 min of 3 min jog / 1 min walk', '60 min walk with 5 × 3 min easy jogs'),
  w(0, 3, 0, '40 min of 5 min jog / 1 min walk', '60 min of 5 min jog / 2 min walk'),
  w(1, 2, 0, '30 min of 5 min jog / 1 min walk', '45 min of 5 min jog / 2 min walk'),
  w(0, 3, 0, '35 min, jogging with walk breaks as needed', '55 min run/walk', [3, 3, 3]),
  w(0, 3, 0, '35 min, jogging in 10 min blocks with 1–2 min walks', '60 min run/walk', [4, 3, 3]),
  w(0, 3, 1, '40 min, jogging in 15 min blocks with 1–2 min walks', '60 min run/walk', [3, 4, 3]),
  w(1, 2, 0, '30 min easy jog/walk', '45 min easy jog/walk', [3, 3, 3]),
  w(0, 3, 0, '40 min, jogging in 20 min blocks with a 2 min walk', '60 min, mostly jogging', [4, 4, 3]),
  w(0, 3, 1, '45 min, jogging in 20 min blocks with a 2 min walk', '65 min, mostly jogging', [4, 4, 3]),
  w(0, 3, 0, '45 min, including 30 min continuous jogging', '70 min, mostly jogging', [4, 4, 3]),
  w(1, 2, 0, '30 min easy jog/walk', '45 min easy jog/walk', [3, 4, 3]),
  w(0, 3, 0, '45 min continuous easy jog', '60 min continuous easy jog', [4, 4, 3]),
  w(0, 3, 0, '45 min continuous easy jog', '65 min easy jog', [5, 3, 2]),
  w(0, 4, 0, '50 min continuous easy jog', '70 min easy jog', [5, 4, 3]),
  w(1, 2, 0, '30 min easy jog', '50 min easy jog', [3, 4, 3]),
  w(0, 4, 0, '50 min continuous easy jog', '70 min easy jog', [5, 4, 3]),
  w(0, 4, 0, '50 min continuous easy jog', '75 min easy jog', [6, 3, 2]),
  w(0, 3, 0, '45 min continuous easy jog', '75 min easy jog', [5, 4, 2.5]),
  w(1, 2, 0, '30 min easy jog', '45 min easy jog', [3, 3, 3]),
];
export const TOTAL_WEEKS = WEEKS.length;

const PATTERN_EARLY: DayType[] = ['easy', 'A', 'easy', 'rest', 'B', 'long', 'easy'];
const PATTERN_LATE: DayType[] = ['easy', 'A', 'rest', 'int', 'easy', 'long', 'B'];

/** Turns a "main" description into a timer the session player can run. */
export function parseRun(text: string): RunSpec {
  const total = parseInt(text, 10);
  const jw = text.match(/^(\d+) min of (\d+) min jog \/ (\d+) min walk/);
  if (jw) return { kind: 'jogwalk', total: +jw[1], jog: +jw[2], walk: +jw[3] };
  const blocks = text.match(/jogging in (\d+) min blocks with (?:1–2|a 2) min walks?/);
  if (blocks) return { kind: 'jogwalk', total, jog: +blocks[1], walk: 2 };
  return { kind: 'steady', total };
}

export function buildPlan(): PlanDay[] {
  const days: PlanDay[] = [];
  WEEKS.forEach((row, wi) => {
    const week = wi + 1;
    const phase: 1 | 2 | 3 = week <= 8 ? 1 : week <= 16 ? 2 : 3;
    const pattern = week <= 8 ? PATTERN_EARLY : PATTERN_LATE;
    const S = STRENGTH[phase];
    pattern.forEach((type, dow) => {
      const d: PlanDay = { id: `w${week}d${dow + 1}`, index: wi * 7 + dow, week, dow, phase, recovery: row.recovery, type, minutes: 0 };
      if (type === 'easy') {
        d.warm = '5 min brisk walk';
        d.main = `${row.easy}, at 145–155 bpm (walk if you go over 155)`;
        d.cool = '5 min walk + stretch routine';
        d.run = parseRun(row.easy);
        d.minutes = 5 + d.run.total + 5 + 5;
      } else if (type === 'long') {
        d.main = `${row.long}, at talking pace, heart rate no higher than 155 bpm`;
        d.cool = '5 min walk + stretch routine';
        d.run = parseRun(row.long);
        d.minutes = d.run.total + 5 + 5;
      } else if (type === 'int') {
        const [n, hard, easy] = row.iv!;
        d.warm = '10 min easy walk/jog';
        d.main = `${n} × ${hard} min hard / ${easy} min easy; hard = 165+ bpm, a few words only; easy = walk or very slow jog`;
        d.cool = '10 min easy walk + stretch routine';
        d.intervals = { n, hard, easy };
        d.minutes = Math.round(10 + n * (hard + easy) + 10 + 5);
      } else if (type === 'A' || type === 'B') {
        d.sets = row.sets;
        d.goUp = row.goUp;
        d.rest = S.rest;
        d.restSec = S.restSec;
        d.exercises = S[type];
        d.minutes = Math.round(5 + d.exercises.length * row.sets * 1.6 + 5);
        if (week === TOTAL_WEEKS && type === 'B') d.extra = 'Then check your monthly VO₂ max in the Health app and compare it with your target.';
      } else {
        d.main = 'Optional 20–30 min gentle walk. Lay out your kit for tomorrow.';
      }
      days.push(d);
    });
  });
  return days;
}

export const PLAN: PlanDay[] = buildPlan();
export const dayById = (id: string) => PLAN.find((d) => d.id === id);

export function strengthHeader(d: PlanDay) {
  return `${d.sets} sets of each${d.goUp ? ', go up in weight' : ''}, rest ${d.rest}`;
}

/** The day's row exactly as the checklist writes it. */
export function checklistText(d: PlanDay): string {
  switch (d.type) {
    case 'easy': return `Easy run/walk. Warm-up: ${d.warm}. Main: ${d.main}. Cool-down: ${d.cool}.`;
    case 'long': return `Long session. Main: ${d.main}. Cool-down: ${d.cool}.`;
    case 'int': return `Intervals. Warm-up: ${d.warm}. Main: ${d.main}. Cool-down: ${d.cool}.`;
    case 'rest': return `Rest day. ${d.main}`;
    default: {
      const list = d.exercises!.map((e) => `${e.name} ${e.amount}`).join(' · ');
      const text = `Strength ${d.type} (${strengthHeader(d)}). Do the warm-up routine, then: ${list}. Finish with the stretch routine.`;
      return d.extra ? `${text} ${d.extra}` : text;
    }
  }
}

export function headline(d: PlanDay): string {
  if (d.type === 'A' || d.type === 'B') return `${d.exercises!.length} exercises · ${d.sets} sets`;
  if (d.type === 'rest') return 'Optional gentle walk or mobility';
  if (d.type === 'int') return `${d.intervals!.n} × ${d.intervals!.hard} min hard / ${d.intervals!.easy} min easy`;
  return d.main!.split(/, at /)[0];
}

/* ---------------- Run timer phases ---------------- */
export type Phase = { label: string; seconds: number; effort: 'easy' | 'hard' | 'walk'; slug: string };
export function mainPhases(d: PlanDay): Phase[] {
  if (d.intervals) {
    const out: Phase[] = [];
    for (let k = 0; k < d.intervals.n; k++) {
      out.push({ label: `Hard ${k + 1} of ${d.intervals.n}`, seconds: d.intervals.hard * 60, effort: 'hard', slug: 'running' });
      out.push({ label: 'Easy', seconds: Math.round(d.intervals.easy * 60), effort: 'walk', slug: 'walking' });
    }
    return out;
  }
  const r = d.run!;
  if (r.kind === 'steady') {
    const walkOnly = /^\d+ min brisk walk/.test(d.main!) || /^\d+ min walk with/.test(d.main!);
    const label = /easy jogs/.test(d.main!) ? 'Walk + easy jogs' : walkOnly ? 'Brisk walk' : d.type === 'long' ? 'Long run/walk' : 'Easy jog';
    return [{ label, seconds: r.total * 60, effort: 'easy', slug: walkOnly ? 'walking' : 'running' }];
  }
  const out: Phase[] = [];
  let t = 0;
  const total = r.total * 60;
  while (t < total) {
    const jog = Math.min(r.jog * 60, total - t);
    out.push({ label: 'Jog', seconds: jog, effort: 'easy', slug: 'running' });
    t += jog;
    if (t >= total) break;
    const walk = Math.min(r.walk * 60, total - t);
    out.push({ label: 'Walk', seconds: walk, effort: 'walk', slug: 'walking' });
    t += walk;
  }
  return out;
}

/* ---------------- Dates, pauses and targets ---------------- */
export type Pause = { start: string; end: string | null }; // ISO dates, inclusive; end null = still paused
export const DEFAULT_START = '2026-11-09';

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

/** Whether a calendar date falls inside a pause. An open pause covers up to and including `today`. */
export function isPaused(date: string, pauses: Pause[], today: string): boolean {
  return pauses.some((p) => date >= p.start && date <= (p.end ?? today));
}

/**
 * Maps each plan day to a calendar date. Paused dates are skipped, so the rest of the plan moves back.
 * Returns ISO dates indexed by plan day index.
 */
export function schedule(start: string, pauses: Pause[], today: string): string[] {
  const dates: string[] = [];
  let date = start;
  let guard = 0;
  while (dates.length < PLAN.length && guard++ < 5000) {
    if (!isPaused(date, pauses, today)) dates.push(date);
    date = addDays(date, 1);
  }
  return dates;
}

/** The plan day scheduled on a date, or null (before start, during a pause, after the end). */
export function dayOn(date: string, dates: string[]): PlanDay | null {
  const i = dates.indexOf(date);
  return i >= 0 ? PLAN[i] : null;
}

export function targets(week: number, startWeight: number, startVo2: number) {
  return { weight: +(startWeight - 0.7 * week).toFixed(1), vo2: +(startVo2 + 0.5 * week).toFixed(1) };
}

/** What changes next week, for the Sunday summary. */
export function nextWeekNote(week: number): string | null {
  const next = week + 1;
  if (next > TOTAL_WEEKS) return null;
  const row = WEEKS[next - 1];
  if (next === 9) return 'From next week Wednesday becomes the rest day, intervals start on Thursday and Strength B moves to Sunday.';
  if (next === 17) return 'Next week strength gets heavier: fewer reps, 90 s rest, and harder versions of each exercise.';
  if (next === TOTAL_WEEKS) return 'Next week is the last week: a recovery week, with your final VO₂ max check on Sunday.';
  if (row.recovery) return 'Next week is a recovery week: shorter sessions so your body can adapt.';
  if (row.goUp) return 'Next week, go up in weight on your strength days.';
  return null;
}

export const DOW_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatDate(iso: string, withYear = false): string {
  const d = parseISO(iso);
  return `${DOW_SHORT[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ''}`;
}
