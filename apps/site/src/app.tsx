import { Builders } from './sections/builders';
import { Checks } from './sections/checks';
import { Boundaries, Close, Footer } from './sections/close';
import { ExitMoves } from './sections/exit-moves';
import { Hero } from './sections/hero';
import { LeftBehind } from './sections/left-behind';
import { Record } from './sections/record';
import { Succession } from './sections/succession';

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
      <main id="main">
        <LeftBehind />
        <ExitMoves />
        <Checks />
        <Record />
        <Succession />
        <Builders />
        <Boundaries />
        <Close />
      </main>
      <Footer />
    </>
  );
}
