import { Link, Outlet } from '@tanstack/react-router';
import { chain, registryLookup, rpcHost } from '../config/env';
import { Notice } from './notice';

export function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-10 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tracking-tight">Vendor A</span>
            <span className="text-sm text-muted-foreground">Issue journal</span>
          </Link>
          <span className="rounded-sm border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {chain.name}
          </span>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {registryLookup.ok ? null : (
          <Notice tone="danger" title="This build has no registry address" className="mb-6">
            {registryLookup.message}
          </Notice>
        )}
        <Outlet />
      </main>
      <footer className="border-t border-border">
        <p className="mx-auto max-w-5xl px-4 py-4 text-xs text-muted-foreground sm:px-6">
          Vendor A stores only encrypted data. Restore checks against Portaldot via {rpcHost}.
        </p>
      </footer>
    </div>
  );
}
