// @ts-check
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import expressiveCode from 'astro-expressive-code';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://pyyupsk.github.io',
  base: '/botflare',
  trailingSlash: 'always',
  integrations: [expressiveCode(), mdx(), sitemap()],
  vite: { plugins: [tailwindcss()] },
});
