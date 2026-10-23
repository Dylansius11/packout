import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import {
  chainHeads,
  createRegistryReader,
  createRegistryWriter,
  describeRegistryError,
  packoutRegistryAbi,
  RegistryError,
  ZERO_HEAD,
} from '@packout/sdk';
import { artifacts, network } from 'hardhat';
import {
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  type Hex,
  keccak256,
  stringToHex,
  zeroAddress,
} from 'viem';
import { digests, salt, schemaId } from './helpers.ts';

async function setup() {
  const connection = await network.create('default');
  const client = await connection.viem.getPublicClient();
  const [owner, vendor] = await connection.viem.getWalletClients();
  const { contract, deploymentTransaction } =
    await connection.viem.sendDeploymentTransaction('PackoutRegistry');
  const receipt = await client.waitForTransactionReceipt({ hash: deploymentTransaction.hash });
  const reader = createRegistryReader({
    client,
    registry: contract.address,
    fromBlock: receipt.blockNumber,
  });
  const writer = createRegistryWriter({ client, wallet: owner, registry: contract.address });
  const vendorWriter = createRegistryWriter({ client, wallet: vendor, registry: contract.address });
  return {
    connection,
    client,
    owner,
    vendor,
    contract,
    reader,
    writer,
    vendorWriter,
    fromBlock: receipt.blockNumber,
  };
}

