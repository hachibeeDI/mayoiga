import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // environment: 'happy-dom',  DO NOT USE IT
    environment: 'jsdom',
    setupFiles: ['./setup/vite-global-setup.js'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test-fixture.ts'],
      reporter: ['text', 'html'],
    },
  },
});
