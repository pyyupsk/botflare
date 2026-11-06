// @ts-check
import { defineEcConfig } from 'astro-expressive-code';

export default defineEcConfig({
  themes: ['vitesse-dark', 'vitesse-light'],
  themeCssSelector: (theme) => `[data-theme='${theme.type}']`,
  useDarkModeMediaQuery: false,
  styleOverrides: {
    borderRadius: '0.75rem',
    borderColor: 'var(--line)',
    codeBackground: 'var(--surface)',
    codeFontFamily: 'var(--font-mono)',
    uiFontFamily: 'var(--font-sans)',
    frames: {
      editorTabBarBackground: 'var(--surface)',
      editorActiveTabBackground: 'var(--surface)',
      editorActiveTabIndicatorTopColor: 'transparent',
      editorActiveTabIndicatorBottomColor: 'var(--accent)',
      terminalTitlebarBackground: 'var(--surface)',
      terminalBackground: 'var(--surface)',
      frameBoxShadowCssValue: 'none',
    },
  },
});
