// @ts-check
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [
    starlight({
      title: 'botflare',
      logo: { src: './src/assets/logo.svg' },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/pyyupsk/botflare' }],
      sidebar: [{ label: 'Guides', items: [{ autogenerate: { directory: 'guides' } }] }],
      expressiveCode: {
        themes: ['gruvbox-dark-medium', 'gruvbox-light-medium'],
        styleOverrides: {
          borderColor: 'var(--sl-color-gray-5)',
          codeBackground: 'var(--sl-color-gray-6)',
          frames: {
            editorTabBarBackground: 'var(--sl-color-black)',
            editorActiveTabBackground: 'var(--sl-color-gray-6)',
            editorActiveTabIndicatorTopColor: 'var(--sl-color-accent)',
            editorActiveTabIndicatorBottomColor: 'transparent',
            terminalTitlebarBackground: 'var(--sl-color-black)',
            terminalBackground: 'var(--sl-color-gray-6)',
          },
        },
      },
      customCss: [
        '@fontsource-variable/geist',
        '@fontsource-variable/geist-mono',
        './src/styles/global.css',
      ],
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
