import type { ProfilerOnRenderCallback } from 'react';
import { render } from 'vitest-browser-react';
import { App } from '../src/App';
import { createStores } from '../src/StoresContext';
import '../src/tokens.css';

/** Mounts the real App on fresh stores, with no Local copy. */
export async function renderApp({
  onNoteRender,
}: { onNoteRender?: ProfilerOnRenderCallback } = {}) {
  const stores = createStores();
  const screen = await render(<App stores={stores} {...(onNoteRender && { onNoteRender })} />);
  return { screen, stores };
}
