# Workout Guide

An open exercise illustration library containing 302 exercises, three consistent frames per exercise, a typed framework-neutral npm package, and a searchable static gallery.

The original pose artwork used by this project comes from [Everkinetic](https://github.com/everkinetic/data) under CC BY-SA 4.0. [Bryl Lim](https://bryllim.com) expanded upon that foundation with additional exercises and animation frames, normalized assets, structured metadata, package APIs, and the documentation gallery.

[Browse the gallery](https://bryllim.github.io/workout-guide/) · [Read the guide](https://bryllim.github.io/workout-guide/guide/) · [Open the package on npm](https://www.npmjs.com/package/@bryllim/workout-guide)

## Install

```sh
npm install @bryllim/workout-guide
```

```ts
import { getExercise, searchExercises, getAssetUrl } from '@bryllim/workout-guide';

const pushUp = getExercise('push-up');
const bodyweightChest = searchExercises('chest', { equipment: 'bodyweight' });
const firstFrame = getAssetUrl('push-up', 1);
```

Direct asset imports and literal React Native `require()` examples are documented in the [integration guide](https://bryllim.github.io/workout-guide/guide/).

## Repository

This npm-workspace monorepo contains:

- `packages/workout-guide`: package API, canonical manifest, and all 906 transparent 512 × 512 SVGs, with PNG sources retained for compatibility.
- `apps/site`: Astro landing page, gallery, detail pages, and guide.
- `scripts`: deterministic catalog import and validation utilities.
- `apps/site/src/coach` + `apps/site/src/pages/coach`: **Coach**, a personal 24-week plan app at `/coach/` (see below).

### Coach

A Home Screen web app for a 24-week run/walk and strength plan: today's session, animated exercises, a set tracker with rest timer, jog/walk and interval timers with sound cues that play over your music, Monday weigh-ins (with optional waist and an Apple Health import via a Shortcut), charts against target, a Sunday summary, pause for illness or holiday, a rest-day mobility routine, calendar reminders (.ics), and backup/restore. All personal data stays on the device; starting numbers are entered on first launch.

- Plan data and checklist text: `src/coach/plan.ts` (tests in `apps/site/test`). Run `npm test -w workout-guide-site`; set `COACH_CHECKLIST=/path/to/Daily_checklist.md` to compare every generated row with the checklist.
- Preview another date: open `/coach/?today=2026-11-10` (`?today=clear` resets).

Run the project locally:

```sh
npm install
npm run build
npm run dev
```

> This copy is mirrored into the [`ai_labs`](https://github.com/requstory/ai_labs) repository to publish via GitHub Pages at `https://requstory.github.io/ai_labs/`. Upstream source: [bryllim/workout-guide](https://github.com/bryllim/workout-guide).

The normalized catalog and all package assets are checked into the repository. Maintainers can regenerate them from a compatible source export with `npm run catalog:import -- /path/to/source`.

## Licensing

Code and documentation are available under the [MIT License](./LICENSE). Visual assets are licensed under [CC BY-SA 4.0](./LICENSE-ASSETS). See [LICENSES.md](./LICENSES.md) and [ATTRIBUTION.md](./ATTRIBUTION.md) for the complete breakdown, including Everkinetic-derived poses.

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and the [Code of Conduct](./CODE_OF_CONDUCT.md).
