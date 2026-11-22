import { expectTypeOf, it } from 'vitest';
import { apiBaseUrl } from './apiBaseUrl';

it('takes and returns a URL string', () => {
  expectTypeOf(apiBaseUrl).parameter(0).toEqualTypeOf<string>();
  expectTypeOf(apiBaseUrl).returns.toEqualTypeOf<string>();
});
