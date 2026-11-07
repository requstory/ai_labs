import {
  PLAN, TYPE_INFO, WARMUP, STRETCH, MOBILITY, TOTAL_WEEKS, DEFAULT_START, EXERCISE_NAMES,
  headline, strengthHeader, mainPhases, schedule, dayOn, targets, nextWeekNote,
  formatDate, addDays, toISO, daysBetween, isPaused,
  type PlanDay, type ExerciseItem, type TimedItem, type Phase,
} from './plan';
import { load, save, normalise, requestPersistence, type CoachData, type DoneEntry } from './store';
import { buildIcs } from './ics';
import { parseHealth } from './health';
import { unlockAudio, setVoice, beep, say, keepAwake, isAwake, onAwakeChange, setBadge, isStandalone, isIOS, saveFile } from './device';

/* ===================== Setup ===================== */
const root = document.getElementById('app')!;
const BASE = root.dataset.base ?? '/';
const APP_URL = `${location.origin}${BASE}coach/`;
const frameUrl = (slug: string, i: number) => `${BASE}frames/${slug}/frame-${i}.svg`;

// `?today=YYYY-MM-DD` lets you preview another date (kept for this tab only).
(() => {
  const q = new URLSearchParams(location.search).get('today');
  try {
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) sessionStorage.setItem('coach:today', q);
    if (q === 'clear') sessionStorage.removeItem('coach:today');
  } catch { /* ignore */ }
})();
const today = (): string => {
  try {
    const o = sessionStorage.getItem('coach:today');
    if (o) return o;
  } catch { /* ignore */ }
  return toISO(new Date());
};

let data: CoachData = load();
const persist = () => {
  if (!save(data)) toast('Couldn’t save on this phone. Back up your data from More.');
};

/* ===================== Derived state ===================== */
const dates = () => (data.setup ? schedule(data.setup.startDate, data.pauses, today()) : []);
const dateOf = (d: PlanDay, ds = dates()) => ds[d.index];
const activePause = () => data.pauses.find((p) => p.end === null && p.start <= today()) ?? null;
/** Index of the first plan day on or after a date (PLAN.length if the plan is finished). */
const nextIndexFrom = (iso: string, ds = dates()) => {
  const i = ds.findIndex((d) => d >= iso);
  return i === -1 ? PLAN.length : i;
};
const currentWeek = (ds = dates()) => {
  const i = nextIndexFrom(today(), ds);
  return i >= PLAN.length ? TOTAL_WEEKS + 1 : PLAN[i].week;
};
const isTraining = (d: PlanDay) => d.type !== 'rest';
type Status = 'done' | 'missed' | 'upcoming' | 'today';
function statusOf(d: PlanDay, ds = dates()): Status {
  const date = ds[d.index];
  if (d.type === 'rest') return data.mobility[date] ? 'done' : date === today() ? 'today' : 'upcoming';
  if (data.done[d.id]) return 'done';
  if (date < today()) return 'missed';
  return date === today() ? 'today' : 'upcoming';
}
const weekDays = (w: number) => PLAN.filter((d) => d.week === w);
const sessionsDone = (w: number) => weekDays(w).filter((d) => isTraining(d) && data.done[d.id]).length;
function streak(ds = dates()): number {
  const t = today();
  const past = PLAN.filter((d) => isTraining(d) && ds[d.index] <= t).reverse();
  let n = 0;
  for (const d of past) {
    if (data.done[d.id]) n++;
    else if (ds[d.index] === t) continue; // today isn't missed yet
    else break;
  }
  return n;
}
const target = (w: number) => targets(w, data.setup!.startWeight, data.setup!.startVo2);
/** Weigh-ins are keyed by the week they close: Monday of week n records the end of week n-1 ("0" = start). */
const weighInKey = (w: number) => String(Math.max(0, Math.min(TOTAL_WEEKS, w - 1)));

/* ===================== HTML helpers ===================== */
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtNum = (n: number | undefined, dp = 1) => (n === undefined || Number.isNaN(n) ? '—' : n.toFixed(dp));
function anim(slug: string, tint: string, label = EXERCISE_NAMES[slug] ?? slug) {
  const frames = [1, 2, 3].map((i) => `<span class="f${i === 1 ? ' on' : ''}" style="--m:url('${frameUrl(slug, i)}')"></span>`).join('');
  return `<span class="fm" data-anim style="--tint:${tint}" role="img" aria-label="${esc(label)}">${frames}</span>`;
}
const ICONS = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19V5M4 19h16M7.5 15l4-4.5 3 2.5 5-6"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  tick: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};
function checkHtml(s: Status) {
  const label = s === 'done' ? 'Done' : s === 'missed' ? 'Missed' : 'Not done yet';
  return `<span class="check ${s}" role="img" aria-label="${label}">${s === 'done' ? ICONS.tick : ''}</span>`;
}
function dayItem(d: PlanDay, ds: string[]) {
  const t = TYPE_INFO[d.type];
  const date = ds[d.index];
  const s = statusOf(d, ds);
  return `<a class="item" href="#day/${d.id}">
    <span class="thumb">${anim(t.icon, t.tint)}</span>
    <span class="grow"><span class="t">${formatDate(date)} · ${t.label}${date === today() ? '<span class="today-tag">TODAY</span>' : ''}</span>
    <span class="d">${esc(headline(d))}${d.minutes ? ` · ~${d.minutes} min` : ''}${s === 'missed' ? ' · missed' : ''}</span></span>
    ${checkHtml(s)}</a>`;
}
function exerciseRows(list: { slug: string; name: string; amount: string }[], tint: string) {
  return `<div class="list">${list.map((e) => `<div class="item"><span class="thumb">${anim(e.slug, tint, e.name)}</span><span class="grow"><span class="t">${esc(cap(e.name))}</span><span class="d">${esc(e.amount)}</span></span></div>`).join('')}</div>`;
}
const timedRows = (items: TimedItem[], tint: string) =>
  exerciseRows(items.map((i) => ({ slug: i.slug, name: i.name, amount: i.note ?? (i.sides ? `${i.seconds / 2} s each side` : `${i.seconds} s`) })), tint);

/* ===================== Routing ===================== */
type Route = { name: 'today' | 'plan' | 'day' | 'progress' | 'more' | 'health' | 'setup'; arg?: string };
function parseRoute(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, arg] = h.split('/');
  if (name === 'plan') return { name: 'plan', arg };
  if (name === 'day' && arg && PLAN.some((d) => d.id === arg)) return { name: 'day', arg };
  if (name === 'progress') return { name: 'progress' };
  if (name === 'more') return { name: arg === 'health' ? 'health' : 'more' };
  if (name === 'setup') return { name: 'setup' };
  return { name: 'today' };
}
const tabOf = (r: Route) => (r.name === 'day' ? lastTab : r.name === 'health' || r.name === 'setup' ? 'more' : r.name);
let lastTab: 'today' | 'plan' | 'progress' | 'more' = 'today';
let planWeek: number | null = null;
let navDepth = 0; // in-app pushes, so Back can use history when it came from inside the app

/* ===================== Screens ===================== */
function screenSetup(editing: boolean) {
  const s = data.setup;
  return `
    ${editing ? '<div class="navbar"><a class="back" href="#more">‹ More</a></div>' : ''}
    <h1 class="large-title">${editing ? 'Starting numbers' : 'Welcome to Coach'}</h1>
    ${editing ? '' : `<p class="note" style="margin-bottom:16px">Your 24-week plan, from the checklist. Enter your starting numbers once. They stay on this iPhone and set your weekly targets: −0.7 kg and +0.5 VO₂ max a week.</p>`}
    ${!editing && isIOS() && !isStandalone() ? installCard() : ''}
    <form class="card stack" id="setup-form" novalidate>
      <div class="field"><label for="s-date">Start date (a Monday)</label><input class="input" type="date" id="s-date" required value="${esc(s?.startDate ?? DEFAULT_START)}"></div>
      <div class="grid2">
        <div class="field"><label for="s-weight">Start weight (kg)</label><input class="input" id="s-weight" inputmode="decimal" required placeholder="e.g. 113" value="${esc(s?.startWeight ?? '')}"></div>
        <div class="field"><label for="s-vo2">Start VO₂ max</label><input class="input" id="s-vo2" inputmode="decimal" required placeholder="e.g. 26" value="${esc(s?.startVo2 ?? '')}"></div>
      </div>
      <div class="field"><label for="s-waist">Start waist (cm, optional)</label><input class="input" id="s-waist" inputmode="decimal" placeholder="Measure at your belly button" value="${esc(s?.startWaist ?? '')}"></div>
      <p class="note" id="setup-error" role="alert"></p>
      <button class="btn" type="submit">${editing ? 'Save' : 'Start my plan'}</button>
    </form>`;
}

function installCard() {
  return `<div class="banner warn" style="margin-bottom:14px"><b>Add Coach to your Home Screen</b>
    <p class="note">In Safari, tap Share, then <b>Add to Home Screen</b>, and open Coach from there. The Home Screen app keeps its own log, separate from Safari, so set it up there.</p></div>`;
}

function weighInDue(ds: string[]) {
  const t = today();
  const d = dayOn(t, ds);
  if (!d || d.dow !== 0 || d.week === 1) return false;
  return !data.weighIns[weighInKey(d.week)];
}

