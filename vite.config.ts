import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Keep even small math fonts as files: font-src 'self' excludes data URLs.
  build: { target: 'es2022', assetsInlineLimit: 0 },
  server: { strictPort: true },
  preview: { strictPort: true },
  test: { environment: 'jsdom', restoreMocks: true },
});
