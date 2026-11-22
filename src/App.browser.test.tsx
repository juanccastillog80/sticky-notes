import { expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { App } from './App';

it('shows the Sticky Notes placeholder page', async () => {
  const screen = await render(<App />);

  await expect.element(screen.getByRole('heading', { name: 'Sticky Notes' })).toBeVisible();
});
