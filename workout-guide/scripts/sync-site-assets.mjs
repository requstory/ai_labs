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

console.log('Synced 906 site frames, generated social artwork, and generated PWA icons.');