function weeklySummary(w: number, compact = false) {
  const done = sessionsDone(w);
  const start = data.weighIns[String(w - 1)];
  const end = data.weighIns[String(w)];
  const tg = target(w);
  const note = nextWeekNote(w);
  const change = start?.weight !== undefined && end?.weight !== undefined ? end.weight - start.weight : undefined;
  return `<div class="card stack">
    <div class="row between"><h3 style="font:700 18px var(--font)">Week ${w} summary</h3><span class="sub">${done}/6 sessions</span></div>
    <div class="kv">
      <div class="card" style="background:var(--stage)"><b>${done}/6</b><span>sessions done</span></div>
      <div class="card" style="background:var(--stage)"><b>${change !== undefined ? `${change > 0 ? '+' : ''}${change.toFixed(1)}` : '—'}</b><span>kg this week</span></div>
      <div class="card" style="background:var(--stage)"><b>${tg.weight}</b><span>kg target</span></div>
    </div>
    ${compact ? '' : `<p class="note">${end ? `Weighed in at ${fmtNum(end.weight)} kg${end.vo2 ? `, VO₂ max ${fmtNum(end.vo2)}` : ''}.` : 'Weigh in tomorrow morning, after the toilet and before eating.'} Judge progress on the 2–3 week trend, because weekly numbers bounce around.</p>`}
    ${note && !compact ? `<p class="note"><b style="color:var(--ink)">Next week:</b> ${esc(note)}</p>` : ''}
  </div>`;
}

function screenToday() {
  if (!data.setup) return screenSetup(false);
  const ds = dates();
  const t = today();
  const pause = activePause();
  const parts: string[] = [];
  parts.push(`<p class="sub">${formatDate(t, true)}</p><h1 class="large-title">Today</h1>`);
  if (isIOS() && !isStandalone()) parts.push(installCard());

  if (pause) {
    const days = daysBetween(pause.start, t) + 1;
    parts.push(`<div class="banner warn"><b>Plan paused</b><p class="note">Since ${formatDate(pause.start)} (${days} day${days === 1 ? '' : 's'}). The rest of your plan moves back a day for every paused day. Rest and get well.</p>
      <button class="btn" data-action="resume">Resume today</button></div>`);
    const next = PLAN[nextIndexFrom(addDays(t, 1), ds)];
    if (next) {
      const ni = TYPE_INFO[next.type];
      parts.push(`<p class="section-label">Next session when you resume</p><a class="item" style="border-radius:18px" href="#day/${next.id}">
        <span class="thumb">${anim(ni.icon, ni.tint)}</span>
        <span class="grow"><span class="t">Week ${next.week} · ${ni.label}</span><span class="d">${esc(headline(next))}${next.minutes ? ` · ~${next.minutes} min` : ''}</span></span><span class="chev">›</span></a>`);
    }
    return parts.join('');
  }

  const firstDate = ds[0];
  if (t < firstDate) {
    const n = daysBetween(t, firstDate);
    parts.push(`<div class="card hero"><div class="chips"><span class="chip" style="--tint:var(--run)"><i></i>Starts in ${n} day${n === 1 ? '' : 's'}</span></div>
      <h2>Your plan starts ${formatDate(firstDate)}</h2>
      <p class="note">Kit: cushioned running shoes, a pair of adjustable dumbbells, a sturdy step or bench, and a water bottle.</p>
      ${!data.calendarAddedAt ? '<a class="btn ghost" href="#more">Set up calendar reminders</a>' : ''}</div>
      <p class="section-label">First week</p><div class="list">${weekDays(1).map((d) => dayItem(d, ds)).join('')}</div>`);
    return parts.join('');
  }
  const d = dayOn(t, ds);
  if (!d) {
    const done = PLAN.filter((x) => isTraining(x) && data.done[x.id]).length;
    parts.push(`<div class="card hero"><h2>Plan complete</h2><p class="note">You finished all 24 weeks on ${formatDate(ds[ds.length - 1])}, with ${done} of 144 sessions done. Check your VO₂ max in the Health app and compare it with your target of ${target(TOTAL_WEEKS).vo2}.</p>
      <a class="btn" href="#progress">See your progress</a></div>`);
    return parts.join('');
  }

  if (weighInDue(ds)) {
    parts.push(`<a class="banner good" href="#progress" style="color:inherit;text-decoration:none;margin-bottom:14px"><b>Monday weigh-in</b><span class="note">After the toilet, before eating. Note your VO₂ max from the Health app. Tap to log it →</span></a>`);
  }

  const info = TYPE_INFO[d.type];
  const s = statusOf(d, ds);
  if (d.type === 'rest') {
    parts.push(`<div class="card hero" style="--tint:${info.tint}">
      <div class="chips"><span class="chip" style="--tint:${info.tint}"><i></i>Rest day</span><span class="chip">Week ${d.week}${d.recovery ? ' · recovery' : ''}</span>${s === 'done' ? '<span class="chip" style="--tint:var(--good)"><i></i>Mobility done</span>' : ''}</div>
      <div class="stage">${anim('cat-cow-stretch', info.tint, 'Cat-cow mobility animation')}</div>
      <h2>Rest, or 10 minutes of mobility</h2>
      <p class="note">Optional 20–30 min gentle walk. Lay out your kit for tomorrow.</p>
      <button class="btn" data-start-mobility="${t}">Start mobility · 10 min</button>
      <a class="btn ghost" href="#day/${d.id}">See the full day</a></div>`);
  } else {
    const names = d.exercises ? d.exercises.map((e) => cap(e.name.split(',')[0])).join(', ') : headline(d);
    parts.push(`<div class="card hero" style="--tint:${info.tint}">
      <div class="chips"><span class="chip" style="--tint:${info.tint}"><i></i>${info.label}</span><span class="chip">~${d.minutes} min</span><span class="chip">Week ${d.week}${d.recovery ? ' · recovery' : ''}</span>${s === 'done' ? '<span class="chip" style="--tint:var(--good)"><i></i>Done</span>' : ''}</div>
      <div class="stage">${anim(d.exercises ? d.exercises[0].slug : info.icon, info.tint)}</div>
      <h2>${esc(names)}</h2>
      <p class="note">${esc(d.exercises ? `${cap(strengthHeader(d))}. Warm-up routine first, stretch routine to finish.` : d.main!)}</p>
      ${s === 'done' ? '<p class="note" style="color:var(--good)">Done. Nice work.</p>' : `<button class="btn" data-start="${d.id}">Start session</button>`}
      <a class="btn ghost" href="#day/${d.id}">See the full day</a></div>`);
  }

  const yesterday = PLAN[d.index - 1];
  if (yesterday && statusOf(yesterday, ds) === 'missed') {
    parts.push(`<p class="note" style="margin-top:12px">Missed yesterday? Carry on from today and don’t double up.</p>`);
  }

  if (d.dow === 6) parts.push(`<p class="section-label">This week</p>${weeklySummary(d.week)}`);
  else {
    const tg = target(d.week);
    parts.push(`<p class="section-label">This week</p><div class="kv">
      <div class="card"><b>${sessionsDone(d.week)}/6</b><span>sessions done</span></div>
      <div class="card"><b>${tg.weight}</b><span>kg target by Sun</span></div>
      <div class="card"><b>${tg.vo2}</b><span>VO₂ max target</span></div></div>`);
  }

  const tomorrow = PLAN[d.index + 1];
  if (tomorrow) {
    const ti = TYPE_INFO[tomorrow.type];
    parts.push(`<p class="section-label">Tomorrow</p><a class="item" style="border-radius:18px;border:1px dashed #3a3a36;background:none" href="#day/${tomorrow.id}">
      <span class="thumb">${anim(ti.icon, ti.tint)}</span>
      <span class="grow"><span class="t">${formatDate(ds[tomorrow.index])} · ${ti.label}</span><span class="d">${esc(headline(tomorrow))}${tomorrow.minutes ? `, ~${tomorrow.minutes} min` : ''}. ${tomorrow.type === 'rest' ? 'Recover.' : 'Lay out your kit tonight.'}</span></span>
      <span class="chev">›</span></a>`);
  }
  if (!data.calendarAddedAt) parts.push(`<a class="banner" href="#more" style="margin-top:14px;color:inherit;text-decoration:none"><b>Get daily reminders</b><span class="note">Add your plan to the iPhone Calendar, with alerts at 20:00 the night before and 07:00 on the day →</span></a>`);
  return parts.join('');
}

function screenPlan() {
  if (!data.setup) return screenSetup(false);
  const ds = dates();
  const cw = Math.min(currentWeek(ds), TOTAL_WEEKS);
  const wk = planWeek ?? cw;
  const days = weekDays(wk);
  const tg = target(wk);
  const strip = Array.from({ length: TOTAL_WEEKS }, (_, i) => {
    const n = i + 1;
    const rec = PLAN[i * 7].recovery;
    return `<button class="wk${rec ? ' rec' : ''}${n === cw ? ' current' : ''}" aria-pressed="${n === wk}" data-week="${n}" aria-label="Week ${n}${rec ? ', recovery week' : ''}${n === cw ? ', this week' : ''}"><span>WK</span><b>${n}</b></button>`;
  }).join('');
  const paused = data.pauses.reduce((a, p) => a + daysBetween(p.start, p.end ?? today()) + 1, 0);
  return `
    <h1 class="large-title">Plan</h1>
    <div class="week-strip" id="weekstrip">${strip}</div>
    <div class="stack" style="gap:4px;margin-bottom:12px">
      <h2 style="font:700 21px var(--font)">Week ${wk}${days[0].recovery ? ' · recovery week' : ''}${wk === TOTAL_WEEKS ? ' + final check' : ''}</h2>
      <p class="sub">${formatDate(ds[days[0].index])} – ${formatDate(ds[days[6].index])} · targets by Sunday ${tg.weight} kg · VO₂ max ${tg.vo2}</p>
      ${wk === 9 ? '<p class="note">From week 9 the pattern changes to fit in intervals: Wednesday becomes the rest day and Strength B moves to Sunday.</p>' : ''}
    </div>
    <div class="list">${days.map((d) => dayItem(d, ds)).join('')}</div>
    <p class="note" style="margin-top:12px">Recovery weeks (4, 8, 12, 16, 20, 24) are underlined in amber.${paused ? ` Pauses have moved your plan back ${paused} day${paused === 1 ? '' : 's'}; it now ends ${formatDate(ds[ds.length - 1], true)}.` : ''} Missed a day? Carry on from the next day and don’t double up.</p>`;
}

