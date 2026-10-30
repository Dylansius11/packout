import '@polkadot/api/augment';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import {
  createBundle,
  createRegistryWriter,
  EVM_DECIMALS,
  JOURNAL_SCHEMA_ID,
  packoutRegistryAbi,
  verifyBundle,
  workspaceId,
} from '@packout/sdk';
import { createNativeRegistryReader } from '@packout/sdk/native';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Metadata } from '@polkadot/types';
import { blake2AsHex } from '@polkadot/util-crypto';
import {
  type Address,
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeFunctionData,
  formatUnits,
  type Hex,
  http,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { z } from 'zod';
import { type DemoDeployment, parseDeployment } from '../demo.ts';
import { loadAccounts } from './accounts.ts';
import { executionBounds } from './bounds.ts';
import { buildCalls, nativeCall, STORAGE_LIMIT, WEIGHT } from './calls.ts';
import { type Check, fundingPlan, PIN, preflightReady } from './model.ts';
import { metadataFingerprint } from './pin.ts';
import { loadWorkspace } from './workspace.ts';

const envSchema = z.object({
  PORTALDOT_NATIVE_WSS: z
    .literal('wss://test-node-v3.portaldot.dev')
    .default('wss://test-node-v3.portaldot.dev'),
  PORTALDOT_EVM_RPC: z
    .literal('https://test-evm-rpc-v3.portaldot.dev')
    .default('https://test-evm-rpc-v3.portaldot.dev'),
  VENDOR_WRITER_PRIVATE_KEY: z.string().regex(/^0x[\da-fA-F]{64}$/),
});
export async function preflight(delayBlocks: number) {
  console.log(
    'TESTNET ONLY — native Recovery/Revive pallets cannot be rehearsed on Hardhat. Read-only preflight; no signature or submission.',
  );
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success)
    throw new Error(
      `Invalid ${parsed.error.issues[0].path.join('.')}; use the Portaldot testnet endpoints and configured vendor key.`,
    );
  const env = parsed.data;
  const accounts = await loadAccounts();
  const provider = new WsProvider(env.PORTALDOT_NATIVE_WSS, false, {}, 15_000);
  await provider.connect();
  const api = await ApiPromise.create({ provider, noInitWarn: true });
  try {
    const checks: Check[] = [];
    const check = (pass: boolean, message: string) => {
      checks.push({ pass, message });
      console.log(`${pass ? 'PASS' : 'FAIL'} ${message}`);
    };
    const hash = await api.rpc.chain.getFinalizedHead();
    const version = await api.rpc.state.getRuntimeVersion(hash);
    const at = await api.at(hash);
    const opaque = await api.rpc.state.call('Metadata_metadata_at_version', '0x10000000', hash);
    const metadata = new Metadata(
      api.registry,
      api.registry.createType('Option<OpaqueMetadata>', opaque).unwrap().toU8a(true),
    );
    check(
      version.specName.toString() === PIN.specName &&
        version.specVersion.toNumber() === PIN.specVersion &&
        version.transactionVersion.toNumber() === PIN.transactionVersion,
      `Runtime ${version.specName} spec ${version.specVersion}, transaction ${version.transactionVersion}; expected ${PIN.specName} / ${PIN.specVersion} / ${PIN.transactionVersion}.`,
    );
    const pinned = new Metadata(
      api.registry,
      gunzipSync(
        await readFile(new URL('../../test/fixtures/succession-metadata.hex.gz', import.meta.url)),
      ).toString() as Hex,
    );
    check(
      blake2AsHex(pinned.toU8a(), 256) === PIN.metadataHash,
      `Pinned v16 snapshot hash ${PIN.metadataHash} is intact.`,
    );
    const currentHash = blake2AsHex(metadata.toU8a(), 256);
    check(
      metadata.version === 16 &&
        metadataFingerprint(metadata.toJSON()) === metadataFingerprint(pinned.toJSON()),
      `Live metadata v${metadata.version} is pin-compatible (raw hash ${currentHash}); only Revive.EthBlockBuilderIR dynamic fallback is excluded.`,
    );
    if (!preflightReady(checks))
      throw new Error(
        'Runtime/metadata pin changed; refusing to build calls with mismatched type IDs.',
      );
    const addresses = {
      W: accounts.W.address,
      N: accounts.N.address,
      backups: accounts.backups.map((pair) => pair.address),
    };
    const owner = (await at.call.reviveApi.address(accounts.W.publicKey)).toHex() as Address;
    check(
      owner.toLowerCase() === '0x2d313fc3e31a90b4a23f0e4b15a7c37817d70dd1',
      `W ${accounts.W.address} maps to EVM caller ${owner}.`,
    );
    const balanceSchema = z.object({
      data: z.object({
        free: z.union([z.string(), z.number()]).transform(BigInt),
        reserved: z.union([z.string(), z.number()]).transform(BigInt),
        frozen: z.union([z.string(), z.number()]).transform(BigInt),
      }),
    });
    const balances = await Promise.all(
      accounts.pairs.map(
        async (pair) =>
          balanceSchema.parse((await at.query.system.account(pair.address)).toJSON()).data,
      ),
    );
    const savedWorkspace = await loadWorkspace();
    const plan = fundingPlan(
      savedWorkspace
        ? balances.slice(1).map((balance) => balance.free - balance.frozen)
        : undefined,
    );
    const priorInheritor =
      (await at.query.recovery.inheritor(accounts.W.address)).toJSON() !== null;
    const forwarding = Object.values(plan.forward);
    const requiredW = plan.requiredW;
    const spendableW = balances[0].free - balances[0].frozen;
    check(
      spendableW >= requiredW,
      `W funding: ${formatUnits(spendableW, 14)} tPOT spendable; requires ${formatUnits(requiredW, 14)} tPOT ${savedWorkspace ? 'for reuse (4 tPOT writer-slot capital, 0.5 tPOT ED/fee allowance, and recipient top-ups)' : 'before forwarding'}.`,
    );
    for (let i = 1; i < accounts.pairs.length; i++) {
      const allocation = forwarding[i - 1];
      check(
        balances[i].free - balances[i].frozen + allocation >=
          (i === 1 ? plan.target.N : plan.target.B1),
        `${i === 1 ? 'N' : `Backup ${i - 1}`} ${accounts.pairs[i].address}: ${formatUnits(balances[i].free, 14)} tPOT; W will forward ${formatUnits(allocation, 14)} tPOT (includes 0.1 existential deposit).`,
      );
    }
    let deployment: DemoDeployment | undefined;
    try {
      deployment = parseDeployment(
        JSON.parse(
          await readFile(
            new URL('../../../contracts/deployments/portaldotTestnet.json', import.meta.url),
            'utf8',
          ),
        ) as unknown,
        'portaldotTestnet',
      );
    } catch {
      /* Missing deployment is an explicit checklist blocker, not an invented address. */
    }
    check(
      deployment !== undefined,
      deployment
        ? `Registry deployment ${deployment.address} is recorded.`
        : 'Deployment missing: contracts/deployments/portaldotTestnet.json; finish BUILD-PLAN 1.4 first.',
    );
    const chain = defineChain({
      id: 420420777,
      name: 'Portaldot testnet v3',
      nativeCurrency: { name: 'Test Portaldot', symbol: 'tPOT', decimals: EVM_DECIMALS },
      rpcUrls: { default: { http: [env.PORTALDOT_EVM_RPC] } },
    });
    const client = createPublicClient({
      chain,
      transport: http(env.PORTALDOT_EVM_RPC, { retryCount: 0, timeout: 15_000 }),
    });
    const vendor = privateKeyToAccount(env.VENDOR_WRITER_PRIVATE_KEY as Hex);
    // Funding is checked for readiness at the spike gate (B1 already includes vendor funding).
    const vendorBalance = await client.getBalance({ address: vendor.address });
    console.log(
      `INFO Vendor ${vendor.address}: ${formatUnits(vendorBalance, 18)} tPOT; its pre-existing B1 funding is also required when deployment exists.`,
    );
    if (deployment) {
      check(
        (await client.getChainId()) === 420420777 &&
          !!(await client.getCode({ address: deployment.address })),
        'Registry code exists on Portaldot testnet chain 420420777.',
      );
      check(
        vendorBalance > 0n,
        'Vendor writer has funds for its accepted append and mined refusal.',
      );
    }
    const salt = `0x${'51'.repeat(32)}` as Hex;
    const wsId = savedWorkspace?.wsId ?? workspaceId(owner, salt);
    const destination = deployment?.address ?? '0x0000000000000000000000000000000000000001';
    if (!deployment)
      console.log(
        'INFO Fee-only encoding destination ...0001 is a precompile, NOT a registry. Registry dry-run is blocked, not simulated as passed.',
      );
    const calls = buildCalls(
      api.registry,
      addresses,
      destination,
      wsId,
      salt,
      vendor.address,
      delayBlocks,
    );
    if (priorInheritor)
      calls.push({
        name: 'revoke-prior-inheritor',
        origin: accounts.W.address,
        index: '0x1e01',
        call: nativeCall(api.registry, '0x1e01', []),
      });
    const nativeBlocks = [...(savedWorkspace?.nativeBlocks ?? [])];
    const reader = await createNativeRegistryReader({
      client,
      registry: destination,
      fromBlock: BigInt(deployment?.blockNumber ?? '0'),
      nativeApi: api,
      blockHashes: nativeBlocks,
    });
    if (savedWorkspace) {
      console.log(
        `INFO Reusing workspace ${savedWorkspace.wsId}; no second workspace deposit. Prior inheritor: ${priorInheritor ? 'W will explicitly revoke during setup' : 'none'}.`,
      );
      const bundle = createBundle({
        chainId: 420420777,
        registry: destination,
        wsId,
        schemaId: JOURNAL_SCHEMA_ID,
        envelopes: savedWorkspace.envelopes,
        checkpoint: { blockNumber: Number(await client.getBlockNumber()) },
      });
      const verified = await verifyBundle({ bundle, key: savedWorkspace.key, chain: reader });
      const state = await reader.getWorkspace(wsId);
      check(
        savedWorkspace.registry.toLowerCase() === destination.toLowerCase() &&
          verified.ok &&
          state?.owner.toLowerCase() === owner.toLowerCase(),
        'Saved ciphertext/key verifies against the current complete workspace under H160(W).',
      );
    }
    const fees: { name: string; fee: string; callHex: string }[] = [];
    for (const planned of calls) {
      const tx = api.tx(planned.call);
      tx.signFake(planned.origin, {
        nonce: 0,
        era: api.registry.createType('ExtrinsicEra', 0),
        blockHash: api.genesisHash,
        genesisHash: api.genesisHash,
        runtimeVersion: api.runtimeVersion,
      });
      const quote = await at.call.transactionPaymentApi.queryInfo(tx.toU8a(), tx.encodedLength);
      const fee = z
        .object({ partialFee: z.union([z.string(), z.number()]).transform(BigInt) })
        .parse(quote.toJSON()).partialFee;
      fees.push({ name: planned.name, fee: fee.toString(), callHex: planned.call.toHex() });
      console.log(`QUOTE ${planned.name}: ${formatUnits(fee, 14)} tPOT (fake-signed, not paid).`);
    }
    check(
      fees.length === calls.length,
      `Fee quotes obtained for all ${calls.length} planned native extrinsics, including negative paths.`,
    );
    const createData = savedWorkspace
      ? encodeFunctionData({
          abi: packoutRegistryAbi,
          functionName: 'grantWriter',
          args: [wsId, vendor.address],
        })
      : encodeFunctionData({
          abi: packoutRegistryAbi,
          functionName: 'createWorkspace',
          args: [salt, JOURNAL_SCHEMA_ID],
        });
    const dryRun = await at.call.reviveApi.call(
      accounts.W.publicKey,
      destination,
      0,
      null,
      null,
      createData,
    );
    console.log(
      `${deployment ? `DRY RUN registry ${savedWorkspace ? 'grantWriter (workspace reused)' : 'createWorkspace'}` : 'INFO ReviveApi reachable; precompile probe only (registry missing)'}: ${JSON.stringify(dryRun.toJSON())}`,
    );
    if (deployment) {
      try {
        const bounds = executionBounds(dryRun.toJSON());
        check(
          bounds.weight.refTime <= WEIGHT.refTime &&
            bounds.weight.proofSize <= WEIGHT.proofSize &&
            bounds.storage <= STORAGE_LIMIT,
          `Native createWorkspace dry-run: required weight ${bounds.weight.refTime}/${bounds.weight.proofSize} (cap ${WEIGHT.refTime}/${WEIGHT.proofSize}), max storage charge ${formatUnits(bounds.storage, 14)} tPOT (cap ${formatUnits(STORAGE_LIMIT, 14)} tPOT).`,
        );
      } catch (error) {
        check(false, error instanceof Error ? error.message : 'Native registry dry-run failed.');
      }
    }
    const ready = preflightReady(checks);
    console.log(
      ready
        ? 'READY: succession may start.'
        : 'NOT READY: no extrinsic signed or submitted. Resolve failed items above.',
    );
    const vendorWallet = createWalletClient({
      account: vendor,
      chain,
      transport: http(env.PORTALDOT_EVM_RPC),
    });
    const registry = destination;
    return {
      api,
      accounts,
      checks,
      ready,
      savedWorkspace,
      forwarding,
      priorInheritor,
      owner,
      balances,
      balanceSchema,
      fees,
      deployment,
      client,
      chain,
      vendor,
      vendorWallet,
      nativeBlocks,
      reader,
      vendorWriter: createRegistryWriter({ client, registry, wallet: vendorWallet }),
      dryRun,
      weight: WEIGHT,
    };
  } catch (error) {
    await api.disconnect();
    throw error;
  }
}
