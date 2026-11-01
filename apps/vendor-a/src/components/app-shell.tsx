import { PixelMark } from '@packout/brand';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useRef } from 'react';
import { chain, packoutSiteUrl, registryLookup, rpcHost } from '../config/env';
import { useFocusOnChange } from '../lib/focus';
import { Notice } from './notice';

export function AppShell() {
  const main = useRef<HTMLElement>(null);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // A new page replaces the control the user just used: start them at the top of it.
  useFocusOnChange(pathname, main);
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
          <Link to="/" className="flex items-center gap-2.5">
            <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
              <rect width="24" height="24" rx="6" className="fill-primary" />
              <path
                d="M7 8h10M7 12h10M7 16h6"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="flex items-baseline gap-2">
              <span className="text-lg font-semibold tracking-tight">Vendor A</span>
              <span className="text-sm text-muted-foreground">Issue journal</span>
            </span>
          </Link>
          <span className="rounded-sm border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {chain.name}
          </span>
        </div>
      </header>
      <main
        id="main"
        ref={main}
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 outline-none sm:px-6"
      >
        {registryLookup.ok ? null : (
          <Notice tone="danger" title="This build has no registry address" className="mb-6">
            {registryLookup.message}
          </Notice>
        )}
        <Outlet />
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            Vendor A stores only encrypted data. Restore checks against Portaldot via {rpcHost}.
          </p>
          <a
            href={packoutSiteUrl}
            className="inline-flex items-center gap-1.5 rounded-sm text-foreground hover:underline"
          >
            <PixelMark size={12} />
            Exit-ready with Packout
          </a>
        </div>
      </footer>
    </div>
  );
}