function screenDay(id: string) {
  if (!data.setup) return screenSetup(false);
  const d = PLAN.find((x) => x.id === id)!;
  const ds = dates();
  const date = ds[d.index];
  const info = TYPE_INFO[d.type];
  const s = statusOf(d, ds);
  const back = lastTab === 'today' ? 'Today' : lastTab === 'progress' ? 'Progress' : lastTab === 'more' ? 'More' : 'Plan';
  let body = '';
  if (d.exercises) {
    body = `
      <div class="block"><h4>Warm-up routine · 5 min</h4></div>${exerciseRows(WARMUP, 'var(--ink)')}
      <div class="block"><h4>Main · ${esc(strengthHeader(d))}</h4></div>${exerciseRows(d.exercises, info.tint)}
      <p class="note">Pick a weight where the last 2 reps of each set are hard but your form stays clean. When every set feels like you had 2 more reps in you, go up 1–2 kg.</p>
      <div class="block"><h4>Stretch routine · 5 min</h4><p class="note">Hold each for 30 s, no bouncing.</p></div>${timedRows(STRETCH, 'var(--good)')}
      ${d.extra ? `<div class="block"><h4>Final check</h4><p>${esc(d.extra)}</p></div>` : ''}`;
  } else if (d.type === 'rest') {
    body = `<div class="block"><h4>Rest day</h4><p>${esc(d.main)}</p></div>
      <div class="block"><h4>Optional mobility · 10 min</h4><p class="note">Gentle, slow movement to loosen up. Not part of your checklist.</p></div>${timedRows(MOBILITY, 'var(--good)')}`;
  } else {
    body = `
      ${d.warm ? `<div class="block"><h4>Warm-up</h4><p>${esc(d.warm)}</p></div>` : ''}
      <div class="block"><h4>Main</h4><p>${esc(d.main)}</p></div>
      <div class="block"><h4>Cool-down</h4><p>${esc(d.cool)}</p></div>
      <div class="zone"><span>Easy: full sentences</span><b style="color:var(--run)">145–155 bpm</b></div>
      ${d.type === 'int' ? '<div class="zone"><span>Hard: a few words only</span><b style="color:var(--hard)">165+ bpm</b></div>' : ''}
      <p class="note">Record it on your watch as Outdoor Run. Choose grass or park paths when you can.</p>
      <div class="block"><h4>Stretch routine · 5 min</h4></div>${timedRows(STRETCH, 'var(--good)')}`;
  }
  const done = data.done[d.id];
  return `
    <div class="navbar"><button class="back" data-back aria-label="Back to ${back}">‹ ${back}</button></div>
    <p class="sub">Week ${d.week}${d.recovery ? ' · recovery week' : ''}</p>
    <h1 class="large-title">${formatDate(date)}</h1>
    <div class="card hero" style="--tint:${info.tint}">
      <div class="chips"><span class="chip" style="--tint:${info.tint}"><i></i>${info.label}</span>${d.minutes ? `<span class="chip">~${d.minutes} min</span>` : ''}${s === 'done' ? '<span class="chip" style="--tint:var(--good)"><i></i>Done</span>' : s === 'missed' ? '<span class="chip" style="--tint:var(--danger)"><i></i>Missed</span>' : ''}</div>
      <div class="stage">${anim(d.exercises ? d.exercises[0].slug : d.type === 'rest' ? 'cat-cow-stretch' : info.icon, info.tint)}</div>
      ${d.type === 'rest'
        ? `<button class="btn" data-start-mobility="${date}">Start mobility · 10 min</button>`
        : `<button class="btn" data-start="${d.id}">${done ? 'Do it again' : 'Start session'}</button>
           <button class="btn ghost" data-toggle-done="${d.id}">${done ? 'Mark as not done' : 'Mark as done'}</button>`}
      ${done && (done.minutes || done.hr) ? `<p class="note">Logged: ${done.minutes ? `${done.minutes} min` : ''}${done.hr ? ` · avg ${done.hr} bpm` : ''}${done.feel ? ` · felt ${done.feel === 'right' ? 'about right' : done.feel === 'hard' ? 'too hard' : 'easy'}` : ''}</p>` : ''}
    </div>
    <div class="stack" style="margin-top:14px">${body}</div>
    <p class="safety" style="margin-top:16px">If any session brings on chest pain, dizziness or unusual breathlessness, stop and see your GP.</p>`;
}

/* ---------- Progress ---------- */
function lineChart(points: { x: number; y: number }[], targetFn: (w: number) => number, label: string, unit: string) {
  const W = 340, H = 180, pl = 36, pr = 22, pt = 12, pb = 26;
  const ys = [...points.map((p) => p.y), targetFn(0), targetFn(TOTAL_WEEKS)];
  let lo = Math.floor(Math.min(...ys) - 1);
  let hi = Math.ceil(Math.max(...ys) + 1);
  if (hi - lo < 4) { hi += 2; lo -= 2; }
  const x = (w: number) => pl + (w / TOTAL_WEEKS) * (W - pl - pr);
  const y = (v: number) => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const grid = ticks.map((v) => `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="#2a2a28"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end" fill="#8a8a84" font-size="10">${v}</text>`).join('');
  const xt = [0, 8, 16, 24].map((w) => `<text x="${x(w)}" y="${H - 8}" text-anchor="middle" fill="#8a8a84" font-size="10">${w === 0 ? 'Start' : `Wk ${w}`}</text>`).join('');
  const tgt = `<path d="M${x(0)},${y(targetFn(0))} L${x(TOTAL_WEEKS)},${y(targetFn(TOTAL_WEEKS))}" stroke="#8a8a84" stroke-width="1.5" stroke-dasharray="4 4" fill="none"/>`;
  let series = '';
  let trend = '';
  if (points.length) {
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.x)},${y(p.y)}`).join(' ');
    const last = points[points.length - 1];
    series = `<path d="${path}" stroke="var(--run)" stroke-width="2.5" fill="none" stroke-linejoin="round"/>` +
      points.map((p) => `<circle cx="${x(p.x)}" cy="${y(p.y)}" r="${p === last ? 4.5 : 2.5}" fill="var(--run)"/>`).join('');
    if (points.length >= 3) {
      const avg = points.map((_, i) => {
        const win = points.slice(Math.max(0, i - 2), i + 1);
        return { x: points[i].x, y: win.reduce((a, p) => a + p.y, 0) / win.length };
      }).slice(2);
      trend = `<path d="${avg.map((p, i) => `${i ? 'L' : 'M'}${x(p.x)},${y(p.y)}`).join(' ')}" stroke="var(--warn)" stroke-width="2" fill="none" opacity=".85"/>`;
    }
  }
  const lastP = points[points.length - 1];
  const desc = lastP ? `${label}: latest ${lastP.y} ${unit} at week ${lastP.x}.` : `${label}: no entries yet.`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)} Target shown as a dashed line.">${grid}${xt}${tgt}${trend}${series}</svg>`;
}

let healthPanel = false;
let healthFill: { weight?: number; vo2?: number; waist?: number } | null = null;

