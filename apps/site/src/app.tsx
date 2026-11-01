import { Hero } from './sections/hero';

export function App() {
  return (
    <>
      <a
        href="#main"
        className="baseline sr-only bg-signal px-4 py-3 text-[12px] text-signal-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>
      <Hero />
      <main id="main" />
    </>
  );
}
