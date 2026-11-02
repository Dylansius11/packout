import { Build } from './sections/build';
import { Builders } from './sections/builders';
import { Checks } from './sections/checks';
import { Boundaries, Close } from './sections/close';
import { ExitMoves } from './sections/exit-moves';
import { Footer } from './sections/footer';
import { Hero } from './sections/hero';
import { LeftBehind } from './sections/left-behind';
import { SiteNav } from './sections/nav';
import { Numbers } from './sections/numbers';
import { Record } from './sections/record';
import { Resources } from './sections/resources';
import { RunStrip } from './sections/run-strip';
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
      <SiteNav />
      <main id="main">
        <Hero />
        <RunStrip />
        <LeftBehind />
        <ExitMoves />
        <Checks />
        <Numbers />
        <Record />
        <Succession />
        <Builders />
        <Resources />
        <Build />
        <Boundaries />
        <Close />
      </main>
      <Footer />
    </>
  );
}