function screenProgress() {
  if (!data.setup) return screenSetup(false);
  const ds = dates();
  const cw = currentWeek(ds);
  const key = weighInKey(Math.min(cw, TOTAL_WEEKS + 1));
  const existing = data.weighIns[key];
  const keyNum = Number(key);
  const mondayIdx = Math.min(keyNum * 7, PLAN.length - 1);
  const mondayDate = keyNum >= TOTAL_WEEKS ? ds[ds.length - 1] : ds[mondayIdx];
  const fill = healthFill ?? {};
  const v = (n: number | undefined, f: number | undefined) => esc(f ?? n ?? '');
  const entries = Object.entries(data.weighIns).map(([k, w]) => ({ week: +k, ...w })).sort((a, b) => a.week - b.week);
  const weightPts = entries.filter((e) => e.weight !== undefined).map((e) => ({ x: e.week, y: e.weight! }));
  const vo2Pts = entries.filter((e) => e.vo2 !== undefined).map((e) => ({ x: e.week, y: e.vo2! }));
  const waistPts = entries.filter((e) => e.waist !== undefined).map((e) => ({ x: e.week, y: e.waist! }));
  const lastW = weightPts[weightPts.length - 1];
  const lastV = vo2Pts[vo2Pts.length - 1];
  const sw = data.setup.startWeight;
  const sv = data.setup.startVo2;
  const due = PLAN.filter((d) => isTraining(d) && ds[d.index] <= today()).length;
  const doneCount = PLAN.filter((d) => isTraining(d) && data.done[d.id]).length;
  const left = Math.max(0, daysBetween(today(), ds[ds.length - 1]));
  const pastWeeks = Array.from({ length: Math.min(cw - 1, TOTAL_WEEKS) }, (_, i) => i + 1).reverse();

  return `
    <h1 class="large-title">Progress</h1>
    <form class="card stack" id="weighin-form" novalidate>
      <div class="row between"><h2 style="font:700 18px var(--font)">${keyNum === 0 ? 'Starting numbers' : `Monday weigh-in · end of week ${keyNum}`}</h2><span class="sub">${mondayDate ? formatDate(mondayDate) : ''}</span></div>
      <p class="note">After the toilet, before eating. Read VO₂ max from the Health app.${keyNum > 0 ? ` Targets: ${target(keyNum).weight} kg · VO₂ max ${target(keyNum).vo2}.` : ''}</p>
      <div class="grid2">
        <div class="field"><label for="wi-kg">Weight (kg)</label><input class="input" id="wi-kg" inputmode="decimal" placeholder="${target(Math.max(keyNum, 0)).weight}" value="${v(existing?.weight, fill.weight)}"></div>
        <div class="field"><label for="wi-vo2">VO₂ max</label><input class="input" id="wi-vo2" inputmode="decimal" placeholder="${target(Math.max(keyNum, 0)).vo2}" value="${v(existing?.vo2, fill.vo2)}"></div>
      </div>
      ${data.settings.trackWaist ? `<div class="field"><label for="wi-waist">Waist (cm, optional)</label><input class="input" id="wi-waist" inputmode="decimal" placeholder="At your belly button" value="${v(existing?.waist, fill.waist)}"></div>` : ''}
      <button class="btn" type="submit">${existing ? 'Update weigh-in' : 'Save weigh-in'}</button>
      <button class="btn ghost" type="button" data-action="health-import">Import from Health</button>
      ${healthPanel ? `<div class="banner" id="health-panel"><b>Get your numbers from Health</b>
        <ol class="steps-list"><li>Run your <b>Coach Health</b> shortcut. It copies your latest weight, VO₂ max${data.settings.trackWaist ? ' and waist' : ''}.</li><li>Come back here and tap <b>Import from Health</b> again, then tap <b>Paste</b> when iOS asks.</li></ol>
        <a class="btn small ghost" href="shortcuts://run-shortcut?name=Coach%20Health">Run the shortcut</a>
        <div class="field"><label for="health-text">Or paste the copied text here</label><textarea class="input" id="health-text" placeholder="COACH-HEALTH&#10;weight: 112.4 kg&#10;vo2: 26.4"></textarea></div>
        <a class="note" href="#more/health" style="color:var(--run)">Haven’t made the shortcut yet? Set it up →</a></div>` : ''}
    </form>

    <p class="section-label">Weight</p>
    <div class="card stack">
      <div class="row between"><span class="big">${lastW ? `${fmtNum(lastW.y)} kg` : `${fmtNum(sw)} kg`}</span><span class="sub">${lastW && lastW.x > 0 ? `${lastW.y <= sw ? '−' : '+'}${Math.abs(sw - lastW.y).toFixed(1)} kg since start` : 'starting weight'}</span></div>
      ${lineChart(weightPts, (w) => sw - 0.7 * w, 'Weight', 'kg')}
      <div class="legend"><span><i style="background:var(--run)"></i>You</span><span><i style="background:var(--warn)"></i>3-week average</span><span><i style="background:#8a8a84"></i>Target, −0.7 kg a week</span></div>
    </div>
    <p class="section-label">VO₂ max</p>
    <div class="card stack">
      <div class="row between"><span class="big">${lastV ? fmtNum(lastV.y) : fmtNum(sv)}</span><span class="sub">goal ${target(TOTAL_WEEKS).vo2} by ${formatDate(ds[ds.length - 1])}</span></div>
      ${lineChart(vo2Pts, (w) => sv + 0.5 * w, 'VO₂ max', '')}
      <p class="note">Judge progress on the 2–3 week trend. Weekly numbers bounce around.</p>
    </div>
    ${data.settings.trackWaist && waistPts.length ? `<p class="section-label">Waist</p><div class="card stack"><div class="row between"><span class="big">${fmtNum(waistPts[waistPts.length - 1].y)} cm</span><span class="sub">${waistPts.length > 1 ? `${(waistPts[waistPts.length - 1].y - waistPts[0].y).toFixed(1)} cm since first` : ''}</span></div>${lineChart(waistPts, () => waistPts[0].y, 'Waist', 'cm')}</div>` : ''}
    <p class="section-label">Consistency</p>
    <div class="kv">
      <div class="card"><b>${doneCount}/${due}</b><span>sessions due so far</span></div>
      <div class="card"><b>${streak(ds)}</b><span>session streak</span></div>
      <div class="card"><b>${left}</b><span>days to go</span></div>
    </div>
    ${pastWeeks.length ? `<p class="section-label">Weekly summaries</p><div class="stack">${pastWeeks.map((w) => weeklySummary(w, true)).join('')}</div>` : ''}`;
}

/* ---------- More ---------- */
let pauseConfirm = false;
function screenMore() {
  if (!data.setup) return screenSetup(false);
  const r = data.settings;
  const pause = activePause();
  const ref = (title: string, text: string) => `<details class="block"><summary>${title}</summary><p class="note" style="margin-top:6px">${text}</p></details>`;
  return `
    <h1 class="large-title">More</h1>
    <p class="section-label" style="margin-top:0">Daily reminders</p>
    <div class="card stack">
      <div class="row"><label for="t-eve" style="flex:1"><b style="font:600 16px var(--font)">Night before</b><br><span class="note">“Tomorrow: Easy run/walk. Lay out your kit.”</span></label>
        <input class="input" style="width:128px" type="time" id="r-eve" value="${esc(r.eveningAt)}" aria-label="Night-before reminder time"><input type="checkbox" class="toggle" id="t-eve" ${r.evening ? 'checked' : ''} aria-label="Night-before reminder on"></div>
      <div class="row"><label for="t-morn" style="flex:1"><b style="font:600 16px var(--font)">Morning of</b><br><span class="note">“Today: Strength A, ~26 min.”</span></label>
        <input class="input" style="width:128px" type="time" id="r-morn" value="${esc(r.morningAt)}" aria-label="Morning reminder time"><input type="checkbox" class="toggle" id="t-morn" ${r.morning ? 'checked' : ''} aria-label="Morning reminder on"></div>
      <button class="btn" data-action="calendar">${data.calendarAddedAt ? 'Add updated plan to Calendar' : 'Add plan to Calendar'}</button>
      <button class="btn ghost" data-action="calendar-share">Share calendar file instead</button>
      <p class="note">Adds every session from today to the end of your plan, each with its full instructions and alerts at your times. When iOS asks, tap <b>Add All</b>. Tip: choose a calendar called “Coach”, so after a pause or a time change you can delete that calendar and add the updated plan cleanly.${data.calendarAddedAt ? ` Last added ${formatDate(data.calendarAddedAt.slice(0, 10))}.` : ''}</p>
    </div>

    <p class="section-label">Ill or on holiday?</p>
    <div class="card stack">
      ${pause
        ? `<p><b>Paused since ${formatDate(pause.start)}.</b></p><p class="note">Resume when you're ready. The rest of the plan picks up where you left off.</p><button class="btn" data-action="resume">Resume today</button>`
        : pauseConfirm
          ? `<div class="field"><label for="pause-from">Pause from</label><input class="input" type="date" id="pause-from" value="${today()}" max="${today()}" min="${data.setup.startDate}"></div>
             <p class="note">Every day of the pause moves the rest of your plan back by a day. Missed days before the pause stay missed.</p>
             <div class="grid2"><button class="btn ghost" data-action="pause-cancel">Cancel</button><button class="btn" data-action="pause-confirm">Pause plan</button></div>`
          : `<p class="note">Pausing moves the rest of your plan back, instead of marking days as missed. Don't pause for one missed day; just carry on.</p><button class="btn ghost" data-action="pause">Pause the plan</button>`}
      ${data.pauses.filter((p) => p.end).length ? `<p class="note">Past pauses: ${data.pauses.filter((p) => p.end).map((p) => `${formatDate(p.start)}–${formatDate(p.end!)}`).join(', ')}</p>` : ''}
    </div>

    <p class="section-label">Sound and music</p>
    <div class="list">
      <label class="item" for="t-voice"><span class="grow"><span class="t">Voice cues</span><span class="d">“Walk now”, “Rest over”. Beeps play either way.</span></span><input type="checkbox" class="toggle" id="t-voice" ${r.voice ? 'checked' : ''}></label>
    </div>
    <p class="note" style="margin-top:8px">Start your music in any app (Apple Music, Spotify, YouTube Music) before a session. Coach's beeps and voice play over it without stopping it, and you control the music from the Lock Screen or Control Center as usual.</p>

    <p class="section-label">Health</p>
    <div class="list">
      <a class="item" href="#more/health"><span class="grow"><span class="t">Import from Health</span><span class="d">Set up the Coach Health shortcut</span></span><span class="chev">›</span></a>
      <label class="item" for="t-waist"><span class="grow"><span class="t">Track waist</span><span class="d">Add an optional waist measurement to your weigh-ins</span></span><input type="checkbox" class="toggle" id="t-waist" ${r.trackWaist ? 'checked' : ''}></label>
    </div>

    <p class="section-label">Your starting numbers</p>
    <div class="list">
      <a class="item" href="#setup"><span class="grow"><span class="t">Start date</span></span><span class="val">${formatDate(data.setup.startDate, true)}</span><span class="chev">›</span></a>
      <a class="item" href="#setup"><span class="grow"><span class="t">Start weight</span></span><span class="val">${fmtNum(data.setup.startWeight)} kg</span><span class="chev">›</span></a>
      <a class="item" href="#setup"><span class="grow"><span class="t">Start VO₂ max</span></span><span class="val">${fmtNum(data.setup.startVo2)}</span><span class="chev">›</span></a>
    </div>

    <p class="section-label">Reference</p>
    <div class="stack">
      ${ref('Warm-up routine', 'Before every strength session, 5 min: 1 min marching or brisk walking on the spot · 10 arm circles each way · 10 bodyweight squats · 10 hip hinges · 10 leg swings each leg · 5 bodyweight lunges each leg.')}
      ${ref('Stretch routine', 'After every session, 5 min. Hold each for 30 s, no bouncing. Calf stretch against a wall, each leg · standing quad stretch, each leg · hamstring stretch with heel on a low step, each leg · kneeling hip-flexor stretch, each side · chest stretch in a doorway · child’s pose.')}
      ${ref('Heart rate', 'Easy = 145–155 bpm, able to talk in full sentences. Hard = 165+ bpm, a few words only. Record every run or run/walk as Outdoor Run.')}
      ${ref('Choosing weights', 'Pick a weight where the last 2 reps of each set are hard but your form stays clean. When every set feels like you had 2 more reps in you, go up 1–2 kg.')}
      ${ref('Kit', 'Cushioned running shoes, a pair of adjustable dumbbells, a sturdy step or bench, and a water bottle. Choose grass or park paths when you can.')}
      ${ref('The night before', 'Read tomorrow’s session, plan your meals around protein, and lay out your kit.')}
      ${ref('Missed a day?', 'Carry on from the next day; don’t double up. If any session brings on chest pain, dizziness or unusual breathlessness, stop and see your GP.')}
    </div>

    <p class="section-label">Your data</p>
    <div class="list">
      <button class="item" data-action="backup"><span class="grow"><span class="t">Back up</span><span class="d">${data.lastBackup ? `Last backup ${formatDate(data.lastBackup.slice(0, 10))}` : 'Save a copy to Files'}</span></span><span class="chev">›</span></button>
      <label class="item" for="restore-file" style="cursor:pointer"><span class="grow"><span class="t">Restore from a backup</span><span class="d">Replaces what's on this phone</span></span><span class="chev">›</span></label>
    </div>
    <input type="file" id="restore-file" accept="application/json,.json" class="sr-only">
    <p class="note" style="margin-top:12px">Your log stays on this iPhone, in Coach's own storage. Back up now and then, especially before changing phones. Exercise illustrations by Bryl Lim, based on Everkinetic (CC BY-SA 4.0).</p>`;
}

