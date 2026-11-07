import { DEFAULT_START, type Pause } from './plan';
import type { ReminderSettings } from './ics';

export type DoneEntry = { at: string; minutes?: number; hr?: number; feel?: 'easy' | 'right' | 'hard' };
export type WeighIn = { date: string; weight?: number; vo2?: number; waist?: number };
export type CoachData = {
  version: 1;
  setup: { startDate: string; startWeight: number; startVo2: number; startWaist?: number } | null;
  done: Record<string, DoneEntry>; // by plan day id
  mobility: Record<string, string>; // ISO date -> completed at
  weighIns: Record<string, WeighIn>; // by plan week number ("0" = start)
  kg: Record<string, number>; // last weight used per exercise slug
  pauses: Pause[];
  settings: ReminderSettings & { voice: boolean; trackWaist: boolean };
  calendarAddedAt?: string;
  lastBackup?: string;
};

const KEY = 'coach:v1';

export const emptyData = (): CoachData => ({
  version: 1,
  setup: null,
  done: {},
  mobility: {},
  weighIns: {},
  kg: {},
  pauses: [],
  settings: { evening: true, eveningAt: '20:00', morning: true, morningAt: '07:00', voice: true, trackWaist: false },
});

/** Accepts stored or restored JSON and fills in anything missing, so older backups keep working. */
export function normalise(raw: unknown): CoachData {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<CoachData>;
  if (r.version !== 1) throw new Error('This file is not a Coach backup.');
  return {
    ...base,
    ...r,
    setup: r.setup ? { ...r.setup, startDate: r.setup.startDate || DEFAULT_START } : null,
    settings: { ...base.settings, ...(r.settings ?? {}) },
    done: r.done ?? {},
    mobility: r.mobility ?? {},
    weighIns: r.weighIns ?? {},
    kg: r.kg ?? {},
    pauses: Array.isArray(r.pauses) ? r.pauses : [],
  };
}

export function load(): CoachData {
  try {
    const text = localStorage.getItem(KEY);
    return text ? normalise(JSON.parse(text)) : emptyData();
  } catch {
    return emptyData();
  }
}

export function save(data: CoachData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Asks the browser not to clear Coach's storage when space runs low. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
