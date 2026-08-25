import { weeklyPlan } from './weeklyPlan';

const dayTint: Record<string, string> = {
  monday: '#ff6b5b',
  tuesday: '#4ecdc4',
  wednesday: '#a78bfa',
  thursday: '#fbbf24',
  friday: '#6ee7b7',
};

const fallbackTint = '#f4f4ef';

export function muscleColor(primaryMuscle: string): string {
  const day = weeklyPlan.find((planDay) => planDay.muscles.includes(primaryMuscle));
  return day ? dayTint[day.slug] : fallbackTint;
}

export function planDayColor(slug: string): string {
  return dayTint[slug] ?? fallbackTint;
}
