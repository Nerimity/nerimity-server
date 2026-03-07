import { defineConfig, type UserConfig } from 'tsdown';

type Plugin = UserConfig['plugins'];

const exclusions = (): Plugin => {
  return {
    name: 'exclude-api-routes',
    transform: (code: string) => {
      const transformed = code.replace(/app\.use\(\s*['"`]\/api['"`][\s\S]*?\);\n?/g, '');

      return transformed;
    },
  };
};

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist/ws',
  sourcemap: true,
  clean: true,
  format: ['esm'],
  plugins: [exclusions()],
});
