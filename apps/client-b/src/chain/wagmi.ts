import { createConfig, http, injected, mock } from 'wagmi';
import { chain, network } from '../config/env.ts';

/** Hardhat dev account #0: unlocked on `hardhat node`, never funded or used on a real network. */
const HARDHAT_ACCOUNT_0 = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

// The mock connector exists only for local Playwright runs: localhost network and `?e2e=1`.
// The flag is remembered for the tab session so a reload mid-flow keeps the test account.
const E2E_KEY = 'packout.e2e';
if (new URLSearchParams(window.location.search).get('e2e') === '1') {
  sessionStorage.setItem(E2E_KEY, '1');
}
const e2eMock = network === 'localhost' && sessionStorage.getItem(E2E_KEY) === '1';

export const wagmiConfig = createConfig({
  chains: [chain],
  transports: { [chain.id]: http() },
  connectors: e2eMock
    ? [mock({ accounts: [HARDHAT_ACCOUNT_0], features: { defaultConnected: false } })]
    : [injected()],
  multiInjectedProviderDiscovery: !e2eMock,
});
