import { describe, expect, it } from 'vitest';

import { exercises, getAssetUrl, getExercise, searchExercises } from '../src/index';

describe('exercise catalog', () => {
  it('contains 302 unique exercises with three ordered frames', () => {
    expect(exercises).toHaveLength(302);
    expect(new Set(exercises.map((exercise) => exercise.id)).size).toBe(302);
    expect(new Set(exercises.map((exercise) => exercise.slug)).size).toBe(302);
    for (const exercise of exercises) {
      expect(exercise.frames.map((frame) => frame.index)).toEqual([1, 2, 3]);
      expect(exercise.frames.every((frame) => frame.attribution.creator === 'Bryl Lim')).toBe(true);
    }
  });

  it('looks up exercises by id or slug and returns null for missing values', () => {
    expect(getExercise('exercise-push-up')?.name).toBe('Push-up');
    expect(getExercise('push-up')?.id).toBe('exercise-push-up');
    expect(getExercise('missing')).toBeNull();
  });

  it('searches across names, equipment, and muscles', () => {
    expect(searchExercises('incline dumbbell').some((exercise) => exercise.slug === 'incline-dumbbell-press')).toBe(true);
    expect(searchExercises('resistance band glutes').length).toBeGreaterThan(0);
    expect(searchExercises('upper back').length).toBeGreaterThan(0);
  });

  it('combines search and structured filters', () => {
    const results = searchExercises('press', { equipment: 'Dumbbell', primaryMuscle: 'Shoulders' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((exercise) => exercise.equipment === 'Dumbbell')).toBe(true);
    expect(searchExercises('', { isStretch: true }).every((exercise) => exercise.isStretch)).toBe(true);
  });

  it('builds CDN asset URLs and handles missing exercises', () => {
    expect(getAssetUrl('push-up', 2)).toBe(
      'https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/push-up/frame-2.svg',
    );
    expect(getAssetUrl('missing', 1)).toBeNull();
  });
});
