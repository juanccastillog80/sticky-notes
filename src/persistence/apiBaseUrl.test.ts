import { describe, expect, it } from 'vitest';
import { apiBaseUrl } from './apiBaseUrl';

describe('apiBaseUrl', () => {
  it('puts the API under the GitHub Pages base path, inside the service worker scope', () => {
    expect(apiBaseUrl('/sticky-notes/')).toBe('/sticky-notes/api');
  });

  it('puts the API at /api when the app is served from the root', () => {
    expect(apiBaseUrl('/')).toBe('/api');
  });
});
