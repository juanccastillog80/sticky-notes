import type { ProfilerOnRenderCallback } from 'react';
import { render } from 'vitest-browser-react';
import { App } from '../src/App';
import { createNotesStore } from '../src/notes/notesReducer';
import { createUiStore } from '../src/ui/uiReducer';
import '../src/tokens.css';

/** Mounts the real App on fresh stores, with no persistence and no MSW. */
export async function renderApp({
  onNoteRender,
}: { onNoteRender?: ProfilerOnRenderCallback } = {}) {
  const stores = { notes: createNotesStore(), ui: createUiStore() };
  const screen = await render(<App stores={stores} {...(onNoteRender && { onNoteRender })} />);
  return { screen, stores };
}
