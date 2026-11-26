// Composition root: the only module that wires the mocks (and, later, persistence).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { apiBaseUrl } from './persistence/apiBaseUrl';
import { createStores } from './StoresContext';
import './tokens.css';

const stores = createStores();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element');

createRoot(rootElement).render(
  <StrictMode>
    <App stores={stores} />
  </StrictMode>,
);

// Rendering never waits on the network. The worker must be running before
// the first request, so the GET is issued only once it has started. MSW is
// loaded as its own chunk so it never delays the first paint.
const { startMockWorker } = await import('./mocks/browser');
const viteBase = import.meta.env.BASE_URL;
const apiBase = apiBaseUrl(viteBase);
await startMockWorker({ viteBase, apiBase });
const response = await fetch(`${apiBase}/notes`);
console.info('GET /notes →', response.status, await response.json());
