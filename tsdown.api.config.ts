import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist/api',
  sourcemap: true,
  clean: true,
  format: ['esm'],
});
