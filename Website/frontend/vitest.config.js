import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vitest runs the jsdom component/unit suite. Kept separate from vite.config.js
// so `vite build` stays free of test-only settings.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    css: false,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
});