import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import {
  type Address,
  encodeAbiParameters,
  getAddress,
  type Hex,
  keccak256,
  parseAbiParameters,
  stringToHex,
  zeroAddress,
  zeroHash,
} from 'viem';
import { digests, domain, fixture, salt, schemaId, step, vectors } from './helpers.ts';

describe('PackoutRegistry', async () => {
  const f = await fixture();
  after(async () => {
    await f.connection.close();
  });

  it('creates owner-bound workspaces with genesis state and a complete event', async () => {
    const { registry, owner, writer, viem } = f;
    const newSalt = keccak256(stringToHex('second'));
    const wsId = keccak256(
      encodeAbiParameters(parseAbiParameters('address, bytes32'), [owner.account.address, newSalt]),
    );
    await viem.assertions.emitWithArgs(
      registry.write.createWorkspace([newSalt, schemaId]),
      registry,
      'WorkspaceCreated',
      [wsId, getAddress(owner.account.address), schemaId],
    );
    assert.deepEqual(await registry.read.getWorkspace([wsId]), [
      getAddress(owner.account.address),
      0,
      0n,
      zeroHash,
      schemaId,
    ]);
    assert.equal(await registry.read.canWrite([wsId, owner.account.address]), true);
    assert.equal(await registry.read.canWrite([wsId, writer.account.address]), false);
    const writerId = await registry.read.workspaceId([writer.account.address, newSalt]);
    assert.notEqual(writerId, wsId);
    await registry.write.createWorkspace([newSalt, schemaId], { account: writer.account });
    assert.equal(
      (await registry.read.getWorkspace([writerId]))[0],
      getAddress(writer.account.address),
    );
  });

  it('rejects duplicate creation without changing state', async () => {
    await f.viem.assertions.revertWithCustomErrorWithArgs(
      f.registry.write.createWorkspace([salt, schemaId]),
      f.registry,
      'WorkspaceExists',
      [f.wsId],
    );
    assert.deepEqual(await f.registry.read.getWorkspace([f.wsId]), [
      getAddress(f.owner.account.address),
      0,
      0n,
      zeroHash,
      schemaId,
    ]);
  });

  it('matches the workspace derivation vector and protocol domain', async () => {
    assert.equal(await f.registry.read.HEAD_DOMAIN(), domain);
    for (const vector of vectors.workspaceIds) {
      assert.equal(
        await f.registry.read.workspaceId([vector.owner as Address, vector.salt as Hex]),
        vector.wsId,
      );
    }
  });
});

