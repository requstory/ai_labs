import type { Exercise } from '@bryllim/workout-guide';

export type ExerciseLocation = 'home' | 'gym';

const GYM_EQUIPMENT = new Set(['Barbell', 'Machine', 'Cable', 'Plate']);

const GYM_MACHINE_CARDIO_SLUGS = new Set([
  'cycling',
  'rowing',
  'stair-climber',
  'elliptical',
  'assault-bike',
  'skierg',
  'treadmill-incline-walk',
]);

export function exerciseLocation(exercise: Pick<Exercise, 'slug' | 'equipment'>): ExerciseLocation {
  if (GYM_MACHINE_CARDIO_SLUGS.has(exercise.slug)) return 'gym';
  if (GYM_EQUIPMENT.has(exercise.equipment)) return 'gym';
  return 'home';
}
