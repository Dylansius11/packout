import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import './styles.css';

// The pitch deck is its own chunk: the landing never downloads it.
const Deck = lazy(() => import('./deck/deck').then((module) => ({ default: module.Deck })));
const onDeck = /^\/deck\/?$/.test(location.pathname);

const container = document.getElementById('root');
document.documentElement.classList.add('js');

if (!container) throw new Error('Missing #root element in index.html.');

createRoot(container).render(
  <StrictMode>
    {onDeck ? (
      <Suspense fallback={null}>
        <Deck />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
