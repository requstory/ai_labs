export type ExerciseType =
  | 'weight_reps'
  | 'bodyweight_reps'
  | 'duration'
  | 'distance_duration'
  | 'assisted_bodyweight';

export type ExerciseFrame = {
  index: 1 | 2 | 3;
  path: string;
  width: 512;
  height: 512;
  format: 'svg';
  attribution: ExerciseAttribution;
};

export type ExerciseAttribution = {
  creator: 'Bryl Lim';
  creatorUrl: 'https://bryllim.com';
  license: 'CC BY-SA 4.0';
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/';
  source?: {
    name: 'Everkinetic';
    url: string;
    license: 'CC BY-SA 4.0';
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/';
    changes: string;
  };
};

export type Exercise = {
  id: string;
  slug: string;
  name: string;
  exerciseType: ExerciseType;
  equipment: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  isStretch: boolean;
  frames: [ExerciseFrame, ExerciseFrame, ExerciseFrame];
  attribution: ExerciseAttribution;
};

export type ExerciseSearchFilters = {
  equipment?: string | readonly string[];
  primaryMuscle?: string | readonly string[];
  exerciseType?: ExerciseType | readonly ExerciseType[];
  isStretch?: boolean;
};

export type AssetUrlOptions = {
  baseUrl?: string;
  version?: string;
};
