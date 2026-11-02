import { PixelMark } from '@packout/brand';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useRef } from 'react';
import { chain, packoutSiteUrl, registryLookup, rpcHost } from '../config/env';
import { useFocusOnChange } from '../lib/focus';
import { Logo } from './logo';
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
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-10 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:shadow-raised"
      >
        Skip to content
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-4 px-5 sm:px-8 lg:px-14">
          <Link to="/" className="-mx-1 flex min-h-16 items-center rounded-md px-1">
            <Logo />
          </Link>
          <span
            className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3 py-1 text-xs font-medium text-muted-foreground"
            title="The network this workspace is anchored on"
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
            {chain.name}
          </span>
        </div>
      </header>
      <main
        id="main"
        ref={main}
        tabIndex={-1}
        className="mx-auto w-full max-w-[96rem] flex-1 px-5 py-10 outline-none sm:px-8 md:py-14 lg:px-14"
      >
        {registryLookup.ok ? null : (
          <Notice tone="danger" title="This build has no registry address" className="mb-6">
            {registryLookup.message}
          </Notice>
        )}
        <Outlet />
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[96rem] flex-col gap-1 px-5 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-14">
          <p>
            Vendor A stores only encrypted data. Restore checks against Portaldot via {rpcHost}.
          </p>
          <a
            href={packoutSiteUrl}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-sm font-medium text-foreground underline-offset-4 hover:underline sm:min-h-0"
          >
            <PixelMark size={12} />
            Exit-ready with Packout
          </a>
        </div>
      </footer>
    </div>
  );
}
