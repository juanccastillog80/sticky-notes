import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// Pure-core folders held to the coverage gate (spec: Coverage and gates).
// Components and the composition root are covered by browser tests instead.
const PURE_CORE = [
  'src/store/**',
  'src/notes/**',
  'src/ui/**',
  'src/gesture/**',
  'src/persistence/**',
  'src/geometry.ts',
  'src/commands.ts',
];

export default defineConfig({
  // The same base for every command, dev included, so the service-worker
  // scope and URLs match the GitHub Pages deployment.
  base: '/sticky-notes/',
  plugins: [react()],
  test: {
    coverage: {
      provider: 'v8',
      include: PURE_CORE,
      exclude: ['**/*.test.ts', '**/*.test-d.ts', '**/*.browser.test.tsx'],
      thresholds: { lines: 90, branches: 90 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts', 'docs/walkthroughs/*.test.js'],
          typecheck: {
            enabled: true,
            include: ['src/**/*.test-d.ts'],
            tsconfig: './tsconfig.app.json',
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.tsx'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }, { browser: 'firefox' }],
          },
        },
      },
    ],
  },
});
