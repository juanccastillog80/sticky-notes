/**
 * The REST API's base URL, derived from Vite's `BASE_URL` (which always ends
 * in `/`). Keeping the API under the base path keeps it inside the mock
 * service worker's scope on GitHub Pages.
 */
export function apiBaseUrl(viteBase: string): string {
  return `${viteBase}api`;
}
