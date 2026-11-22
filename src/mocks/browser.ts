import { setupWorker } from 'msw/browser';
import { createHandlers } from './handlers';

/**
 * Registers the mock service worker from the Vite base path, scoped to it, so
 * it works the same in dev and on GitHub Pages.
 */
export async function startMockWorker({
  viteBase,
  apiBase,
}: {
  viteBase: string;
  apiBase: string;
}): Promise<void> {
  const worker = setupWorker(...createHandlers(apiBase));
  await worker.start({
    serviceWorker: {
      url: `${viteBase}mockServiceWorker.js`,
      options: { scope: viteBase },
    },
    // MSW 3's name for v2's `onUnhandledRequest`.
    onUnhandledFrame: 'bypass',
  });
}
