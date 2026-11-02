import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import './styles.css';

const container = document.getElementById('root');
document.documentElement.classList.add('js');

if (!container) throw new Error('Missing #root element in index.html.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
