import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://requstory.github.io',
  base: '/ai_labs',
  integrations: [sitemap()],
  output: 'static',
  trailingSlash: 'always',
});
