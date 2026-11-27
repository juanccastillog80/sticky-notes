// Composition root: the only module that wires in the Local copy.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { readLocalCopy, saveLocalCopy } from './persistence/localCopy';
import { createStores } from './StoresContext';
import './tokens.css';

const stores = createStores();

// The Local copy is loaded before the first render, so a reload never flashes
// an empty Board. Saving starts after the load, so loading never writes.
const storage = localStorageIfAllowed();
if (storage) {
  stores.notes.getState().load(readLocalCopy(storage));
  const saving = saveLocalCopy(stores.notes, {
    storage,
    timers: {
      setTimeout: (callback, ms) => window.setTimeout(callback, ms),
      clearTimeout: (id) => {
        window.clearTimeout(id);
      },
    },
  });
  // `pagehide`, not `beforeunload`: it also fires when the tab is closed or
  // the page goes into the back/forward cache, and never blocks navigation.
  // Ending Editing first saves its Draft text, so the flush writes it.
  window.addEventListener('pagehide', () => {
    stores.ui.getState().pageHidden();
    saving.flush();
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element');

createRoot(rootElement).render(
  <StrictMode>
    <App stores={stores} />
  </StrictMode>,
);

/** `window.localStorage` throws when the browser blocks site data. The app then keeps Notes in memory only. */
function localStorageIfAllowed(): Storage | null {
  try {
    return window.localStorage;
  } catch (error) {
    console.warn('localStorage is blocked: Notes will not survive a reload.', error);
    return null;
  }
}
