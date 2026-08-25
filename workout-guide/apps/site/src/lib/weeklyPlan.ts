import type { Exercise } from '@bryllim/workout-guide';

export type PlanDay = {
  slug: string;
  day: string;
  focus: string;
  description: string;
  muscles: string[];
  includeStretches?: boolean;
};

export const weeklyPlan: PlanDay[] = [
  {
    slug: 'monday',
    day: 'Monday',
    focus: 'Chest & Triceps',
    description: 'Push day. Build pressing strength through the chest and triceps.',
    muscles: ['Chest', 'Triceps'],
  },
  {
    slug: 'tuesday',
    day: 'Tuesday',
    focus: 'Back & Biceps',
    description: 'Pull day. Rows, pulldowns, and curls for a stronger back and arms.',
    muscles: ['Back', 'Lats', 'Upper Back', 'Rear Delts', 'Biceps', 'Forearms'],
  },
  {
    slug: 'wednesday',
    day: 'Wednesday',
    focus: 'Legs & Glutes',
    description: 'Lower body day. Squats, hinges, and single-leg work.',
    muscles: ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Adductors', 'Legs', 'Posterior Chain'],
  },
  {
    slug: 'thursday',
    day: 'Thursday',
    focus: 'Shoulders & Core',
    description: 'Build shoulder stability and a strong midline.',
    muscles: ['Shoulders', 'Core', 'Hips'],
  },
  {
    slug: 'friday',
    day: 'Friday',
    focus: 'Full Body & Mobility',
    description: 'Wind down the week with mobility work and lower-back care.',
    muscles: ['Lower Back', 'Mobility'],
    includeStretches: true,
  },
];

export function getPlanExercises(planDay: PlanDay, exercises: readonly Exercise[]): Exercise[] {
  return exercises.filter(
    (exercise) =>
      planDay.muscles.includes(exercise.primaryMuscle) || (planDay.includeStretches === true && exercise.isStretch),
  );
}

export function groupByMuscle(planDay: PlanDay, exercises: Exercise[]): Array<[string, Exercise[]]> {
  const groups = new Map<string, Exercise[]>();
  for (const exercise of exercises) {
    const list = groups.get(exercise.primaryMuscle) ?? [];
    list.push(exercise);
    groups.set(exercise.primaryMuscle, list);
  }
  const remaining = [...groups.keys()].filter((key) => !planDay.muscles.includes(key)).sort();
  const orderedKeys = [...planDay.muscles, ...remaining];
  return orderedKeys.filter((key) => groups.has(key)).map((key) => [key, groups.get(key)!]);
}