function screenHealth() {
  const waist = data.settings.trackWaist;
  const text = `COACH-HEALTH\nweight: [Weight sample]\nvo2: [VO₂ max sample]${waist ? '\nwaist: [Waist sample]' : ''}`;
  return `
    <div class="navbar"><a class="back" href="#more">‹ More</a></div>
    <h1 class="large-title">Import from Health</h1>
    <p class="note" style="margin-bottom:14px">Web apps can't read Apple Health directly, so a small shortcut does it. It reads your latest numbers and copies them, and Coach pastes them in. You only build it once.</p>
    <div class="card stack">
      <h2 style="font:700 18px var(--font)">Build the shortcut</h2>
      <ol class="steps-list">
        <li>Open the <b>Shortcuts</b> app, tap <b>+</b>, and name the shortcut <b>Coach Health</b>. Use exactly that name.</li>
        <li>Add <b>Find Health Samples</b>. Set: Type <b>is Weight</b>, Sort by <b>Start Date</b>, Order <b>Latest First</b>, Limit <b>1</b>.</li>
        <li>Add a second <b>Find Health Samples</b> with Type <b>is VO₂ Max</b>, sorted and limited the same way.</li>
        ${waist ? '<li>Add a third <b>Find Health Samples</b> with Type <b>is Waist Circumference</b>, sorted and limited the same way.</li>' : ''}
        <li>Add a <b>Text</b> action, and type the lines below. Where it says [Weight sample], tap and insert the result of the matching Find Health Samples step.</li>
      </ol>
      <pre class="copy">${esc(text)}</pre>
      <ol class="steps-list" start="${waist ? 6 : 5}">
        <li>Add <b>Copy to Clipboard</b>.</li>
        <li>Run it once and allow access to Health when asked.</li>
      </ol>
    </div>
    <div class="card stack" style="margin-top:12px">
      <h2 style="font:700 18px var(--font)">Each Monday</h2>
      <ol class="steps-list"><li>Weigh in. Your scale or the Health app saves the weight.</li><li>In Coach, go to Progress, tap <b>Import from Health</b>, then <b>Run the shortcut</b>.</li><li>Switch back to Coach, tap <b>Import from Health</b> again and tap <b>Paste</b>. Check the numbers and tap Save.</li></ol>
      <a class="btn ghost" href="shortcuts://run-shortcut?name=Coach%20Health">Test the shortcut</a>
    </div>`;
}

/* ===================== Session player ===================== */
type Step =
  | { kind: 'list'; title: string; sub: string; items: ExerciseItem[]; tint: string; button: string }
  | { kind: 'ex'; item: ExerciseItem; n: number; of: number }
  | { kind: 'timed'; label: string; note: string; seconds: number; slug: string; say: string }
  | { kind: 'phases'; title: string; phases: Phase[] }
  | { kind: 'seq'; title: string; sub: string; items: TimedItem[]; tint: string }
  | { kind: 'finish' };
type Session = {
  day: PlanDay | null;
  mobilityDate: string | null;
  steps: Step[];
  i: number;
  startedAt: number;
  setsDone: number;
  restEnd: number | null;
  running: boolean;
  endAt: number;
  remainingMs: number;
  sub: number;
  countdown: number;
  sideCued: boolean;
  feel: 'easy' | 'right' | 'hard';
};
let sess: Session | null = null;
let ticker: number | undefined;
const sheet = () => document.getElementById('session')!;

function segments(step: Step): number[] {
  if (step.kind === 'timed') return [step.seconds];
  if (step.kind === 'phases') return step.phases.map((p) => p.seconds);
  if (step.kind === 'seq') return step.items.map((i) => i.seconds);
  return [];
}
const isTimer = (s: Step) => s.kind === 'timed' || s.kind === 'phases' || s.kind === 'seq';

function buildSteps(d: PlanDay | null): Step[] {
  if (!d) return [{ kind: 'seq', title: 'Mobility', sub: 'Optional rest-day routine · 10 min', items: MOBILITY, tint: 'var(--good)' }, { kind: 'finish' }];
  const stretch: Step = { kind: 'seq', title: 'Stretch routine', sub: '5 min · 30 s each, no bouncing', items: STRETCH, tint: 'var(--good)' };
  if (d.exercises) {
    return [
      { kind: 'list', title: 'Warm-up routine', sub: '5 min · before every strength session', items: WARMUP, tint: 'var(--ink)', button: 'Warm-up done' },
      ...d.exercises.map((item, k) => ({ kind: 'ex' as const, item, n: k + 1, of: d.exercises!.length })),
      stretch,
      { kind: 'finish' },
    ];
  }
  const int = d.type === 'int';
  const steps: Step[] = [];
  if (d.warm || d.type === 'long') {
    steps.push({ kind: 'timed', label: 'Warm-up', note: d.warm ?? '5 min brisk walk', seconds: (int ? 10 : 5) * 60, slug: 'walking', say: int ? 'Warm up. Ten minutes easy walk or jog.' : 'Warm up. Five minutes brisk walk.' });
  }
  steps.push({ kind: 'phases', title: int ? 'Intervals' : d.main!.split(/, at /)[0], phases: mainPhases(d) });
  steps.push({ kind: 'timed', label: 'Cool-down', note: int ? '10 min easy walk' : '5 min walk', seconds: (int ? 10 : 5) * 60, slug: 'walking', say: 'Cool down. Easy walk.' });
  steps.push(stretch, { kind: 'finish' });
  return steps;
}

function openSession(d: PlanDay | null, mobilityDate: string | null = null) {
  unlockAudio(data.settings.voice);
  void keepAwake(true);
  sess = { day: d, mobilityDate, steps: buildSteps(d), i: 0, startedAt: Date.now(), setsDone: 0, restEnd: null, running: false, endAt: 0, remainingMs: 0, sub: 0, countdown: 0, sideCued: false, feel: 'right' };
  enterStep(false);
  const el = sheet();
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('open'));
  window.clearInterval(ticker);
  ticker = window.setInterval(tick, 250);
  history.pushState({ session: true }, '');
}

function closeSession(fromPop = false) {
  window.clearInterval(ticker);
  sess = null;
  void keepAwake(false);
  try { speechSynthesis.cancel(); } catch { /* ignore */ }
  const el = sheet();
  el.classList.remove('open');
  document.getElementById('confirm')!.hidden = true;
  setTimeout(() => { if (!sess) { el.hidden = true; el.innerHTML = ''; } }, 330);
  if (!fromPop && history.state?.session) history.back();
  render();
}

