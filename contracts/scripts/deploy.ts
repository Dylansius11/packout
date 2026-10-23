import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { artifacts, network } from 'hardhat';

interface CompilerBuildInfo {
  solcVersion: string;
  input: {
    settings: { evmVersion: string; optimizer: { runs: number } };
  };
}

const connection = await network.create();
try {
  const artifact = await artifacts.readArtifact('PackoutRegistry');
  const buildInfoPath = await artifacts.getBuildInfoPath(artifact.buildInfoId);
  if (buildInfoPath === undefined) {
    throw new Error('PackoutRegistry compiler build info is missing; run the contracts build.');
  }
  // This is Hardhat's own generated build record, not user-supplied deployment input.
  const buildInfo = JSON.parse(await readFile(buildInfoPath, 'utf8')) as CompilerBuildInfo;
  const publicClient = await connection.viem.getPublicClient();
  const { contract, deploymentTransaction } =
    await connection.viem.sendDeploymentTransaction('PackoutRegistry');
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: deploymentTransaction.hash,
  });
  if (receipt.status !== 'success' || receipt.contractAddress === null) {
    throw new Error(`PackoutRegistry deployment failed: ${deploymentTransaction.hash}`);
  }
  const deployment = {
    network: connection.networkName,
    chainId: await publicClient.getChainId(),
    address: contract.address,
    deployTx: receipt.transactionHash,
    blockNumber: receipt.blockNumber.toString(),
    gasUsed: receipt.gasUsed.toString(),
    compiler: {
      version: buildInfo.solcVersion,
      evmVersion: buildInfo.input.settings.evmVersion,
      optimizerRuns: buildInfo.input.settings.optimizer.runs,
    },
    deployedAt: new Date().toISOString(),
  };
  const directory = new URL('../deployments/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(
    new URL(`${connection.networkName}.json`, directory),
    `${JSON.stringify(deployment, null, 2)}\n`,
  );
  console.log(JSON.stringify(deployment));
} finally {
  await connection.close();
}
