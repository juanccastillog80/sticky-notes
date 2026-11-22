/**
 * The REST API's base URL, derived from Vite's `BASE_URL` (which always ends
 * in `/`). Keeping the API under the base path keeps it within this project's
 * part of the GitHub Pages origin, which other sites share. The service worker
 * doesn't need this: its scope limits the pages it controls, not their fetches.
 */
export function apiBaseUrl(viteBase: string): string {
  return `${viteBase}api`;
}