describe('writer authority and epochs', async () => {
  const f = await fixture();
  after(async () => {
    await f.connection.close();
  });

  it('grants and revokes current-epoch access with exact events', async () => {
    const { registry, viem, wsId, writer, owner } = f;
    await viem.assertions.emitWithArgs(
      registry.write.grantWriter([wsId, writer.account.address]),
      registry,
      'WriterGranted',
      [wsId, 0, getAddress(writer.account.address)],
    );
    assert.equal(await registry.read.canWrite([wsId, writer.account.address]), true);
    await registry.write.appendBatch([wsId, 0n, zeroHash, [digests[0]]], {
      account: writer.account,
    });
    await viem.assertions.emitWithArgs(
      registry.write.revokeWriter([wsId, writer.account.address]),
      registry,
      'WriterRevoked',
      [wsId, 0, getAddress(writer.account.address)],
    );
    assert.equal(await registry.read.canWrite([wsId, writer.account.address]), false);
    await viem.assertions.revertWithCustomErrorWithArgs(
      registry.write.appendBatch([wsId, 1n, step(wsId, 0n, zeroHash, digests[0]), [digests[1]]], {
        account: writer.account,
      }),
      registry,
      'NotWriter',
      [wsId, getAddress(writer.account.address), 0],
    );
    await registry.write.grantWriter([wsId, owner.account.address]);
    await registry.write.revokeWriter([wsId, owner.account.address]);
    assert.equal(await registry.read.canWrite([wsId, owner.account.address]), true);
  });

  it('rotates atomically, preserves history, and emits only EpochRotated', async () => {
    const { registry, viem, wsId, writer, other, owner, publicClient } = f;
    await registry.write.grantWriter([wsId, writer.account.address]);
    const beforeState = await registry.read.getWorkspace([wsId]);
    const hash = await registry.write.rotateEpoch([wsId, [other.account.address]]);
    await viem.assertions.emitWithArgs(hash, registry, 'EpochRotated', [
      wsId,
      1,
      [getAddress(other.account.address)],
    ]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    assert.equal(receipt.logs.length, 1);
    assert.deepEqual(await registry.read.getWorkspace([wsId]), [
      beforeState[0],
      1,
      beforeState[2],
      beforeState[3],
      beforeState[4],
    ]);
    assert.equal(await registry.read.canWrite([wsId, writer.account.address]), false);
    assert.equal(await registry.read.canWrite([wsId, other.account.address]), true);
    assert.equal(await registry.read.canWrite([wsId, owner.account.address]), true);
    await viem.assertions.revertWithCustomErrorWithArgs(
      registry.write.appendBatch([wsId, beforeState[2], beforeState[3], [digests[1]]], {
        account: writer.account,
      }),
      registry,
      'NotWriter',
      [wsId, getAddress(writer.account.address), 1],
    );
    const append = await registry.write.appendBatch(
      [wsId, beforeState[2], beforeState[3], [digests[1]]],
      { account: other.account },
    );
    await viem.assertions.emitWithArgs(append, registry, 'Appended', [
      wsId,
      beforeState[2],
      getAddress(other.account.address),
      1,
      digests[1],
      step(wsId, beforeState[2], beforeState[3], digests[1]),
    ]);
    await registry.write.rotateEpoch([wsId, []]);
    assert.equal(await registry.read.canWrite([wsId, other.account.address]), false);
    const state = await registry.read.getWorkspace([wsId]);
    await registry.write.appendBatch([wsId, state[2], state[3], [zeroHash]]);
  });

  for (const method of ['grantWriter', 'revokeWriter', 'rotateEpoch'] as const) {
    it(`rejects non-owner ${method} with caller arguments`, async () => {
      const { registry, viem, wsId, writer } = f;
      const tx =
        method === 'rotateEpoch'
          ? registry.write.rotateEpoch([wsId, []], { account: writer.account })
          : registry.write[method]([wsId, writer.account.address], { account: writer.account });
      await viem.assertions.revertWithCustomErrorWithArgs(tx, registry, 'NotOwner', [
        wsId,
        getAddress(writer.account.address),
      ]);
    });
  }

  it('rejects invalid writer grants and rolls back invalid rotations', async () => {
    const { registry, viem, wsId, writer } = f;
    await viem.assertions.revertWithCustomErrorWithArgs(
      registry.write.grantWriter([wsId, zeroAddress]),
      registry,
      'InvalidWriter',
      [zeroAddress],
    );
    const state = await registry.read.getWorkspace([wsId]);
    await viem.assertions.revertWithCustomErrorWithArgs(
      registry.write.rotateEpoch([wsId, [writer.account.address, zeroAddress]]),
      registry,
      'InvalidWriter',
      [zeroAddress],
    );
    assert.deepEqual(await registry.read.getWorkspace([wsId]), state);
    assert.equal(await registry.read.canWrite([wsId, writer.account.address]), false);
    // Revoke accepts zero and absent writers, per the protocol.
    await registry.write.revokeWriter([wsId, zeroAddress]);
  });

  it('rejects 17 rotation writers and accepts the boundary of 16', async () => {
    const { registry, viem, wsId } = f;
    const writers = Array.from({ length: 17 }, (_, i) =>
      getAddress(`0x${(i + 1).toString(16).padStart(40, '0')}`),
    );
    await viem.assertions.revertWithCustomErrorWithArgs(
      registry.write.rotateEpoch([wsId, writers]),
      registry,
      'TooManyWriters',
      [17n, 16n],
    );
    await registry.write.rotateEpoch([wsId, writers.slice(0, 16)]);
    for (const writer of writers.slice(0, 16))
      assert.equal(await registry.read.canWrite([wsId, writer]), true);
    assert.equal(await registry.read.canWrite([wsId, writers[16]]), false);
  });
});
