import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Evergreen browsers only: the polyfill would add bytes to the landing for nothing.
  build: { modulePreload: { polyfill: false } },
  server: { port: 5175 },
});
