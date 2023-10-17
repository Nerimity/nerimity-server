import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/common/ServerEventNames.ts', 'src/common/ClientEventNames.ts'],
  splitting: false,
  sourcemap: true,
  clean: true,
  format: ['esm'],
})