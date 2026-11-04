import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts', gateway: 'src/gateway.ts', cli: 'cli/index.ts' },
  format: ['esm'],
  deps: { neverBundle: [/^cloudflare:/] },
  dts: true,
  clean: true,
  sourcemap: true,
  publint: { level: 'suggestion' },
  attw: { profile: 'esm-only', level: 'error' },
});
