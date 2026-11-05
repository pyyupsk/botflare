// @ts-check
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [
    starlight({
      title: 'botflare',
      logo: { src: './src/assets/logo.svg' },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/pyyupsk/botflare' }],
      sidebar: [{ label: 'Guides', items: [{ autogenerate: { directory: 'guides' } }] }],
      customCss: [
        '@fontsource-variable/geist',
        '@fontsource-variable/geist-mono',
        './src/styles/theme.css',
      ],
    }),
  ],
});
