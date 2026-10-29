import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: { target: 'es2022' },
  server: { strictPort: true },
  preview: { strictPort: true },
  test: { environment: 'jsdom', restoreMocks: true },
});
