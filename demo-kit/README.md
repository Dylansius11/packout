# Demo kit

Put the files you need for a live demo here. Bundles and keys are gitignored: nothing in `bundles/` or `keys/` is committed unless you decide to change `.gitignore`.

```
demo-kit/
  bundles/   exported workspace bundles (bundle.json, packout.bundle/1)
  keys/      the matching workspace keys (unpadded base64url, 32 bytes)
```

## What is in here now

| File | What it is | Expected result in Packout Restore |
| --- | --- | --- |
| `bundles/testnet-stale-after-takeover.bundle.json` + `keys/testnet-stale-after-takeover.key.txt` | Pre-takeover export from the 2026-10-29 `demo:full` testnet run (workspace `0xf9997451…4649`) | **Refused** at "Complete history": the owner has since appended on-chain, so this copy is missing operations. This is the stale-bundle refusal moment |

## Make a bundle that restores cleanly

A bundle restores only if it contains every operation the chain has anchored. Two ways to get one:

1. **From Vendor A (the real demo story).** Open the demo vendor, create a workspace, write a few issues, wait until each change shows "Anchored on Portaldot", then press **Export bundle**. Save the file here, and save the workspace key you were shown at creation.
2. **From the CLI.** `pnpm demo:full` (testnet, needs funded keys in `.env`) or `pnpm demo:full:local` (local chain) writes `bundle.json` and `key.txt` under `out/demo-full/<id>/`. Copy the pre-takeover bundle and its key here.

## Check a bundle before the demo

```bash
pnpm verify demo-kit/bundles/<file>.json --key demo-kit/keys/<file>.key.txt
```

Exit `0` means all six checks passed. Exit `1` means a check failed (a stale bundle fails "Complete history"; that is correct). Run it once before every rehearsal so there are no surprises on stage.

## Rules

- Use throwaway demo workspaces only. A workspace key decrypts that workspace, so never put a real team's key in this folder.
- If you want judges to try the restore themselves, commit one demo bundle and its key deliberately (remove it from `.gitignore` for that file only) and say in the README that the workspace is a public demo.
