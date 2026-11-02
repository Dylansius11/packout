// Build one static app for Portaldot testnet and deploy it to its Vercel project.
// Usage (repo root, after `npx vercel login`): node deploy/web/deploy.mjs site|restore|vendor-a
//
// Why a CLI deploy and not Git auto-deploy: these Vercel projects must NOT stay connected to the
// GitHub repo. A connected project redeploys on every push from the repo root, which has no build
// output, and moves the production alias to a 404 page (seen on 2026-11-02). This script
// disconnects Git on every run so a push can never replace a working deployment.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const apiUrl = process.env.PACKOUT_API_URL ?? 'https://packout-api.43.129.38.115.sslip.io';
const siteUrl = process.env.PACKOUT_SITE_URL ?? 'https://packout-site.vercel.app';
const vendorUrl = process.env.PACKOUT_VENDOR_URL ?? 'https://packout-vendor-a.vercel.app';
const restoreUrl = process.env.PACKOUT_RESTORE_URL ?? 'https://packout-restore.vercel.app';

const apps = {
  site: {
    pkg: '@packout/site',
    dir: 'apps/site',
    project: 'packout-site',
    env: { VITE_VENDOR_APP_URL: vendorUrl, VITE_RESTORE_APP_URL: restoreUrl },
  },
  restore: {
    pkg: '@packout/client-b',
    dir: 'apps/client-b',
    project: 'packout-restore',
    env: { VITE_PACKOUT_NETWORK: 'portaldotTestnet' },
  },
  'vendor-a': {
    pkg: '@packout/vendor-a',
    dir: 'apps/vendor-a',
    project: 'packout-vendor-a',
    env: {
      VITE_PACKOUT_NETWORK: 'portaldotTestnet',
      VITE_VENDOR_API_URL: apiUrl,
      VITE_PACKOUT_SITE_URL: siteUrl,
    },
  },
};

const app = apps[process.argv[2]];
if (!app) {
  console.error('usage: node deploy/web/deploy.mjs site|restore|vendor-a');
  process.exit(2);
}

function run(command, cwd, { fatal = true } = {}) {
  console.log(`$ ${command}`);
  const result = spawnSync(command, {
    cwd,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, ...app.env },
  });
  if (result.status !== 0 && fatal) process.exit(result.status ?? 1);
}

run(`pnpm --filter ${app.pkg} exec vite build`, process.cwd());
const dist = join(process.cwd(), app.dir, 'dist');
run(`npx vercel link --yes --project ${app.project}`, dist);
run('npx vercel git disconnect --yes', dist, { fatal: false });
run('npx vercel deploy --prod --yes', dist);

const response = await fetch(`https://${app.project}.vercel.app/`);
console.log(`${app.project} -> HTTP ${response.status}`);
if (!response.ok) process.exit(1);
