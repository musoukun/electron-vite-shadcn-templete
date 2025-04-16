import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main',
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload',
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
      },
    },
    build: {
      outDir: 'dist/renderer',
    },
  },
});
