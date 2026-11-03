# Deploying Vendor A's API on the shared VPS

One container runs `apps/vendor-api` as a single bundled file. It publishes no port: the VPS's existing Caddy (`vps-caddy-1`, network `vps_annona`) terminates TLS and reaches it by name.

| Thing | Value |
| --- | --- |
| Public URL | `https://packout-api.43.129.38.115.sslip.io` (`/health`, `/workspaces`) |
| Server directory | `/opt/packout` (`main.mjs`, `docker-compose.yml`, `deployments/`, `data/`, `.env`) |
| Container | `packout-api`, `node:24-alpine`, 160 MB hard limit with no swap, 0.5 CPU, read-only root, no capabilities |
| Database | `/opt/packout/data/vendor-api.sqlite` (SQLite, WAL) |
| Secret | `/opt/packout/.env`, mode 600, one line: `VENDOR_WRITER_PRIVATE_KEY` (testnet key, never committed) |
| Allowed browser origin | `https://packout-vendor-a.vercel.app` (one origin; `CORS_ORIGIN` in the compose file) |

The VPS is shared with other projects and had about 500 MB of free RAM with about 1 GB of swap in use on 2026-11-02. Keep this container small, and do not run `pnpm install` or a build on the server.

## Deploy or update

From the repo root on a machine that can SSH to the VPS:

```bash
# 1. Bundle (no node_modules needed on the server). Bun's bundler works; esbuild does too.
bun build apps/vendor-api/src/main.ts --target=node --external node:sqlite --outfile scratch/api-deploy/main.mjs

# 2. Ship the bundle, compose file and the testnet deployment record.
scp scratch/api-deploy/main.mjs deploy/vps/docker-compose.yml ubuntu@<vps>:/opt/packout/
scp contracts/deployments/portaldotTestnet.json ubuntu@<vps>:/opt/packout/deployments/

# 3. Restart. The first run also needs /opt/packout/.env (see below).
ssh ubuntu@<vps> 'cd /opt/packout && docker compose up -d --force-recreate && docker ps --filter name=packout-api'
```

First run only:

```bash
ssh ubuntu@<vps> 'sudo mkdir -p /opt/packout && sudo chown ubuntu:ubuntu /opt/packout && mkdir -p /opt/packout/data /opt/packout/deployments'
# Copy the key line without printing it:
grep -E '^VENDOR_WRITER_PRIVATE_KEY=' .env | ssh ubuntu@<vps> 'umask 077; cat > /opt/packout/.env'
```

Then add `Caddyfile.snippet` to the end of `/opt/annona/deploy/vps/Caddyfile`. Back the file up first, append in place (do not replace the file: Caddy bind-mounts it), validate, then reload without downtime:

```bash
F=/opt/annona/deploy/vps/Caddyfile
cp -p $F $F.bak-before-packout && cat Caddyfile.snippet >> $F
docker exec vps-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec vps-caddy-1 caddy reload   --config /etc/caddy/Caddyfile --adapter caddyfile
```

## Check it

```bash
curl https://packout-api.43.129.38.115.sslip.io/health        # {"ok":true,"chainId":420420777,"registry":"0xA76a...","writer":"0x651d..."}
docker stats --no-stream packout-api                          # memory well under 160 MiB
docker logs --tail 20 packout-api
```

Expected API answers: an unknown workspace id gives `404 unknown-workspace`; a workspace on chain whose writer is not granted gives `409 writer-not-granted`; malformed input gives `400 invalid-input`.

## Fund and watch the writer

The writer account pays gas for every anchored batch. A single-digest append to an existing head measured 0.031 tPOT on 2026-10-29, but two things cost far more. The node reserves the estimated maximum fee before it accepts a call, about 3.94 tPOT on 2026-11-03, so a balance below about 4 tPOT rejects every anchor with `Transaction is temporarily banned`. And a workspace's first anchor cost 3.88 tPOT on 2026-11-03. Keep at least 10 tPOT on the writer and budget about 4 tPOT per new workspace. Anyone can create a workspace and grant this public address as a writer, so a stranger could spend it. That is acceptable for a testnet demo and not for production. Check the balance before a demo:

```bash
node --env-file=.env -e "import('viem').then(async v=>{const {privateKeyToAddress}=await import('viem/accounts');const c=v.createPublicClient({transport:v.http('https://test-evm-rpc-v3.portaldot.dev')});console.log(v.formatEther(await c.getBalance({address:privateKeyToAddress(process.env.VENDOR_WRITER_PRIVATE_KEY)})))})"
```

## Back up and stop

- Back up the database while the container is stopped, or copy all three `vendor-api.sqlite*` files together: `docker compose stop && cp -a data data.bak && docker compose start`.
- The demo moment "Vendor A is shut down" is `docker compose stop` (and `start` to bring it back). The static frontends on Vercel are unaffected, which is the point.
- Remove everything Packout added: `docker compose down`, delete `/opt/packout`, and restore the Caddyfile from `Caddyfile.bak-before-packout`.
