import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // environment: 'happy-dom',  DO NOT USE IT
    environment: 'jsdom',
    setupFiles: ['./setup/vite-global-setup.js'],
  },
})