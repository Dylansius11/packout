import type { Op } from '@packout/sdk';
import type { Address, Hex } from 'viem';

export type WorkspaceRole = 'owner' | 'member';

/** A workspace this device can read and write. The key never leaves this record except through an invite link. */
export type WorkspaceRecord = {
  wsId: Hex;
  role: WorkspaceRole;
  label: string;
  /** base64url, 32 bytes */
  keyB64: string;
  memberId: Hex;
  displayName: string;
  ownerAddress: Address | null;
  /** True once the vendor API reported that its writer key was revoked. */
  writerRevoked: boolean;
  createdAt: number;
};

export type StoredOpStatus = 'local' | 'pending' | 'anchored' | 'rejected';

/** One encrypted operation mirrored on this device, with its plaintext when readable. */
export type StoredOp = {
  /** keccak256 of the envelope: the identity shared by device, vendor and chain. */
  digest: Hex;
  wsId: Hex;
  envelope: Hex;
  /** Null when this device could not decrypt the envelope. */
  op: Op | null;
  origin: 'local' | 'remote';
  createdAt: number;
  status: StoredOpStatus;
  /** When `status` last changed on this device. Drives the 30 s timeout message. */
  statusSince: number;
  apiSeq: number | null;
  index: number | null;
  txHash: Hex | null;
  blockNumber: number | null;
  /** Plain sentence explaining a rejection or an unreadable envelope. */
  failure: string | null;
};

export type SetupStepId = 'wallet' | 'create' | 'key' | 'grant' | 'register' | 'invite';
export type SetupStepStatus = 'pending' | 'working' | 'done' | 'failed';
export type SetupPhase = 'preparing' | 'wallet' | 'submitted';

export type SetupStepState = {
  status: SetupStepStatus;
  phase: SetupPhase | null;
  txHash: Hex | null;
  blockNumber: number | null;
  /** Plain sentence for a step that finished without sending a transaction. */
  note: string | null;
  error: string | null;
  startedAt: number | null;
};

/** Owner onboarding progress, persisted after every change so a reload resumes. */
export type SetupRecord = {
  salt: Hex;
  label: string;
  displayName: string;
  memberId: Hex;
  ownerAddress: Address | null;
  wsId: Hex | null;
  keyB64: string | null;
  vendorWriter: Address | null;
  steps: Record<SetupStepId, SetupStepState>;
  createdAt: number;
};
