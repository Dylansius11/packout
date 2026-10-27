import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  combineWorkspaceKey,
  createBundle,
  envelopeDigest,
  generateWorkspaceKey,
  JOURNAL_SCHEMA_ID,
  packoutRegistryAbi,
  sealOp,
  splitWorkspaceKey,
  verifyBundle,
  workspaceId,
} from '@packout/sdk';
import type { Call } from '@polkadot/types/interfaces';
import { bytesToHex, encodeFunctionData, type Hex, hexToBytes } from 'viem';
import { mappedNativeAddress, waitForFinalized } from '../demo.ts';
import { decodedRevert, forceRejectedAppend } from '../force-rejected.ts';
import { createDemoOperations } from '../operations.ts';
import { createDemoActions, printVerification, requireVerifiedRestore } from '../runtime.ts';
import { executionBounds } from './bounds.ts';
import { buildCalls, nativeCall, reviveCall, STORAGE_LIMIT, WEIGHT } from './calls.ts';
import { json } from './model.ts';
import { type NativeEvidence, sendNative, waitUntilBlock } from './native.ts';
import { preflight } from './preflight.ts';
import { saveWorkspace } from './workspace.ts';

export async function runSuccession(spike: boolean, delayBlocks: number) {
  const session = await preflight(delayBlocks);
  const { api, accounts, deployment, owner, reader } = session;
  if (!session.ready || !deployment) {
    await api.disconnect();
    throw new Error(
      'Succession refused: preflight failed. Resolve funding and deployment checklist failures; no extrinsic was signed or submitted.',
    );
  }
  const directory = new URL(
    `../../../out/succession/${new Date().toISOString().replaceAll(':', '-')}/`,
    import.meta.url,
  );
  const evidence: NativeEvidence[] = [];
  const report: Record<string, unknown> = {
    mode: spike ? 'spike' : 'demo',
    delayBlocks,
    native: evidence,
    preflight: session.checks,
    feeQuotes: session.fees,
    claims: 'UNVERIFIED until this testnet run completes',
  };
  await mkdir(directory, { recursive: true });
  try {
    console.log(
      `TEST DELAY: ${delayBlocks} blocks (~${delayBlocks}×6 s); not a production recovery policy.`,
    );
    const salt = bytesToHex(randomBytes(32));
    const wsId = session.savedWorkspace?.wsId ?? workspaceId(owner, salt);
    report.wsId = wsId;
    report.owner = owner;
    report.registry = deployment.address;
    const planned = buildCalls(
      api.registry,
      {
        W: accounts.W.address,
        N: accounts.N.address,
        backups: accounts.backups.map((pair) => pair.address),
      },
      deployment.address,
      wsId,
      salt,
      session.vendor.address,
      delayBlocks,
    );
    const execute = async (name: string, expected?: string) => {
      const step = planned.find((call) => call.name === name);
      if (!step) throw new Error(`Missing planned step ${name}.`);
      const signer = accounts.pairs.find((pair) => pair.address === step.origin);
      if (!signer) throw new Error(`Missing signer for ${name}.`);
      return sendNative(
        api,
        signer,
        step.call,
        name,
        step.index === '0x5001' || step.index === '0x1e00' ? owner : null,
        accounts.pairs,
        evidence,
        expected,
      );
    };
    if (session.priorInheritor) {
      await sendNative(
        api,
        accounts.W,
        nativeCall(api.registry, '0x1e01', []),
        'SETUP: W revokes prior rehearsal inheritor',
        null,
        accounts.pairs,
        evidence,
      );
    }
    for (let i = 0; i < 4; i++) {
      if (session.forwarding[i] > 0n) {
        const recipient = i === 0 ? accounts.N : accounts.backups[i - 1];
        await sendNative(
          api,
          accounts.W,
          nativeCall(api.registry, '0x0603', [recipient.address, session.forwarding[i]]),
          `forward-${i}`,
          null,
          accounts.pairs,
          evidence,
        );
      }
    }
    // AutoMap may install OriginalAccount on W's first signed extrinsic or only on its first
    // Revive call (UNVERIFIED), so the state after funding is recorded and asserted after the grant.
    const mapping = async () => {
      const reverse = (await api.call.reviveApi.accountId(owner)).toHex();
      const original = await api.query.revive.originalAccount(owner);
      const mapped =
        reverse === bytesToHex(accounts.W.publicKey) &&
        (original.toString().includes(bytesToHex(accounts.W.publicKey).slice(2)) ||
          original.toString() === accounts.W.address);
      return { mapped, forward: owner, reverse, original: original.toJSON() };
    };
    report.mappingAfterFunding = await mapping();
    // Each real native EVM call is dry-run in its current state, not against a fake registry.
    const direct = async (call: Call, label: string, inherited = false) => {
      const data = call.args[4].toHex() as Hex;
      const estimate = await api.call.reviveApi.call(
        accounts.W.publicKey,
        deployment.address,
        0,
        null,
        null,
        data,
      );
      const bounds = executionBounds(estimate.toJSON());
      const weight = {
        refTime: (bounds.weight.refTime * 12n) / 10n + 1n,
        proofSize: (bounds.weight.proofSize * 12n) / 10n + 1n,
      };
      const storage = bounds.storage;
      if (
        weight.refTime > WEIGHT.refTime ||
        weight.proofSize > WEIGHT.proofSize ||
        storage > STORAGE_LIMIT
      )
        throw new Error(
          `${label}: dry-run exceeds quoted weight/storage budget; refusing an unbudgeted write.`,
        );
      const inner = reviveCall(api.registry, deployment.address, data, weight, storage);
      const outer = inherited
        ? nativeCall(api.registry, '0x1e00', [accounts.W.address, inner])
        : inner;
      return sendNative(
        api,
        inherited ? accounts.N : accounts.W,
        outer,
        label,
        owner,
        accounts.pairs,
        evidence,
      );
    };
    const create = planned.find((call) => call.name === 'create');
    const grant = planned.find((call) => call.name === 'grant');
    if (!create || !grant) throw new Error('Creation/grant call missing.');
    if (!session.savedWorkspace) await direct(create.call, 'W creates workspace');
    else console.log(`SETUP: reusing ${wsId}; no new workspace storage allocation.`);
    const initial = await reader.getWorkspace(wsId);
    if (!initial || initial.owner.toLowerCase() !== owner.toLowerCase())
      throw new Error('Registry owner is not H160(W). Native caller gate failed.');
    await direct(grant.call, 'W grants vendor');
    const mapped = await mapping();
    report.mapping = mapped;
    if (!mapped.mapped)
      throw new Error(
        'AutoMap did not map the EVM-visible owner back to W after its Revive calls.',
      );
    const startIndex = Number(initial.count);
    if (!Number.isSafeInteger(startIndex))
      throw new Error('Workspace history exceeds the headless demo index limit.');
    let key = session.savedWorkspace?.key ?? generateWorkspaceKey();
    const shares = spike ? [] : await splitWorkspaceKey(key);
    const fingerprint = (bytes: Uint8Array) =>
      createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    if (!spike)
      console.log(
        `D12: workspace key ${fingerprint(key)} split 2-of-3; backup fingerprints ${shares.map(fingerprint).join(', ')}. Shares remain on this device for this headless rehearsal; no key/share is logged or written to evidence.`,
      );
    const operations = createDemoOperations(wsId);
    const envelopes = [
      ...(session.savedWorkspace?.envelopes.map((envelope) => hexToBytes(envelope)) ?? []),
      ...operations.slice(0, 2).map((op) => sealOp(op, key)),
    ];
    const action = createDemoActions({ network: 'portaldotTestnet', client: session.client });
    report.evm = action.transactions;
    const vendorNative = mappedNativeAddress(session.vendor.address);
    const vendorBefore = session.balanceSchema.parse(
      (await api.query.system.account(vendorNative)).toJSON(),
    ).data;
    const vendorHoldsBefore = (await api.query.balances.holds(vendorNative)).toJSON();
    const vendorAppend = await action.action(
      'Vendor appends batch (origin and EVM caller: vendor)',
      (hooks) =>
        session.vendorWriter.appendBatch(
          wsId,
          initial.count,
          initial.head,
          [envelopeDigest(envelopes[startIndex])],
          hooks,
        ),
    );
    const vendorBlock = await session.client.getBlock({ blockNumber: vendorAppend.blockNumber });
    report.vendorAppend = {
      origin: session.vendor.address,
      evmCaller: session.vendor.address,
      dispatch: 'Ok',
      blockHash: vendorBlock.hash,
      hash: vendorAppend.hash,
    };
    const vendorAfter = session.balanceSchema.parse(
      (await api.query.system.account(vendorNative)).toJSON(),
    ).data;
    report.vendorAcceptedCost = {
      payer: vendorNative,
      freeDelta: vendorAfter.free - vendorBefore.free,
      reservedDelta: vendorAfter.reserved - vendorBefore.reserved,
      holdsBefore: vendorHoldsBefore,
      holdsAfter: (await api.query.balances.holds(vendorNative)).toJSON(),
    };
    console.log(
      `Vendor accepted append: dispatch Ok; block hash ${vendorBlock.hash}; native payer ${vendorNative}; balance delta ${vendorAfter.free - vendorBefore.free}.`,
    );
    const appendNative = async (index: number, inherited: boolean) => {
      const state = await reader.getWorkspace(wsId);
      if (!state || state.count !== BigInt(index))
        throw new Error(`Expected next index ${index}; workspace has changed.`);
      const call = reviveCall(
        api.registry,
        deployment.address,
        encodeFunctionData({
          abi: packoutRegistryAbi,
          functionName: 'appendBatch',
          args: [wsId, state.count, state.head, [envelopeDigest(envelopes[index])]],
        }),
      );
      await direct(
        call,
        inherited ? 'N continues as W at next index' : 'W appends natively',
        inherited,
      );
      const event = await reader.getAppended(wsId, BigInt(index));
      if (
        !event ||
        event.author.toLowerCase() !== owner.toLowerCase() ||
        event.digest !== envelopeDigest(envelopes[index])
      )
        throw new Error(`Append ${index} does not prove author H160(W).`);
    };
    await appendNative(startIndex + 1, false);
    if (!spike) {
      key.fill(0);
      console.log(
        'Owner key discarded locally before succession. Only backup shares can restore it.',
      );
    }
    await execute('configure');
    if (spike) {
      await execute('initiate-A');
      await execute('cancel-A');
    }
    const attempt = await execute('initiate-B');
    if (spike) await execute('finish-one-approval', 'NotApproved');
    await execute('approve-B');
    const target = BigInt(attempt.blockNumber) + BigInt(delayBlocks);
    if (spike) {
      if ((await api.rpc.chain.getHeader()).number.toBigInt() + 1n >= target)
        throw new Error(
          'The test delay elapsed before the negative finish test; use a larger --delay-blocks value.',
        );
      await execute('finish-before-delay', 'NotYetInheritable');
      // Upstream control checks stored inheritor, not attempt time: this is NoInheritor, not NotYetInheritable.
      await execute('control-before-inheritance', 'NoInheritor');
    }
    await waitUntilBlock(api, target);
    await execute('finish');
    const inheritor = await api.query.recovery.inheritor(accounts.W.address);
    report.inheritor = inheritor.toJSON();
    if (
      !inheritor.toString().includes(accounts.N.address) &&
      !inheritor.toString().includes(bytesToHex(accounts.N.publicKey).slice(2))
    )
      throw new Error('N was not installed as inheritor.');
    const beforeRotation = await reader.getWorkspace(wsId);
    if (!beforeRotation) throw new Error('Workspace disappeared.');
    const rotation = reviveCall(
      api.registry,
      deployment.address,
      encodeFunctionData({
        abi: packoutRegistryAbi,
        functionName: 'rotateEpoch',
        args: [wsId, []],
      }),
    );
    await direct(rotation, 'N rotates epoch through Recovery as W', true);
    const rotated = await reader.getWorkspace(wsId);
    if (
      !rotated ||
      rotated.epoch !== beforeRotation.epoch + 1 ||
      rotated.owner.toLowerCase() !== owner.toLowerCase()
    )
      throw new Error('Inherited rotation did not increment epoch under the same H160(W) owner.');
    if (!spike) {
      key.fill(0);
      key = await combineWorkspaceKey(shares.slice(0, 2));
      console.log(
        `D12: two backups reconstructed workspace key fingerprint ${fingerprint(key)}; verifying and decrypting history locally.`,
      );
      const bundle = createBundle({
        chainId: 420420777,
        registry: deployment.address,
        wsId,
        schemaId: JOURNAL_SCHEMA_ID,
        envelopes: envelopes.map((envelope) => bytesToHex(envelope)),
        checkpoint: { blockNumber: Number(await session.client.getBlockNumber()) },
      });
      const restored = await verifyBundle({ bundle, key, chain: reader });
      printVerification('Recovered history', restored);
      requireVerifiedRestore(restored);
      report.keyPath = { threshold: 2, backups: 3, fingerprint: fingerprint(key), verified: true };
      for (const share of shares) share.fill(0);
    }
    envelopes.push(sealOp(operations[2], key));
    await appendNative(startIndex + 2, true);
    const current = await reader.getWorkspace(wsId);
    if (!current) throw new Error('Workspace missing before vendor refusal.');
    const digests = [bytesToHex(randomBytes(32))];
    try {
      await session.client.simulateContract({
        abi: packoutRegistryAbi,
        address: deployment.address,
        functionName: 'appendBatch',
        account: session.vendor.address,
        args: [wsId, current.count, current.head, digests],
      });
      throw new Error('Revoked vendor simulation unexpectedly succeeded.');
    } catch (error) {
      if (!decodedRevert(error)?.startsWith('NotWriter(')) throw error;
      console.log('Vendor simulation refused: NotWriter.');
    }
    // Only the fields consumed by the shared refusal helper are supplied; no EVM owner key is loaded.
    const rejectionSession = { ...session, deployment, vendorAddress: session.vendor.address };
    const refusalBefore = session.balanceSchema.parse(
      (await api.query.system.account(vendorNative)).toJSON(),
    ).data;
    const rejected = await action.action(
      'Vendor mined refusal (origin and EVM caller: vendor)',
      (hooks) =>
        forceRejectedAppend(rejectionSession, {
          wsId,
          expectedCount: current.count,
          expectedHead: current.head,
          digests,
          successfulAppendGasUsed: vendorAppend.gasUsed,
          onSubmitted: hooks.onSubmitted,
        }),
    );
    await waitForFinalized(session.client, rejected.blockNumber);
    const refusalAfter = session.balanceSchema.parse(
      (await api.query.system.account(vendorNative)).toJSON(),
    ).data;
    const refusalBlock = await session.client.getBlock({ blockNumber: rejected.blockNumber });
    report.vendorRejectedCost = {
      origin: session.vendor.address,
      evmCaller: session.vendor.address,
      dispatch: 'reverted',
      blockHash: refusalBlock.hash,
      payer: vendorNative,
      freeDelta: refusalAfter.free - refusalBefore.free,
      reservedDelta: refusalAfter.reserved - refusalBefore.reserved,
    };
    console.log(
      `Vendor refusal: dispatch reverted; block hash ${refusalBlock.hash}; native payer ${vendorNative}; balance delta ${refusalAfter.free - refusalBefore.free}.`,
    );
    const final = await reader.getWorkspace(wsId);
    if (final?.count !== initial.count + 3n || final.head !== current.head)
      throw new Error('Rejected vendor changed the canonical history.');
    await saveWorkspace({
      registry: deployment.address,
      wsId,
      key,
      envelopes: envelopes.map((envelope) => bytesToHex(envelope)),
    });
    key.fill(0);
    report.complete = true;
    report.claims = 'Observed by this live testnet run; RPC-trusted state and finalized receipts.';
    console.log(
      'Succession complete: owner unchanged, epoch rotated, history continued, vendor refused.',
    );
  } catch (error) {
    report.failure = error instanceof Error ? error.message : 'Unknown succession failure';
    throw error;
  } finally {
    await writeFile(new URL('evidence.json', directory), `${json(report)}\n`);
    await api.disconnect();
  }
}
