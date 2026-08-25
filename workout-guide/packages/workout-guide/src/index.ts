import manifest from '../manifest.json';

import type {
  AssetUrlOptions,
  Exercise,
  ExerciseFrame,
  ExerciseSearchFilters,
} from './types';

export type {
  AssetUrlOptions,
  Exercise,
  ExerciseAttribution,
  ExerciseFrame,
  ExerciseSearchFilters,
  ExerciseType,
} from './types';

export const exercises = manifest as Exercise[];

const exercisesById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
const exercisesBySlug = new Map(exercises.map((exercise) => [exercise.slug, exercise]));

export function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function getExercise(idOrSlug: string) {
  return exercisesById.get(idOrSlug) ?? exercisesBySlug.get(idOrSlug) ?? null;
}

function matchesFilter(value: string, filter?: string | readonly string[]) {
  if (filter === undefined) return true;
  const values = Array.isArray(filter) ? filter : [filter];
  return values.some((candidate) => normalizeSearchText(candidate) === normalizeSearchText(value));
}

export function searchExercises(query = '', filters: ExerciseSearchFilters = {}) {
  const normalizedQuery = normalizeSearchText(query);
  const tokens = normalizedQuery ? normalizedQuery.split(' ') : [];

  return exercises.filter((exercise) => {
    if (!matchesFilter(exercise.equipment, filters.equipment)) return false;
    if (!matchesFilter(exercise.primaryMuscle, filters.primaryMuscle)) return false;
    if (!matchesFilter(exercise.exerciseType, filters.exerciseType)) return false;
    if (filters.isStretch !== undefined && exercise.isStretch !== filters.isStretch) return false;

    if (tokens.length === 0) return true;
    const searchable = normalizeSearchText([
      exercise.name,
      exercise.equipment,
      exercise.primaryMuscle,
      ...exercise.secondaryMuscles,
    ].join(' '));
    return tokens.every((token) => searchable.includes(token));
  });
}

export function getAssetUrl(
  idOrSlug: string,
  frameIndex: ExerciseFrame['index'],
  options: AssetUrlOptions = {},
) {
  const exercise = getExercise(idOrSlug);
  if (!exercise) return null;

  const frame = exercise.frames.find((candidate) => candidate.index === frameIndex);
  if (!frame) return null;

  const version = options.version ?? '1.0.0';
  const baseUrl = options.baseUrl ?? `https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@${version}/`;
  return new URL(frame.path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}
