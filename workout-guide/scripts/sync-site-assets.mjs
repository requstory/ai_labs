import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import sharp from 'sharp';

const projectRoot = resolve(dirname(new URL(import.meta.url).pathname), '..');
const packageRoot = join(projectRoot, 'packages', 'workout-guide');
const sitePublic = join(projectRoot, 'apps', 'site', 'public');
const targetFrames = join(sitePublic, 'frames');
const targetIcons = join(sitePublic, 'icons');

if (!targetFrames.startsWith(sitePublic)) throw new Error('Invalid site asset target.');
await rm(targetFrames, { recursive: true, force: true });
await mkdir(sitePublic, { recursive: true });
await cp(join(packageRoot, 'assets'), targetFrames, { recursive: true });

const dayTint = {
  monday: '#ff6b5b',
  tuesday: '#4ecdc4',
  wednesday: '#a78bfa',
  thursday: '#fbbf24',
  friday: '#6ee7b7',
};
const dayMuscles = {
  monday: ['Chest', 'Triceps'],
  tuesday: ['Back', 'Lats', 'Upper Back', 'Rear Delts', 'Biceps', 'Forearms'],
  wednesday: ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Adductors', 'Legs', 'Posterior Chain'],
  thursday: ['Shoulders', 'Core', 'Hips'],
  friday: ['Lower Back', 'Mobility'],
};
const tintForMuscle = (primaryMuscle) => {
  const day = Object.entries(dayMuscles).find(([, muscles]) => muscles.includes(primaryMuscle));
  return day ? dayTint[day[0]] : '#f4f4ef';
};

const manifest = JSON.parse(await readFile(join(packageRoot, 'manifest.json'), 'utf8'));
const featured = ['push-up', 'squat', 'deadlift'];
const vectorFrames = [];
for (const [index, slug] of featured.entries()) {
  const exercise = manifest.find((item) => item.slug === slug);
  if (!exercise) throw new Error(`Missing featured exercise: ${slug}`);
  const frame = await readFile(join(packageRoot, exercise.frames[0].path), 'utf8');
  const body = frame
    .match(/<svg[^>]*>([\s\S]*)<\/svg>/)?.[1]
    ?.replace(/fill="#fff"/g, `fill="${tintForMuscle(exercise.primaryMuscle)}"`);
  if (!body) throw new Error(`Invalid SVG frame: ${exercise.frames[0].path}`);
  vectorFrames.push(
    `<g transform="translate(${574 + index * 196} 218) scale(${190 / 512})">${body}</g>`,
  );
}

const background = Buffer.from(`
  <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="#101010"/>
    <rect x="548" y="94" width="622" height="442" rx="58" fill="#1a1a1a"/>
    <text x="72" y="220" fill="#f4f4ef" font-family="ui-rounded, system-ui" font-size="74" font-weight="700">FitSplit.</text>
    <text x="76" y="292" fill="#aaa9a4" font-family="ui-rounded, system-ui" font-size="30">Your 5-day fitness plan, illustrated.</text>
    <text x="76" y="502" fill="#aaa9a4" font-family="ui-rounded, system-ui" font-size="22">302 exercises · free · works offline</text>
    ${vectorFrames.join('\n    ')}
  </svg>
`);

await writeFile(join(sitePublic, 'og.svg'), background);
await sharp(background)
  .png({ quality: 100, effort: 10 })
  .toFile(join(sitePublic, 'og.png'));

await mkdir(targetIcons, { recursive: true });
const iconSource = await readFile(join(sitePublic, 'favicon.svg'));
await Promise.all([
  sharp(iconSource).resize(192, 192).png().toFile(join(targetIcons, 'icon-192.png')),
  sharp(iconSource).resize(512, 512).png().toFile(join(targetIcons, 'icon-512.png')),
  sharp(iconSource).resize(180, 180).flatten({ background: '#101010' }).png().toFile(join(targetIcons, 'apple-touch-icon.png')),
]);

// Coach (personal 24-week plan) icons: a teal goblet squat on FitSplit black.
const coachIcons = join(sitePublic, 'coach', 'icons');
await mkdir(coachIcons, { recursive: true });
const gobletFrame = await readFile(join(packageRoot, 'assets', 'goblet-squat', 'frame-2.svg'), 'utf8');
const gobletBody = gobletFrame.match(/<svg[^>]*>([\s\S]*)<\/svg>/)?.[1]?.replace(/fill="#fff"/g, 'fill="#4ecdc4"');
if (!gobletBody) throw new Error('Invalid SVG frame for the Coach icon.');
const coachIcon = Buffer.from(
  `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><rect width="1024" height="1024" fill="#101010"/><g transform="translate(212 196) scale(${600 / 512})">${gobletBody}</g></svg>`,
);
await Promise.all([
  sharp(coachIcon).resize(192, 192).png().toFile(join(coachIcons, 'icon-192.png')),
  sharp(coachIcon).resize(512, 512).png().toFile(join(coachIcons, 'icon-512.png')),
  sharp(coachIcon).resize(180, 180).png().toFile(join(coachIcons, 'apple-touch-icon.png')),
]);

// Every frame Coach shows, so its sessions work offline from the first visit.
const coachSource = await readFile(join(projectRoot, 'apps', 'site', 'src', 'coach', 'plan.ts'), 'utf8');
const coachSlugs = [...new Set([...coachSource.matchAll(/slug: '([a-z0-9-]+)'|ex\('([a-z0-9-]+)'|icon: '([a-z0-9-]+)'/g)].map((m) => m[1] ?? m[2] ?? m[3]))];
for (const slug of coachSlugs) {
  if (!manifest.some((item) => item.slug === slug)) throw new Error(`Coach uses an unknown exercise: ${slug}`);
}
const coachShell = [
  './coach/',
  './coach/manifest.webmanifest',
  './coach/icons/icon-192.png',
  './coach/icons/apple-touch-icon.png',
  ...coachSlugs.flatMap((slug) => [1, 2, 3].map((i) => `./frames/${slug}/frame-${i}.svg`)),
];

const swVersion = `fitsplit-${Date.now()}`;
const swSource = `const CACHE_VERSION = ${JSON.stringify(swVersion)};
const APP_SHELL = [
  './',
  './plan/',
  './plan/monday/',
  './plan/tuesday/',
  './plan/wednesday/',
  './plan/thursday/',
  './plan/friday/',
  './exercises/',
  './manifest.webmanifest',
  './favicon.svg',
  ...${JSON.stringify(coachShell)},
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const scopeUrl = new URL(self.registration.scope);
      const cache = await caches.open(CACHE_VERSION);
      const urls = APP_SHELL.map((path) => new URL(path, scopeUrl).toString());
      try {
        await cache.addAll(urls);
      } catch {
        // A missing shell URL shouldn't block installation of what we could cache.
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations (the HTML documents themselves) always prefer the network so a
  // deploy is visible on the next load; the cache is only a fallback when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;
          const fallback = await cache.match(new URL('./', self.registration.scope).toString());
          if (fallback) return fallback;
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })(),
    );
    return;
  }

  // Everything else (hashed JS/CSS bundles, SVG frames, audio, icons) is safe to
  // serve stale-while-revalidate: it either never changes or is content-hashed.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => undefined);

      if (cached) return cached;
      const response = await network;
      return response ?? new Response('Offline', { status: 503, statusText: 'Offline' });
    })(),
  );
});
`;

await writeFile(join(sitePublic, 'sw.js'), swSource);

console.log('Synced 906 site frames, generated social artwork, PWA icons, and service worker.');
