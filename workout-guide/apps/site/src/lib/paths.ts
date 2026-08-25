import type { ExerciseFrame } from '@bryllim/workout-guide';

export function withBase(path = '') {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const normalized = path.replace(/^\//, '');
  return normalized ? `${base}/${normalized}` : `${base}/`;
}

export function frameUrl(slug: string, frame: ExerciseFrame | number) {
  const index = typeof frame === 'number' ? frame : frame.index;
  return withBase(`frames/${slug}/frame-${index}.svg`);
}