function enterStep(autoRun: boolean) {
  if (!sess) return;
  const step = sess.steps[sess.i];
  sess.setsDone = 0;
  sess.restEnd = null;
  sess.sub = 0;
  sess.countdown = 0;
  sess.sideCued = false;
  sess.running = false;
  if (isTimer(step)) {
    sess.remainingMs = segments(step)[0] * 1000;
    if (autoRun) startTimer();
  }
  renderSession();
  sheet().querySelector('.session-body')?.scrollTo(0, 0);
}

function cueSegment() {
  if (!sess) return;
  const step = sess.steps[sess.i];
  if (step.kind === 'timed') say(step.say);
  if (step.kind === 'phases') {
    const p = step.phases[sess.sub];
    const mins = Math.round(p.seconds / 60);
    const len = p.seconds % 60 === 0 ? `${mins} minute${mins === 1 ? '' : 's'}` : `${Math.floor(p.seconds / 60)} and a half minutes`;
    say(p.effort === 'hard' ? `Hard now. ${len}.` : p.label === 'Walk' ? `Walk now. ${len}.` : p.label === 'Easy' ? `Easy now. ${len}.` : `${p.label}. ${len}.`);
  }
  if (step.kind === 'seq') {
    const it = step.items[sess.sub];
    say(`${it.name}.${it.sides ? ' First side.' : ''}`);
  }
}

function startTimer() {
  if (!sess) return;
  sess.running = true;
  sess.endAt = Date.now() + sess.remainingMs;
  beep('go');
  cueSegment();
}
function pauseTimer() {
  if (!sess) return;
  sess.remainingMs = Math.max(0, sess.endAt - Date.now());
  sess.running = false;
}

function nextStep(autoRun: boolean) {
  if (!sess) return;
  sess.i = Math.min(sess.i + 1, sess.steps.length - 1);
  enterStep(autoRun);
  if (sess.steps[sess.i].kind === 'finish') {
    beep('done');
    say('Session done. Well done.');
  }
}

