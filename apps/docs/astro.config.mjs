// @ts-check
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [
    starlight({
      title: 'botflare',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/pyyupsk/botflare' }],
    }),
  ],
});
