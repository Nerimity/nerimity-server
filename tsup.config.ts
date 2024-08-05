import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/worker.ts'],
  splitting: false,
  sourcemap: true,
  clean: true,
  format: ['esm'],
});