/** Runs four times a second. Works from the clock, so time spent with the phone locked is counted. */
function tick() {
  if (!sess) return;
  const step = sess.steps[sess.i];
  const now = Date.now();
  if (step.kind === 'ex' && sess.restEnd) {
    const left = sess.restEnd - now;
    if (left <= 0) {
      sess.restEnd = null;
      beep('go');
      say(sess.setsDone < (sess.day?.sets ?? 0) ? `Rest over. Set ${sess.setsDone + 1}.` : 'Rest over.');
      renderSession();
      return;
    }
    updateTimerDom(left);
    return;
  }
  if (!isTimer(step) || !sess.running) return;
  const segs = segments(step);
  let left = sess.endAt - now;
  let changed = false;
  while (left <= 0) {
    sess.sub += 1;
    sess.countdown = 0;
    sess.sideCued = false;
    if (sess.sub >= segs.length) {
      // Timed steps flow straight into the next one (warm-up → run → cool-down → stretches).
      const carry = -left;
      nextStep(true);
      if (sess && isTimer(sess.steps[sess.i])) sess.endAt -= carry;
      return;
    }
    sess.endAt += segs[sess.sub] * 1000;
    left = sess.endAt - now;
    changed = true;
  }
  if (changed) {
    beep('go');
    cueSegment();
    renderSession();
    return;
  }
  const secs = Math.ceil(left / 1000);
  if (secs <= 3 && secs >= 1 && sess.countdown !== secs && segs[sess.sub] > 10) {
    sess.countdown = secs;
    beep('tick');
  }
  if (step.kind === 'seq') {
    const it = step.items[sess.sub];
    if (it.sides && !sess.sideCued && left <= (it.seconds * 1000) / 2) {
      sess.sideCued = true;
      beep('go');
      say('Switch sides.');
    }
  }
  updateTimerDom(left);
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const RING_C = 2 * Math.PI * 96;
function ring(frac: number, tint: string) {
  return `<svg viewBox="0 0 220 220" aria-hidden="true"><circle cx="110" cy="110" r="96" stroke="#272727" stroke-width="12" fill="none"/><circle data-ring cx="110" cy="110" r="96" stroke="${tint}" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C * (1 - frac)}"/></svg>`;
}
function updateTimerDom(leftMs: number) {
  if (!sess) return;
  const el = sheet();
  const t = el.querySelector<HTMLElement>('[data-timer]');
  if (t) t.textContent = mmss(leftMs);
  const step = sess.steps[sess.i];
  const segs = segments(step);
  const r = el.querySelector<SVGCircleElement>('[data-ring]');
  if (r && segs.length) r.setAttribute('stroke-dashoffset', String(RING_C * (leftMs / (segs[sess.sub] * 1000))));
  const tl = el.querySelector<HTMLElement>('[data-total-left]');
  if (tl && step.kind === 'phases') tl.textContent = mmss(leftMs + segs.slice(sess.sub + 1).reduce((a, b) => a + b, 0) * 1000);
}

function renderSession() {
  if (!sess) return;
  const s = sess;
  const d = s.day;
  const info = d ? TYPE_INFO[d.type] : { label: 'Mobility', tint: 'var(--good)', icon: 'cat-cow-stretch' };
  const step = s.steps[s.i];
  const pct = Math.round((s.i / (s.steps.length - 1)) * 100);
  const left = s.running ? s.endAt - Date.now() : s.remainingMs;
  let body = '';
  let foot = '';
  const backBtn = s.i > 0 && step.kind !== 'finish' ? '<button class="btn ghost small" data-sess="back" aria-label="Previous step">‹</button>' : '<span></span>';

  if (step.kind === 'list') {
    body = `<p class="sub">${esc(step.sub)}</p><h2 style="font:800 28px var(--font)">${esc(step.title)}</h2>${exerciseRows(step.items, step.tint)}`;
    foot = `${backBtn}<button class="btn" data-sess="next">${esc(step.button)}</button>`;
  } else if (step.kind === 'ex') {
    const sets = d!.sets!;
    const kgable = !/plank|push-up/.test(step.item.slug);
    const last = data.kg[step.item.slug];
    body = `<p class="sub">Exercise ${step.n} of ${step.of} · ${esc(strengthHeader(d!))}</p>
      <div class="stage sq">${anim(step.item.slug, info.tint, step.item.name)}</div>
      <div class="ex-title"><h2>${esc(cap(step.item.name))}</h2><p>${esc(step.item.amount)}</p></div>
      <div class="sets" role="group" aria-label="Sets: tap each one when you finish it">${Array.from({ length: sets }, (_, k) => `<button class="set${k < s.setsDone ? ' done' : ''}" data-set="${k}" aria-pressed="${k < s.setsDone}" aria-label="Set ${k + 1}">${k + 1}</button>`).join('')}</div>
      ${s.restEnd ? `<div class="rest-bar" role="timer"><span>Rest</span><b data-timer>${mmss(s.restEnd - Date.now())}</b><button class="btn ghost small" data-sess="skip-rest">Skip</button></div>`
        : `<p class="note" style="text-align:center">${s.setsDone >= sets ? 'All sets done.' : `Tap a set when you finish it. A ${d!.rest} rest timer starts on its own.`}</p>`}
      ${kgable ? `<div class="field"><label for="kg">Weight used (kg)${last ? ` · last time ${last} kg` : ''}</label><input class="input" id="kg" inputmode="decimal" placeholder="${last ? `${last}` : 'kg'}" value="${esc(last ?? '')}" data-slug="${step.item.slug}"></div>` : ''}`;
    foot = `${backBtn}<button class="btn" data-sess="next">${step.n === step.of ? 'On to stretches' : 'Next exercise'}</button>`;
  } else if (step.kind === 'timed') {
    body = `<p class="sub">${esc(step.note)}</p>
      <div class="ring">${ring(left / (step.seconds * 1000), 'var(--ink)')}<div class="inner"><span class="phase-name" style="--tint:var(--ink)">${step.label}</span><span class="big-timer" data-timer>${mmss(left)}</span></div></div>
      <div class="stage wide">${anim(step.slug, 'var(--ink)')}</div>`;
    foot = `<button class="btn ghost small" data-sess="skip">Skip</button><button class="btn" data-sess="play">${s.running ? 'Pause' : left < step.seconds * 1000 ? 'Resume' : 'Start'}</button>`;
  } else if (step.kind === 'phases') {
    const p = step.phases[s.sub];
    const next = step.phases[s.sub + 1];
    const tint = p.effort === 'hard' ? 'var(--hard)' : p.effort === 'walk' ? 'var(--ink)' : 'var(--run)';
    const hard = p.effort === 'hard';
    const totalLeft = left + step.phases.slice(s.sub + 1).reduce((a, x) => a + x.seconds, 0) * 1000;
    body = `<p class="sub">${esc(step.title)}${step.phases.length > 1 ? ` · block ${s.sub + 1} of ${step.phases.length}` : ''}</p>
      <div class="ring">${ring(left / (p.seconds * 1000), tint)}<div class="inner"><span class="phase-name" style="--tint:${tint}">${esc(p.label)}</span><span class="big-timer" data-timer>${mmss(left)}</span><span class="sub">${next ? `then ${esc(next.label.toLowerCase())} ${mmss(next.seconds * 1000)}` : 'last block'}</span></div></div>
      <div class="zone"><span>${hard ? 'Hard: a few words only' : 'Easy: full sentences'}</span><b style="color:${hard ? 'var(--hard)' : 'var(--run)'}">${hard ? '165+ bpm' : p.effort === 'walk' && d?.type === 'int' ? 'recover' : '145–155 bpm'}</b></div>
      <div class="stage wide">${anim(p.slug, tint)}</div>
      <p class="note" style="text-align:center"><span data-total-left>${mmss(totalLeft)}</span> of the main session left.${hard ? '' : ' Walk if you go over 155.'} Record it on your watch as Outdoor Run.</p>`;
    foot = `<button class="btn ghost small" data-sess="skip">Skip</button><button class="btn" data-sess="play">${s.running ? 'Pause' : s.sub > 0 || left < p.seconds * 1000 ? 'Resume' : 'Start'}</button>`;
  } else if (step.kind === 'seq') {
    const it = step.items[s.sub];
    const next = step.items[s.sub + 1];
    body = `<p class="sub">${esc(step.sub)} · ${s.sub + 1} of ${step.items.length}</p>
      <div class="stage sq">${anim(it.slug, step.tint, it.name)}</div>
      <div class="ex-title"><h2>${esc(it.name)}</h2><p style="color:var(--good)">${esc(it.note ?? (it.sides ? `${it.seconds / 2} s each side` : `${it.seconds} s`))}</p></div>
      <div class="big-timer" data-timer style="font-size:48px">${mmss(left)}</div>
      <p class="note" style="text-align:center">${next ? `Next: ${esc(next.name)}` : 'Last one'}${it.sides ? ' · a cue tells you when to switch sides' : ''}</p>`;
    foot = `<button class="btn ghost small" data-sess="skip">${next ? 'Skip' : 'Finish'}</button><button class="btn" data-sess="play">${s.running ? 'Pause' : s.sub > 0 || left < it.seconds * 1000 ? 'Resume' : 'Start'}</button>`;
  } else {
    const mins = Math.max(1, Math.round((Date.now() - s.startedAt) / 60000));
    const run = d && !d.exercises;
    body = `<div class="stage">${anim(info.icon, 'var(--good)')}</div>
      <h2 style="font:800 30px var(--font);text-align:center">${d ? 'Session done' : 'Mobility done'}</h2>
      <p class="sub" style="text-align:center">${d ? `${formatDate(dateOf(d))} · ${info.label}` : formatDate(s.mobilityDate!)}</p>
      ${d ? `<div class="${run ? 'grid2' : ''}">
        <div class="field"><label for="f-min">Duration (min)</label><input class="input" id="f-min" inputmode="numeric" value="${mins}"></div>
        ${run ? '<div class="field"><label for="f-hr">Avg heart rate</label><input class="input" id="f-hr" inputmode="numeric" placeholder="bpm"></div>' : ''}
      </div>
      <div class="field"><span class="sub" id="feel-label">How did it feel?</span><div class="seg" role="group" aria-labelledby="feel-label">${(['easy', 'right', 'hard'] as const).map((f) => `<button aria-pressed="${s.feel === f}" data-feel="${f}">${f === 'easy' ? 'Easy' : f === 'right' ? 'About right' : 'Too hard'}</button>`).join('')}</div></div>
      ${run ? '<p class="note">Save it on your watch as Outdoor Run too.</p>' : '<p class="note">If every set felt easy, go up 1–2 kg next time.</p>'}` : ''}`;
    foot = `<span></span><button class="btn" data-sess="finish">Save and finish</button>`;
  }
  const el = sheet();
  el.style.setProperty('--tint', info.tint);
  const kgFocused = document.activeElement?.id === 'kg';
  el.innerHTML = `
    <div class="session-top"><button class="icon-btn" data-sess="close" aria-label="End session">✕</button><span class="title">${esc(info.label)}${d ? ` · Week ${d.week}` : ''}</span>${awakeBadge()}</div>
    <div class="progress"><i style="width:${pct}%"></i></div>
    <div class="session-body"><div class="wrap">${body}</div></div>
    <div class="session-foot">${foot}</div>`;
  if (kgFocused) (el.querySelector('#kg') as HTMLInputElement | null)?.focus();
}
const awakeBadge = () => isAwake()
  ? '<span class="awake" data-awake title="The screen stays on during this session"><i></i>Screen on</span>'
  : '<span class="awake off" data-awake title="iOS didn’t allow Coach to keep the screen on. Set Auto-Lock to Never in Settings › Display &amp; Brightness while you train."><i></i>May dim</span>';
onAwakeChange(() => {
  const b = sheet().querySelector('[data-awake]');
  if (b) b.outerHTML = awakeBadge();
});

function finishSession() {
  if (!sess) return;
  const s = sess;
  if (s.day) {
    const entry: DoneEntry = { at: new Date().toISOString(), feel: s.feel };
    const m = Number((document.getElementById('f-min') as HTMLInputElement | null)?.value);
    const hr = Number((document.getElementById('f-hr') as HTMLInputElement | null)?.value);
    if (m > 0) entry.minutes = Math.round(m);
    if (hr > 40 && hr < 230) entry.hr = Math.round(hr);
    data.done[s.day.id] = entry;
  } else if (s.mobilityDate) {
    data.mobility[s.mobilityDate] = new Date().toISOString();
  }
  persist();
  closeSession();
  toast('Saved. Nice work.');
}

/* ===================== Shell ===================== */
let route = parseRoute();
function render() {
  route = parseRoute();
  const tab = tabOf(route);
  if (route.name !== 'day') lastTab = tab as typeof lastTab;
  const view = document.getElementById('view')!;
  let html: string;
  if (!data.setup && route.name !== 'setup') html = screenSetup(false);
  else if (route.name === 'setup') html = screenSetup(!!data.setup);
  else if (route.name === 'day') html = screenDay(route.arg!);
  else if (route.name === 'plan') html = screenPlan();
  else if (route.name === 'progress') html = screenProgress();
  else if (route.name === 'more') html = screenMore();
  else if (route.name === 'health') html = screenHealth();
  else html = screenToday();
  view.innerHTML = `<div class="wrap">${html}</div>`;
  const tabs: [typeof lastTab, string][] = [['today', 'Today'], ['plan', 'Plan'], ['progress', 'Progress'], ['more', 'More']];
  const bar = document.getElementById('tabbar')!;
  bar.hidden = !data.setup;
  bar.innerHTML = tabs.map(([k, l]) => `<a class="tab" href="#${k}" ${tab === k ? 'aria-current="page"' : ''}>${ICONS[k]}<span>${l}</span></a>`).join('');
  if (route.name === 'plan') view.querySelector('.wk[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  updateBadge();
  document.title = `Coach · ${route.name === 'day' ? 'Day' : cap(tab)}`;
}
function updateBadge() {
  if (!data.setup) return;
  const ds = dates();
  const d = dayOn(today(), ds);
  setBadge(d && isTraining(d) && !data.done[d.id] && !activePause() ? 1 : 0);
}

function toast(msg: string) {
  const t = document.getElementById('toast')!;
  t.textContent = msg;
  t.classList.add('show');
  window.clearTimeout((toast as unknown as { t?: number }).t);
  (toast as unknown as { t?: number }).t = window.setTimeout(() => t.classList.remove('show'), 2600);
}

const num = (id: string): number | undefined => {
  const raw = (document.getElementById(id) as HTMLInputElement | null)?.value.trim().replace(',', '.');
  if (!raw) return undefined;
  const v = Number(raw);
  return Number.isFinite(v) ? v : NaN;
};

/* ---------- Events ---------- */
window.addEventListener('hashchange', () => {
  navDepth++;
  healthPanel = false;
  healthFill = null;
  pauseConfirm = false;
  render();
  document.getElementById('view')!.scrollTop = 0;
});
window.addEventListener('popstate', () => {
  // The phone's back gesture closes a running session sheet instead of leaving the page.
  if (sess && !history.state?.session) {
    history.pushState({ session: true }, '');
    document.getElementById('confirm')!.hidden = false;
  }
});

root.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;
  const el = target.closest<HTMLElement>('button, [data-week]');
  if (!el) return;
  const ds = el.dataset;
  if (ds.week) { planWeek = +ds.week; render(); return; }
  if ('back' in ds) {
    if (navDepth > 0) { navDepth -= 2; history.back(); } else location.hash = lastTab === 'today' ? '#today' : `#${lastTab}`;
    return;
  }
  if (ds.start) { openSession(PLAN.find((d) => d.id === ds.start)!); return; }
  if (ds.startMobility) { openSession(null, ds.startMobility); return; }
  if (ds.toggleDone) {
    if (data.done[ds.toggleDone]) delete data.done[ds.toggleDone];
    else data.done[ds.toggleDone] = { at: new Date().toISOString() };
    persist(); render();
    toast(data.done[ds.toggleDone] ? 'Marked as done' : 'Marked as not done');
    return;
  }
  if (ds.set !== undefined && sess) {
    const k = +ds.set;
    const was = sess.setsDone;
    sess.setsDone = k < was ? k : k + 1;
    const sets = sess.day?.sets ?? 0;
    if (sess.setsDone > was && sess.setsDone < sets) {
      sess.restEnd = Date.now() + (sess.day?.restSec ?? 75) * 1000;
      beep('tick');
    } else sess.restEnd = null;
    if (sess.setsDone >= sets && sess.setsDone > was) say('All sets done.');
    renderSession();
    return;
  }
  if (ds.feel && sess) { sess.feel = ds.feel as Session['feel']; renderSession(); return; }
  if (ds.sess && sess) {
    const step = sess.steps[sess.i];
    switch (ds.sess) {
      case 'close': document.getElementById('confirm')!.hidden = false; break;
      case 'next': nextStep(false); break;
      case 'back': sess.i = Math.max(0, sess.i - 1); enterStep(false); break;
      case 'skip-rest': sess.restEnd = null; renderSession(); break;
      case 'play':
        if (sess.running) pauseTimer(); else startTimer();
        renderSession();
        break;
      case 'skip': {
        const segs = segments(step);
        if (sess.sub + 1 < segs.length) {
          const wasRunning = sess.running;
          sess.sub += 1; sess.remainingMs = segs[sess.sub] * 1000; sess.sideCued = false; sess.countdown = 0;
          if (wasRunning) { sess.endAt = Date.now() + sess.remainingMs; cueSegment(); }
          renderSession();
        } else nextStep(sess.running);
        break;
      }
      case 'finish': finishSession(); break;
    }
    return;
  }
  if (ds.end === 'yes') { closeSession(); return; }
  if (ds.end === 'no') { document.getElementById('confirm')!.hidden = true; return; }
  if (ds.reload !== undefined) { location.reload(); return; }

  switch (ds.action) {
    case 'resume': {
      const p = activePause();
      if (p) {
        if (p.start >= today()) data.pauses = data.pauses.filter((x) => x !== p);
        else p.end = addDays(today(), -1);
        persist(); render();
        toast(data.calendarAddedAt ? 'Resumed. Add the updated plan to Calendar from More.' : 'Resumed. Welcome back.');
      }
      break;
    }
    case 'pause': pauseConfirm = true; render(); break;
    case 'pause-cancel': pauseConfirm = false; render(); break;
    case 'pause-confirm': {
      const from = (document.getElementById('pause-from') as HTMLInputElement).value || today();
      const start = from > today() ? today() : from < data.setup!.startDate ? data.setup!.startDate : from;
      data.pauses.push({ start, end: null });
      pauseConfirm = false;
      persist(); location.hash = '#today'; render();
      toast('Plan paused');
      break;
    }
    case 'calendar':
    case 'calendar-share': {
      const dsx = dates();
      const from = nextIndexFrom(today(), dsx);
      if (from >= PLAN.length) { toast('Your plan is finished, so there is nothing left to add.'); break; }
      const ics = buildIcs(dsx, APP_URL, data.settings, from);
      const res = await saveFile('coach-plan.ics', 'text/calendar', ics, ds.action === 'calendar-share');
      if (res !== 'cancelled') {
        data.calendarAddedAt = new Date().toISOString();
        persist(); render();
        toast(`Opened ${PLAN.length - from} sessions for Calendar. Tap Add All.`);
      }
      break;
    }
    case 'backup': {
      const json = JSON.stringify(data, null, 2);
      const res = await saveFile(`coach-backup-${today()}.json`, 'application/json', json, true);
      if (res !== 'cancelled') { data.lastBackup = new Date().toISOString(); persist(); render(); toast('Backup saved'); }
      break;
    }
    case 'health-import': {
      let text = (document.getElementById('health-text') as HTMLTextAreaElement | null)?.value ?? '';
      if (!parseHealth(text)) {
        try { text = await navigator.clipboard.readText(); } catch { text = ''; }
      }
      const parsed = parseHealth(text);
      if (parsed) {
        healthFill = parsed;
        healthPanel = false;
        render();
        toast(`From Health: ${[parsed.weight && `${parsed.weight} kg`, parsed.vo2 && `VO₂ max ${parsed.vo2}`, parsed.waist && `waist ${parsed.waist} cm`].filter(Boolean).join(', ')}. Check it, then tap Save.`);
      } else {
        healthPanel = true;
        render();
        document.getElementById('health-panel')?.scrollIntoView({ block: 'nearest' });
      }
      break;
    }
  }
});

