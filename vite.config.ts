import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` emits a single self-contained dist/index.html
// (fonts + code inlined) that runs by double-clicking it, no server needed.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  server: { port: 5188, open: false },
  build: { target: 'es2022', assetsInlineLimit: 100_000_000 },
});
