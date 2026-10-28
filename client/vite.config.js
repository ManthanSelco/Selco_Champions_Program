import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// One codebase, one package.json (repo root).
// `npm run dev`         → Express serves API + this app (via Vite middleware) on ONE port
// `npm run build`       → production build into client/dist, served by `npm start`
// `npm run build:demo`  → one self-contained HTML file that runs entirely in the
//                          browser (localStorage instead of the API) for quick previews.
export default defineConfig(({ mode }) => ({
  root: here,
  envDir: here,
  base: './',
  plugins: [react(), ...(mode === 'demo' ? [viteSingleFile()] : [])],
  resolve: { alias: { '@shared': path.resolve(here, '../shared') } },
  server: {
    fs: { allow: [path.resolve(here, '..')] },
  },
  css: { postcss: here },
  optimizeDeps: { entries: ['index.html'] },
  build: {
    outDir: path.resolve(here, mode === 'demo' ? 'dist-demo' : 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
  },
}));
