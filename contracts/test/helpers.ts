import { network } from 'hardhat';
import { encodeAbiParameters, type Hex, keccak256, parseAbiParameters, stringToHex } from 'viem';
import vectors from '../../packages/sdk/test/vectors/head-chain.json' with { type: 'json' };

export { digests, domain, fixture, salt, schemaId, step, vectors };

const salt = keccak256(stringToHex('registry-tests'));
const schemaId = keccak256(stringToHex('packout.journal/1'));
const digests = vectors.cases[0].digests as Hex[];
const domain = vectors.headDomain as Hex;
const step = (wsId: Hex, index: bigint, head: Hex, digest: Hex): Hex =>
  keccak256(
    encodeAbiParameters(parseAbiParameters('bytes32, bytes32, uint64, bytes32, bytes32'), [
      domain,
      wsId,
      index,
      head,
      digest,
    ]),
  );

// Each fixture is a new local simulation; no configured testnet account is used.
async function fixture() {
  const connection = await network.create('default');
  const { viem } = connection;
  const [owner, writer, other] = await viem.getWalletClients();
  const registry = await viem.deployContract('PackoutRegistry');
  const publicClient = await viem.getPublicClient();
  const wsId = await registry.read.workspaceId([owner.account.address, salt]);
  await registry.write.createWorkspace([salt, schemaId]);
  return { connection, viem, owner, writer, other, registry, publicClient, wsId };
}
