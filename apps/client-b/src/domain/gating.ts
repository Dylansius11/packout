import type { VerificationReport } from '@packout/sdk';
import type { Address } from 'viem';

export type Access = { open: true } | { open: false; reason: string };

export type Gates = {
  /** Reading the workspace and reaching the Take over screen needs a passing verification. */
  takeoverScreen: Access;
  /** Sending `rotateEpoch` also needs the owner's wallet, and is pointless twice. */
  takeoverAction: Access;
  continueScreen: Access;
  /** Appending operations needs the owner's wallet connected. */
  writeAction: Access;
};

const BLOCKED_BY_VERIFICATION =
  'Verification has not passed. Fix the failed check first: nothing can be changed on Portaldot from a history that does not verify.';

/**
 * One place that decides what the owner may do next, so a failed check or the wrong wallet cannot
 * be bypassed by a screen that forgot to look.
 */
export function gates(input: {
  report: VerificationReport | null;
  account: Address | undefined;
  takenOver: boolean;
}): Gates {
  const { report, account, takenOver } = input;
  const owner = report?.onChain?.owner;
  const verified = report?.ok === true && owner !== undefined;

  let walletBlock: string | null = null;
  if (verified) {
    if (account === undefined) {
      walletBlock = 'Connect the owner wallet first.';
    } else if (account.toLowerCase() !== owner.toLowerCase()) {
      walletBlock = `The connected wallet ${account} is not the owner of this workspace. The owner is ${owner}. Switch to that account in your wallet.`;
    }
  }

  const takeoverScreen: Access = verified
    ? { open: true }
    : { open: false, reason: BLOCKED_BY_VERIFICATION };
  const continueScreen: Access = !verified
    ? { open: false, reason: BLOCKED_BY_VERIFICATION }
    : takenOver
      ? { open: true }
      : { open: false, reason: 'Take over the workspace first.' };

  let takeoverAction: Access = { open: true };
  if (!verified) takeoverAction = { open: false, reason: BLOCKED_BY_VERIFICATION };
  else if (takenOver) {
    takeoverAction = { open: false, reason: 'This workspace has already been taken over.' };
  } else if (walletBlock) takeoverAction = { open: false, reason: walletBlock };

  let writeAction: Access = { open: true };
  if (!continueScreen.open) writeAction = continueScreen;
  else if (walletBlock) writeAction = { open: false, reason: walletBlock };

  return { takeoverScreen, takeoverAction, continueScreen, writeAction };
}
