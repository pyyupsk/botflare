// @ts-check
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import expressiveCode from 'astro-expressive-code';
import { defineConfig, fontProviders } from 'astro/config';

export default defineConfig({
  site: 'https://pyyupsk.github.io',
  base: '/botflare',
  trailingSlash: 'always',
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Bricolage Grotesque',
      cssVariable: '--font-bricolage',
      weights: ['200 800'],
      subsets: ['latin'],
      fallbacks: ['sans-serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Spline Sans Mono',
      cssVariable: '--font-spline',
      weights: ['300 700'],
      subsets: ['latin'],
      fallbacks: ['monospace'],
    },
  ],
  integrations: [expressiveCode(), mdx(), sitemap()],
  vite: { plugins: [tailwindcss()] },
});