root.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.id === 'kg' && t.dataset.slug) {
    const v = Number(t.value.replace(',', '.'));
    if (v > 0 && v < 500) { data.kg[t.dataset.slug] = v; persist(); }
  }
});
root.addEventListener('change', async (e) => {
  const t = e.target as HTMLInputElement;
  const st = data.settings;
  if (t.id === 't-eve') st.evening = t.checked;
  else if (t.id === 't-morn') st.morning = t.checked;
  else if (t.id === 'r-eve' && t.value) st.eveningAt = t.value;
  else if (t.id === 'r-morn' && t.value) st.morningAt = t.value;
  else if (t.id === 't-voice') { st.voice = t.checked; setVoice(t.checked); }
  else if (t.id === 't-waist') { st.trackWaist = t.checked; persist(); render(); return; }
  else if (t.id === 'restore-file' && t.files?.[0]) {
    try {
      const restored = normalise(JSON.parse(await t.files[0].text()));
      data = restored;
      persist(); render();
      toast('Restored from backup');
    } catch (err) {
      toast(err instanceof Error && err.message.includes('Coach') ? err.message : 'That file couldn’t be read. Choose a coach-backup .json file.');
    }
    t.value = '';
    return;
  } else return;
  persist();
  if (['t-eve', 't-morn', 'r-eve', 'r-morn'].includes(t.id) && data.calendarAddedAt) toast('Saved. Add the updated plan to Calendar to use the new times.');
});

root.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  if (form.id === 'setup-form') {
    const date = (document.getElementById('s-date') as HTMLInputElement).value;
    const weight = num('s-weight');
    const vo2 = num('s-vo2');
    const waist = num('s-waist');
    const err = document.getElementById('setup-error')!;
    if (!date) { err.textContent = 'Choose your start date.'; return; }
    if (!weight || Number.isNaN(weight) || weight < 30 || weight > 300) { err.textContent = 'Enter your start weight in kg, for example 113.'; return; }
    if (!vo2 || Number.isNaN(vo2) || vo2 < 10 || vo2 > 90) { err.textContent = 'Enter your VO₂ max from the Health app, for example 26.'; return; }
    const first = !data.setup;
    data.setup = { startDate: date, startWeight: weight, startVo2: vo2, ...(waist && !Number.isNaN(waist) ? { startWaist: waist } : {}) };
    data.weighIns['0'] = { date, weight, vo2, ...(waist && !Number.isNaN(waist) ? { waist } : {}) };
    if (waist && !Number.isNaN(waist)) data.settings.trackWaist = true;
    persist();
    void requestPersistence();
    location.hash = first ? '#today' : '#more';
    render();
    toast(first ? 'Your plan is ready' : 'Saved');
    return;
  }
  if (form.id === 'weighin-form') {
    const ds = dates();
    const key = weighInKey(Math.min(currentWeek(ds), TOTAL_WEEKS + 1));
    const weight = num('wi-kg');
    const vo2 = num('wi-vo2');
    const waist = num('wi-waist');
    if ([weight, vo2, waist].some((x) => x !== undefined && Number.isNaN(x))) { toast('Use numbers only, for example 112.4'); return; }
    if (weight === undefined && vo2 === undefined && waist === undefined) { toast('Enter your weight or VO₂ max first'); return; }
    const prev = data.weighIns[key] ?? { date: today() };
    data.weighIns[key] = { ...prev, date: today(), ...(weight !== undefined ? { weight } : {}), ...(vo2 !== undefined ? { vo2 } : {}), ...(waist !== undefined ? { waist } : {}) };
    if (key === '0' && data.setup) {
      if (weight !== undefined) data.setup.startWeight = weight;
      if (vo2 !== undefined) data.setup.startVo2 = vo2;
    }
    healthFill = null;
    persist(); render();
    const tg = target(Number(key));
    toast(weight !== undefined && Number(key) > 0 ? `Saved. ${weight <= tg.weight ? 'On target' : `${(weight - tg.weight).toFixed(1)} kg above target`} for week ${key}.` : 'Saved');
  }
});

/* Frame animation: ping-pong through 3 frames every 450 ms, like FitSplit. Stops when Reduce Motion is on. */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let frameIdx = 0;
let dir = 1;
window.setInterval(() => {
  if (reduceMotion.matches || document.hidden) return;
  frameIdx += dir;
  if (frameIdx === 2 || frameIdx === 0) dir *= -1;
  document.querySelectorAll('[data-anim]').forEach((el) => {
    const f = el.children;
    for (let k = 0; k < f.length; k++) f[k].classList.toggle('on', k === frameIdx);
  });
}, 450);

/* Updates: the service worker takes over a new version straight away; offer a reload. */
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    const bar = document.getElementById('update-bar')!;
    bar.hidden = false;
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${BASE}sw.js`).then((reg) => reg.update()).catch(() => { /* offline support is optional */ });
  });
}
// Re-render when coming back to the app on a new day.
let lastDay = today();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && today() !== lastDay) {
    lastDay = today();
    if (!sess) render();
  }
});

// A day can't be "missed" if the plan restarts; make sure an open pause never starts before the plan.
if (data.setup && data.pauses.some((p) => isPaused(data.setup!.startDate, [p], today()) && p.start < data.setup!.startDate)) {
  data.pauses = data.pauses.map((p) => (p.start < data.setup!.startDate ? { ...p, start: data.setup!.startDate } : p));
}
render();
