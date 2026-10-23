import {
  generateWorkspaceKey,
  JOURNAL_SCHEMA_ID,
  type RegistryReader,
  type RegistryWriter,
  workspaceId,
} from '@packout/sdk';
import { type Address, bytesToHex, type Hex } from 'viem';
import type { VendorApi } from '../api/vendor-api.ts';
import { db } from '../db/db.ts';
import type {
  SetupPhase,
  SetupRecord,
  SetupStepId,
  SetupStepState,
  WorkspaceRecord,
} from '../db/types.ts';
import { randomMemberId, toBase64Url } from '../domain/invite.ts';
import { describeFailure } from '../lib/errors.ts';

export const SETUP_STEPS: { id: SetupStepId; title: string; summary: string }[] = [
  {
    id: 'wallet',
    title: 'Connect your wallet',
    summary: 'Only the owner needs a wallet. Members never do.',
  },
  {
    id: 'create',
    title: 'Create the workspace on Portaldot',
    summary: 'Registers you as the owner. This is the one thing the vendor can never take over.',
  },
  {
    id: 'key',
    title: 'Generate the workspace key on this device',
    summary: 'The key encrypts every change. It is created here and never sent to Vendor A.',
  },
  {
    id: 'grant',
    title: 'Let Vendor A write on your behalf',
    summary: 'Grants the vendor’s writer address access. You can revoke it later.',
  },
  {
    id: 'register',
    title: 'Register the workspace with Vendor A',
    summary: 'Vendor A checks on Portaldot that the workspace exists and that it may write.',
  },
  {
    id: 'invite',
    title: 'Invite link ready',
    summary: 'Share it with teammates so they can join.',
  },
];

function emptyStep(): SetupStepState {
  return {
    status: 'pending',
    phase: null,
    txHash: null,
    blockNumber: null,
    note: null,
    error: null,
    startedAt: null,
  };
}

export function newSetupRecord(label: string, displayName: string): SetupRecord {
  return {
    salt: bytesToHex(crypto.getRandomValues(new Uint8Array(32))),
    label,
    displayName,
    memberId: randomMemberId(),
    ownerAddress: null,
    wsId: null,
    keyB64: null,
    vendorWriter: null,
    steps: {
      wallet: emptyStep(),
      create: emptyStep(),
      key: emptyStep(),
      grant: emptyStep(),
      register: emptyStep(),
      invite: emptyStep(),
    },
    createdAt: Date.now(),
  };
}

export function isSetupComplete(record: SetupRecord): boolean {
  return SETUP_STEPS.every((step) => record.steps[step.id].status === 'done');
}

export interface SetupDeps {
  api: VendorApi;
  reader: RegistryReader;
  /** The connected wallet account. */
  account: Address;
  /** Switches the wallet to the right chain if needed, then returns a registry writer for it. */
  writer(): Promise<RegistryWriter>;
}

type StepControls = {
  phase(phase: SetupPhase): void;
  submitted(hash: Hex): void;
};

/**
 * Runs the owner steps in order from the first one not done. Every step first asks the chain or the
 * vendor whether its effect already exists, so a reload mid-way never sends a transaction twice.
 * Stops at the first failure and records a plain reason; calling it again retries from there.
 */
export async function runSetup(initial: SetupRecord, deps: SetupDeps): Promise<SetupRecord> {
  let record = initial;

  async function commit(next: SetupRecord): Promise<void> {
    record = next;
    await db.setups.put(record);
  }
  function patchStep(id: SetupStepId, patch: Partial<SetupStepState>): Promise<void> {
    return commit({
      ...record,
      steps: { ...record.steps, [id]: { ...record.steps[id], ...patch } },
    });
  }

  async function step(
    id: SetupStepId,
    work: (controls: StepControls) => Promise<Partial<SetupStepState> | undefined>,
  ) {
    // The wallet check always re-runs: the connected account may differ from the one that started this setup.
    if (record.steps[id].status === 'done' && id !== 'wallet') return true;
    await patchStep(id, {
      status: 'working',
      phase: 'preparing',
      error: null,
      startedAt: Date.now(),
    });
    try {
      const result = await work({
        phase: (phase) => void patchStep(id, { phase }),
        submitted: (hash) => void patchStep(id, { phase: 'submitted', txHash: hash }),
      });
      await patchStep(id, { status: 'done', phase: null, ...result });
      return true;
    } catch (error) {
      await patchStep(id, { status: 'failed', phase: null, error: describeFailure(error) });
      return false;
    }
  }

  await ((await step('wallet', async () => {
    if (record.ownerAddress && record.ownerAddress.toLowerCase() !== deps.account.toLowerCase()) {
      throw new Error(
        `This setup was started with ${record.ownerAddress}. Connect that account to continue; the connected one is ${deps.account}.`,
      );
    }
    const wsId = workspaceId(deps.account, record.salt);
    await commit({ ...record, ownerAddress: deps.account, wsId });
    return { note: `Connected as ${deps.account}.` };
  })) &&
    (await step('create', async ({ phase, submitted }) => {
      const wsId = record.wsId;
      if (!wsId) throw new Error('The workspace id is not known yet.');
      if (await deps.reader.getWorkspace(wsId)) {
        return {
          note: 'This workspace already exists on Portaldot, so no transaction was needed.',
        };
      }
      phase('wallet');
      const created = await (await deps.writer()).createWorkspace(record.salt, JOURNAL_SCHEMA_ID, {
        onSubmitted: submitted,
      });
      if (created.wsId !== wsId)
        throw new Error('Portaldot created a different workspace id than expected.');
      return { txHash: created.hash, blockNumber: Number(created.blockNumber) };
    })) &&
    (await step('key', async () => {
      if (record.keyB64) return { note: 'A key already exists on this device.' };
      await commit({ ...record, keyB64: toBase64Url(generateWorkspaceKey()) });
      return {
        note: 'Created on this device. It is stored only here and in the invite link you share.',
      };
    })) &&
    (await step('grant', async ({ phase, submitted }) => {
      const wsId = record.wsId;
      if (!wsId) throw new Error('The workspace id is not known yet.');
      const { writer: vendorWriter } = await deps.api.health();
      await commit({ ...record, vendorWriter });
      if (await deps.reader.canWrite(wsId, vendorWriter)) {
        return { note: `${vendorWriter} can already write, so no transaction was needed.` };
      }
      phase('wallet');
      const granted = await (await deps.writer()).grantWriter(wsId, vendorWriter, {
        onSubmitted: submitted,
      });
      return { txHash: granted.hash, blockNumber: Number(granted.blockNumber) };
    })) &&
    (await step('register', async () => {
      const { wsId, keyB64, ownerAddress } = record;
      if (!wsId || !keyB64 || !ownerAddress) throw new Error('Earlier steps have not finished.');
      await deps.api.registerWorkspace(wsId);
      const workspace: WorkspaceRecord = {
        wsId,
        role: 'owner',
        label: record.label,
        keyB64,
        memberId: record.memberId,
        displayName: record.displayName,
        ownerAddress,
        writerRevoked: false,
        createdAt: Date.now(),
      };
      await db.workspaces.put(workspace);
      return { note: 'Vendor A confirmed the workspace on Portaldot.' };
    })) &&
    (await step('invite', async () => ({ note: 'Share the link below with your team.' }))));
  return record;
}
