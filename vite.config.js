import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { rmSync } from 'node:fs';

const pages = ['index', 'all-vehicles', 'car-details', 'aboutus', 'services', 'reviews', 'sell-your-vehicle-sri-lanka', 'vehicle-sourcing-sri-lanka', 'vehicle-information-support', '404'];
export default defineConfig({
  plugins: [react(), {
    name: 'omit-retired-reference-media',
    apply: 'build',
    closeBundle() {
      const output = resolve(import.meta.dirname, 'dist');
      const retired = ['media/hero-film.mp4', 'media/hero-film-mobile.mp4', 'images/hero-film-poster.webp', 'images/conversation-couple.webp', 'images/conversation-driver.webp'];
      for (const file of retired) rmSync(resolve(output, file), { force: true });
    },
  }],
  build: {
    rollupOptions: { input: Object.fromEntries(pages.map(page => [page, resolve(import.meta.dirname, `${page}.html`)])) },
    target: 'es2020',
    sourcemap: false,
  },
});
