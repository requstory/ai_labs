# @bryllim/workout-guide

Framework-neutral metadata and 906 exercise frames. The original pose artwork
comes from [Everkinetic](https://github.com/everkinetic/data) under CC BY-SA
4.0 and was expanded upon by [Bryl Lim](https://bryllim.com) with additional
exercises, animation frames, normalized assets, metadata, and package APIs.

```sh
npm install @bryllim/workout-guide
```

```ts
import { getExercise, searchExercises } from '@bryllim/workout-guide';

const pushUp = getExercise('push-up');
const dumbbellChest = searchExercises('chest', { equipment: 'Dumbbell' });
```

Visit the [integration guide](https://bryllim.github.io/workout-guide/guide/)
for local imports, CDN URLs, and Expo examples.

Code is MIT licensed. Visual assets are CC BY-SA 4.0; see `LICENSES.md` and
`ATTRIBUTION.md`.
