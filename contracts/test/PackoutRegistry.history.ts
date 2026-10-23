import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { network } from 'hardhat';
import {
  getAddress,
  type Hex,
  keccak256,
  parseEventLogs,
  stringToHex,
  zeroAddress,
  zeroHash,
} from 'viem';
import { digests, domain, fixture, salt, schemaId, step, vectors } from './helpers.ts';

describe('append history and rejection precedence', async () => {
  const f = await fixture();
  after(async () => {
    await f.connection.close();
  });

  it('owner appends without a grant; every emitted head matches independent ABI encoding', async () => {
    const { registry, wsId, owner, publicClient } = f;
    let head: Hex = zeroHash;
    let count = 0n;
    for (const batch of [digests.slice(0, 2), [digests[2]], Array<Hex>(64).fill(zeroHash)]) {
      const hash = await registry.write.appendBatch([wsId, count, head, batch]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const logs = parseEventLogs({
        abi: registry.abi,
        logs: receipt.logs,
        eventName: 'Appended',
        strict: true,
      });
      assert.equal(logs.length, batch.length);
      for (const [offset, digest] of batch.entries()) {
        head = step(wsId, count, head, digest);
        assert.deepEqual(logs[offset].args, {
          wsId,
          index: count,
          author: getAddress(owner.account.address),
          epoch: 0,
          digest,
          head,
        });
        assert.equal(logs[offset].topics.length, 4);
        count++;
      }
      assert.deepEqual(await registry.read.getWorkspace([wsId]), [
        getAddress(owner.account.address),
        0,
        count,
        head,
        schemaId,
      ]);
    }
  });

  it('checks unknown workspace before authorization on every workspace operation', async () => {
    const { registry, viem, other } = f;
    const unknown = keccak256(stringToHex('unknown'));
    const calls = [
      () => registry.read.getWorkspace([unknown]),
      () => registry.write.grantWriter([unknown, zeroAddress], { account: other.account }),
      () => registry.write.revokeWriter([unknown, zeroAddress], { account: other.account }),
      () => registry.write.rotateEpoch([unknown, []], { account: other.account }),
      () => registry.write.appendBatch([unknown, 99n, domain, []], { account: other.account }),
    ];
    for (const call of calls)
      await viem.assertions.revertWithCustomErrorWithArgs(call(), registry, 'UnknownWorkspace', [
        unknown,
      ]);
    assert.equal(await registry.read.canWrite([unknown, other.account.address]), false);
    assert.equal(await registry.read.canWrite([unknown, zeroAddress]), false);
  });

  it('checks authorization before batch size or stale checkpoint', async () => {
    const { registry, viem, wsId, other } = f;
    for (const batch of [[], Array<Hex>(65).fill(zeroHash)]) {
      await viem.assertions.revertWithCustomErrorWithArgs(
        registry.write.appendBatch([wsId, 99n, domain, batch], { account: other.account }),
        registry,
        'NotWriter',
        [wsId, getAddress(other.account.address), 0],
      );
    }
  });

  it('checks empty and oversized batches before stale checkpoint', async () => {
    const { registry, viem, wsId } = f;
    await viem.assertions.revertWithCustomError(
      registry.write.appendBatch([wsId, 99n, domain, []]),
      registry,
      'EmptyBatch',
    );
    await viem.assertions.revertWithCustomErrorWithArgs(
      registry.write.appendBatch([wsId, 99n, domain, Array<Hex>(65).fill(zeroHash)]),
      registry,
      'BatchTooLarge',
      [65n, 64n],
    );
  });

  it('rejects stale count before stale head with exact expected/actual arguments', async () => {
    const { registry, viem, wsId } = f;
    const state = await registry.read.getWorkspace([wsId]);
    await viem.assertions.revertWithCustomErrorWithArgs(
      registry.write.appendBatch([wsId, 0n, domain, [zeroHash]]),
      registry,
      'StaleCount',
      [0n, state[2]],
    );
    await viem.assertions.revertWithCustomErrorWithArgs(
      registry.write.appendBatch([wsId, state[2], domain, [zeroHash]]),
      registry,
      'StaleHead',
      [domain, state[3]],
    );
    assert.deepEqual(await registry.read.getWorkspace([wsId]), state);
  });

  it('rejects the second writer racing from the same checkpoint', async () => {
    const { registry, viem, wsId, writer, other } = f;
    await registry.write.grantWriter([wsId, writer.account.address]);
    await registry.write.grantWriter([wsId, other.account.address]);
    const state = await registry.read.getWorkspace([wsId]);
    await registry.write.appendBatch([wsId, state[2], state[3], [digests[0]]], {
      account: writer.account,
    });
    await viem.assertions.revertWithCustomErrorWithArgs(
      registry.write.appendBatch([wsId, state[2], state[3], [digests[1]]], {
        account: other.account,
      }),
      registry,
      'StaleCount',
      [state[2], state[2] + 1n],
    );
  });
});

describe('shared head-chain vectors', async () => {
  const connection = await network.create('default');
  const harness = await connection.viem.deployContract('HeadChainHarness');
  after(async () => {
    await connection.close();
  });
  for (const vector of vectors.cases) {
    it(vector.name, async () => {
      let head = vector.startHead as Hex;
      for (const [offset, digest] of vector.digests.entries()) {
        head = await harness.read.nextHead([
          vector.wsId as Hex,
          BigInt(vector.startIndex) + BigInt(offset),
          head,
          digest as Hex,
        ]);
        assert.equal(head, vector.heads[offset]);
      }
    });
  }
});

it('reports local gas receipts and deployed code size (not Portaldot cost)', async () => {
  const connection = await network.create('default');
  try {
    const { viem } = connection;
    const publicClient = await viem.getPublicClient();
    const [owner, writer] = await viem.getWalletClients();
    const { contract: registry, deploymentTransaction } =
      await viem.sendDeploymentTransaction('PackoutRegistry');
    const gas: Record<string, string> = {};
    const record = async (name: string, tx: Promise<Hex> | Hex) => {
      const receipt = await publicClient.waitForTransactionReceipt({ hash: await tx });
      assert.equal(receipt.status, 'success');
      gas[name] = receipt.gasUsed.toString();
    };
    await record('deploy', deploymentTransaction.hash);
    const wsId = await registry.read.workspaceId([owner.account.address, salt]);
    await record('createWorkspace', registry.write.createWorkspace([salt, schemaId]));
    await record('grantWriter', registry.write.grantWriter([wsId, writer.account.address]));
    for (const size of [1, 16, 64]) {
      const state = await registry.read.getWorkspace([wsId]);
      await record(
        `appendBatch(${size})`,
        registry.write.appendBatch([wsId, state[2], state[3], Array<Hex>(size).fill(digests[0])]),
      );
    }
    await record('rotateEpoch(1)', registry.write.rotateEpoch([wsId, [writer.account.address]]));
    const code = await publicClient.getCode({ address: registry.address });
    assert.ok(code);
    console.log(JSON.stringify({ localGas: gas, deployedBytecodeBytes: (code.length - 2) / 2 }));
  } finally {
    await connection.close();
  }
});
