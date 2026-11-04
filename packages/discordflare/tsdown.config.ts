import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts', cli: 'cli/index.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  publint: { level: 'suggestion' },
  attw: { profile: 'esm-only', level: 'error' },
});