describe('SDK PackoutRegistry chain client', async () => {
  const f = await setup();
  after(async () => {
    await f.connection.close();
  });

  it('keeps the browser-safe ABI identical to the compiled contract', async () => {
    assert.deepEqual(packoutRegistryAbi, (await artifacts.readArtifact('PackoutRegistry')).abi);
  });

  it('creates, grants, appends, and reads an ordered verified checkpoint', async () => {
    const created = await f.writer.createWorkspace(salt, schemaId);
    assert.equal(created.wsId, await f.contract.read.workspaceId([f.owner.account.address, salt]));
    assert.equal(f.reader.chainId, await f.client.getChainId());
    assert.equal(f.reader.registry, f.contract.address);
    assert.ok(created.gasUsed > 0n);
    await f.writer.grantWriter(created.wsId, f.vendor.account.address);
    const result = await f.vendorWriter.appendBatch(created.wsId, 0n, ZERO_HEAD, digests);
    const heads = chainHeads(created.wsId, 0n, ZERO_HEAD, digests);
    assert.deepEqual(await f.reader.getWorkspace(created.wsId), {
      owner: getAddress(f.owner.account.address),
      epoch: 0,
      count: 3n,
      head: heads[2],
      schemaId,
    });
    assert.equal(await f.reader.canWrite(created.wsId, f.vendor.account.address), true);
    assert.deepEqual(
      result.appended.map((event) => event.head),
      heads,
    );
    assert.deepEqual(
      result.appended.map((event) => event.index),
      [0n, 1n, 2n],
    );
    assert.ok(
      result.appended.every(
        (event) => event.txHash === result.hash && event.blockNumber === result.blockNumber,
      ),
    );
    assert.deepEqual(await f.reader.getAppended(created.wsId, 2n), result.appended[2]);
    assert.deepEqual(await f.reader.getAppendedRange(created.wsId, 0n, 2n), result.appended);
    assert.deepEqual(await f.reader.getAppendedRange(created.wsId, 1n, 1n), [result.appended[1]]);
    assert.equal(await f.reader.getAppended(created.wsId, 3n), null);
    const tx = await f.client.getTransaction({ hash: result.hash });
    assert.equal(tx.type, 'legacy');
    assert.equal(tx.gasPrice, result.effectiveGasPrice);
    const estimatedGas = await f.client.estimateContractGas({
      abi: packoutRegistryAbi,
      address: f.contract.address,
      functionName: 'appendBatch',
      account: f.vendor.account,
      args: [created.wsId, 3n, heads[2], digests],
      type: 'legacy',
      gasPrice: tx.gasPrice,
    });
    const continued = await f.vendorWriter.appendBatch(created.wsId, 3n, heads[2], digests);
    assert.equal((await f.client.getTransaction({ hash: continued.hash })).gas, estimatedGas);
  });

  it('returns null for unknown workspaces and missing indexed events', async () => {
    const unknown = keccak256(stringToHex('unknown SDK workspace'));
    assert.equal(await f.reader.getWorkspace(unknown), null);
    assert.equal(await f.reader.getAppended(unknown, 0n), null);
    assert.equal(await f.reader.canWrite(unknown, zeroAddress), false);
  });

  it('surfaces stale checkpoint args as RegistryError before sending', async () => {
    const wsId = await f.contract.read.workspaceId([f.owner.account.address, salt]);
    const nonce = await f.client.getTransactionCount({ address: f.vendor.account.address });
    await assert.rejects(
      f.vendorWriter.appendBatch(wsId, 0n, ZERO_HEAD, digests),
      (error: unknown) => {
        assert.ok(error instanceof RegistryError);
        assert.equal(error.name, 'RegistryError');
        assert.equal(error.reason, 'StaleCount');
        assert.deepEqual(error.args, [0n, 6n]);
        return true;
      },
    );
    const state = await f.reader.getWorkspace(wsId);
    assert.ok(state);
    await assert.rejects(
      f.vendorWriter.appendBatch(wsId, state.count, ZERO_HEAD, digests),
      (error: unknown) => {
        assert.ok(error instanceof RegistryError);
        assert.equal(error.reason, 'StaleHead');
        assert.deepEqual(error.args, [ZERO_HEAD, state.head]);
        return true;
      },
    );
    assert.equal(await f.client.getTransactionCount({ address: f.vendor.account.address }), nonce);
  });

  it('revokes writers and reports epoch takeover in plain language', async () => {
    const wsId = await f.contract.read.workspaceId([f.owner.account.address, salt]);
    await f.writer.revokeWriter(wsId, f.vendor.account.address);
    assert.equal(await f.reader.canWrite(wsId, f.vendor.account.address), false);
    await f.writer.grantWriter(wsId, f.vendor.account.address);
    await f.writer.rotateEpoch(wsId, []);
    assert.equal(await f.reader.canWrite(wsId, f.owner.account.address), true);
    assert.equal(await f.reader.canWrite(wsId, f.vendor.account.address), false);
    const state = await f.reader.getWorkspace(wsId);
    assert.ok(state);
    await assert.rejects(
      f.vendorWriter.appendBatch(wsId, state.count, state.head, digests),
      (error: unknown) => {
        assert.ok(error instanceof RegistryError);
        assert.equal(error.reason, 'NotWriter');
        assert.deepEqual(error.args, [wsId, getAddress(f.vendor.account.address), 1]);
        assert.equal(
          describeRegistryError(error),
          'Write access revoked: this account is not an authorized writer in the current epoch.',
        );
        return true;
      },
    );
    await assert.rejects(
      f.vendorWriter.grantWriter(wsId, f.vendor.account.address),
      (error: unknown) => {
        assert.ok(error instanceof RegistryError);
        assert.equal(error.reason, 'NotOwner');
        return true;
      },
    );
  });

  it('filters history by registry, workspace, deployment block and inclusive index range', async () => {
    const wsId = await f.contract.read.workspaceId([f.owner.account.address, salt]);
    const other = await f.writer.createWorkspace(
      keccak256(stringToHex('other SDK workspace')),
      schemaId,
    );
    await f.writer.appendBatch(other.wsId, 0n, ZERO_HEAD, digests);
    const state = await f.reader.getWorkspace(wsId);
    assert.ok(state);
    const continued = await f.writer.appendBatch(wsId, state.count, state.head, digests);
    const reader = createRegistryReader({
      client: f.client,
      registry: f.contract.address,
      fromBlock: continued.blockNumber,
    });
    assert.deepEqual(await reader.getAppendedRange(wsId, 0n, 99n), continued.appended);
  });

  it('bisects capped block queries rather than silently dropping history', async () => {
    const wsId = await f.contract.read.workspaceId([f.owner.account.address, salt]);
    const expected = await f.reader.getAppendedRange(wsId, 0n, 99n);
    const client = createPublicClient({
      chain: f.client.chain,
      transport: custom({
        async request({ method, params }) {
          const result = await f.connection.provider.request({ method, params });
          if (method === 'eth_getLogs' && Array.isArray(result) && result.length > 0) {
            const [filter] = params as [{ fromBlock: Hex; toBlock: Hex }];
            if (filter.fromBlock !== filter.toBlock)
              return Array.from({ length: 10_000 }, (_, i) => result[i % result.length]);
          }
          return result;
        },
      }),
    });
    const reader = createRegistryReader({
      client,
      registry: f.contract.address,
      fromBlock: f.fromBlock,
    });
    assert.deepEqual(await reader.getAppendedRange(wsId, 0n, 99n), expected);
  });

  it('fails explicitly if a single block still reaches the RPC log cap', async () => {
    const wsId = await f.contract.read.workspaceId([f.owner.account.address, salt]);
    const client = createPublicClient({
      chain: f.client.chain,
      transport: custom({
        async request({ method, params }) {
          const result = await f.connection.provider.request({ method, params });
          if (method === 'eth_getLogs' && Array.isArray(result) && result.length > 0)
            return Array.from({ length: 10_000 }, (_, i) => result[i % result.length]);
          return result;
        },
      }),
    });
    await assert.rejects(
      createRegistryReader({
        client,
        registry: f.contract.address,
        fromBlock: f.fromBlock,
      }).getAppendedRange(wsId, 0n, 99n),
      /single block.*10,000/i,
    );
  });

  it('announces every submitted hash before requesting its real receipt', async () => {
    let submitted: Hex | undefined;
    const client = createPublicClient({
      chain: f.client.chain,
      transport: custom({
        async request({ method, params }) {
          if (method === 'eth_getTransactionReceipt') {
            assert.equal((params as [Hex])[0], submitted);
          }
          return f.connection.provider.request({ method, params });
        },
      }),
    });
    const writer = createRegistryWriter({ client, wallet: f.owner, registry: f.contract.address });
    const options = {
      onSubmitted(hash: Hex) {
        submitted = hash;
      },
    };
    const created = await writer.createWorkspace(
      keccak256(stringToHex('callback workspace')),
      schemaId,
      options,
    );
    assert.equal(created.hash, submitted);
    submitted = undefined;
    assert.equal(
      (await writer.grantWriter(created.wsId, f.vendor.account.address, options)).hash,
      submitted,
    );
    submitted = undefined;
    assert.equal(
      (await writer.appendBatch(created.wsId, 0n, ZERO_HEAD, digests, options)).hash,
      submitted,
    );
    submitted = undefined;
    assert.equal(
      (await writer.revokeWriter(created.wsId, f.vendor.account.address, options)).hash,
      submitted,
    );
    submitted = undefined;
    assert.equal((await writer.rotateEpoch(created.wsId, [], options)).hash, submitted);
  });

  it('reports the real transaction hash when a race causes a mined revert', async () => {
    const connection = await network.create({
      network: 'default',
      override: { throwOnTransactionFailures: false },
    });
    try {
      const client = await connection.viem.getPublicClient();
      const [owner] = await connection.viem.getWalletClients();
      const contract = await connection.viem.deployContract('PackoutRegistry');
      await contract.write.createWorkspace([salt, schemaId]);
      const wsId = await contract.read.workspaceId([owner.account.address, salt]);
      let race = true;
      const wallet = createWalletClient({
        account: owner.account,
        chain: client.chain,
        transport: custom({
          async request({ method, params }) {
            if (method === 'eth_sendTransaction' && race) {
              race = false;
              await contract.write.appendBatch([wsId, 0n, ZERO_HEAD, [digests[0]]]);
            }
            return connection.provider.request({ method, params });
          },
        }),
      });
      const writer = createRegistryWriter({ client, wallet, registry: contract.address });
      let submitted: Hex | undefined;
      await assert.rejects(
        writer.appendBatch(wsId, 0n, ZERO_HEAD, [digests[1]], {
          onSubmitted(hash) {
            submitted = hash;
          },
        }),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.ok(!(error instanceof RegistryError));
          assert.ok(submitted);
          assert.equal(error.message, `Registry transaction reverted: ${submitted}`);
          return true;
        },
      );
      assert.ok(submitted);
      assert.equal((await client.getTransactionReceipt({ hash: submitted })).status, 'reverted');
      assert.equal((await contract.read.getWorkspace([wsId]))[2], 1n);
    } finally {
      await connection.close();
    }
  });
});
