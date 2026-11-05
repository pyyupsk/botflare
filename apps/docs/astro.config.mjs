// @ts-check
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';

export default defineConfig({
  site: 'https://botflare.fasu.dev',
  integrations: [
    starlight({
      title: 'botflare',
      plugins: [
        starlightTypeDoc({
          entryPoints: [
            '../../packages/botflare/src/index.ts',
            '../../packages/botflare/src/gateway.ts',
          ],
          tsconfig: '../../packages/botflare/tsconfig.json',
          sidebar: { label: 'API reference', collapsed: true },
        }),
      ],
      logo: { src: './src/assets/logo.svg' },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/pyyupsk/botflare' }],
      components: { Header: './src/components/layout/site-header.astro' },
      sidebar: [
        { label: 'Guides', items: [{ autogenerate: { directory: 'guides' } }] },
        typeDocSidebarGroup,
        { label: 'Examples', link: 'https://github.com/pyyupsk/botflare/tree/main/examples' },
      ],
      expressiveCode: {
        themes: ['gruvbox-dark-medium', 'gruvbox-light-medium'],
        styleOverrides: {
          borderColor: 'var(--sl-color-gray-5)',
          borderRadius: '0',
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
        '@fontsource-variable/archivo/wdth.css',
        '@fontsource/ibm-plex-sans/400.css',
        '@fontsource/ibm-plex-sans/500.css',
        '@fontsource/ibm-plex-sans/600.css',
        '@fontsource/ibm-plex-mono/400.css',
        '@fontsource/ibm-plex-mono/500.css',
        './src/styles/global.css',
      ],
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
