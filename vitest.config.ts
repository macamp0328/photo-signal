import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // Include script tests and exclude Playwright tests from Vitest
    include: [
      'src/**/*.test.{ts,tsx}',
      'scripts/**/__tests__/**/*.test.{js,ts}',
      'cloudflare/**/*.test.{ts,tsx}',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/visual/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test/**',
        'src/vite-env.d.ts',
        'src/main.tsx',
      ],
      all: true,
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
    },
  },
});
