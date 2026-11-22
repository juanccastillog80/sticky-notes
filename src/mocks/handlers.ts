import { http, HttpResponse } from 'msw';

/** MSW handlers for the mocked REST API rooted at `apiBase`. */
export function createHandlers(apiBase: string) {
  return [http.get(`${apiBase}/notes`, () => HttpResponse.json([]))];
}
