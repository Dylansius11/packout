import hardhatToolboxViem from '@nomicfoundation/hardhat-toolbox-viem';
import { configVariable, defineConfig } from 'hardhat/config';

// One override point until the Portaldot deployment spike pins its EVM target.
const evmVersion = process.env.SOLIDITY_EVM_VERSION ?? 'cancun';

export default defineConfig({
  plugins: [hardhatToolboxViem],
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion,
    },
  },
  networks: {
    default: { type: 'edr-simulated', chainType: 'l1' },
    localhost: {
      type: 'http',
      url: process.env.LOCAL_RPC_URL ?? 'http://127.0.0.1:8545',
      chainId: 31337,
      accounts: 'remote',
    },
    portaldotTestnet: {
      type: 'http',
      url: process.env.PORTALDOT_EVM_RPC ?? 'https://test-evm-rpc-v3.portaldot.dev',
      chainId: 420420777,
      accounts: [configVariable('DEPLOYER_PRIVATE_KEY')],
    },
  },
});
