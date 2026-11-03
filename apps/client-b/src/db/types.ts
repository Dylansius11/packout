import type { Op } from '@packout/sdk';
import type { Address, Hex } from 'viem';

/** The one workspace this device restored. The key lives here and nowhere else except the file the owner kept. */
export type WorkspaceRecord = {
  wsId: Hex;
  chainId: number;
  registry: Address;
  /** base64url, 32 bytes */
  keyB64: string;
  /** Generated once on this device; the author id on every operation written here. */
  memberId: Hex;
  /** Set the first time the owner writes. */
  displayName: string | null;
  /** Newest block known to contain this workspace's history; goes into exported bundles. */
  checkpointBlock: number;
  importedAt: number;
  /** Set when this device sent the `rotateEpoch` transaction that revoked every earlier writer. */
  takeover: { epoch: number; txHash: Hex; blockNumber: number } | null;
};

/** One anchored, decrypted operation. `index` is its position in the on-chain history. */
export type StoredOp = {
  wsId: Hex;
  index: number;
  digest: Hex;
  envelope: Hex;
  op: Op;
  origin: 'bundle' | 'client-b';
  /** Known only for operations this device sent. */
  txHash: Hex | null;
  blockNumber: number | null;
  storedAt: number;
};

/**
 * A sealed operation saved before the wallet is asked to send it. If the tab closes while the
 * transaction is confirming, this is the only copy of the ciphertext: Portaldot keeps its digest, not its content.
 */
export type PendingOp = {
  wsId: Hex;
  digest: Hex;
  envelope: Hex;
  op: Op;
  createdAt: number;
};
