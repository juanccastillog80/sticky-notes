import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { mouse } from './test/browserCommands.ts';

// Pure-core folders held to the coverage gate (spec: Coverage and gates).
// Components and the composition root are covered by browser tests instead.
const PURE_CORE = [
  'src/notes/**',
  'src/ui/**',
  'src/drag/**',
  'src/persistence/**',
  'src/geometry.ts',
];

// Which browsers the browser project runs in: a comma-separated BROWSERS list,
// or Chromium and Firefox by default. `chrome` and `msedge` are the installed
// branded builds, launched through Playwright's Chromium with a channel.
const BROWSER_NAMES = ['chromium', 'firefox', 'chrome', 'msedge'] as const;
type BrowserName = (typeof BROWSER_NAMES)[number];

function isBrowserName(name: string): name is BrowserName {
  return (BROWSER_NAMES as readonly string[]).includes(name);
}

function browserInstance(name: BrowserName) {
  if (name === 'chromium' || name === 'firefox') return { browser: name };
  return {
    browser: 'chromium' as const,
    name,
    provider: playwright({ launchOptions: { channel: name } }),
  };
}

function browserInstances(list = 'chromium,firefox') {
  return list.split(',').map((raw) => {
    const name = raw.trim();
    if (!isBrowserName(name)) {
      throw new Error(`BROWSERS: unknown browser "${name}" (expected ${BROWSER_NAMES.join(', ')})`);
    }
    return browserInstance(name);
  });
}

export default defineConfig({
  // The same base for every command, dev included, so the service-worker
  // scope and URLs match the GitHub Pages deployment.
  base: '/sticky-notes/',
  plugins: [react()],
  test: {
    coverage: {
      provider: 'v8',
      include: PURE_CORE,
      exclude: [
        '**/*.test.ts',
        '**/*.test-d.ts',
        '**/*.browser.test.tsx',
        // DOM wiring with no decisions in it, covered by the browser tests.
        'src/drag/useDrag.ts',
      ],
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
            instances: browserInstances(process.env.BROWSERS),
            commands: { mouse },
          },
        },
      },
    ],
  },
});
