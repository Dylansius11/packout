import type { VerificationReport } from '@packout/sdk';
import { describe, expect, it } from 'vitest';
import { gates } from '../src/domain/gating.ts';

const owner = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const;
const stranger = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const;

function report(ok: boolean): VerificationReport {
  return {
    ok,
    steps: [],
    onChain: {
      owner,
      epoch: 1,
      count: 3n,
      head: `0x${'11'.repeat(32)}`,
      schemaId: `0x${'22'.repeat(32)}`,
    },
  };
}

describe('what the owner may do next', () => {
  it('locks Take over and Continue when any verification step failed, even for the owner', () => {
    const result = gates({ report: report(false), account: owner, takenOver: true });
    expect(result.takeoverScreen.open).toBe(false);
    expect(result.takeoverAction.open).toBe(false);
    expect(result.continueScreen.open).toBe(false);
    expect(result.writeAction.open).toBe(false);
  });

  it('locks everything before any verification has run', () => {
    const result = gates({ report: null, account: owner, takenOver: false });
    expect(result.takeoverScreen.open).toBe(false);
    expect(result.writeAction.open).toBe(false);
  });

  it('lets a verified workspace reach Take over, but only the owner wallet can send it', () => {
    const none = gates({ report: report(true), account: undefined, takenOver: false });
    expect(none.takeoverScreen.open).toBe(true);
    expect(none.takeoverAction).toEqual({ open: false, reason: 'Connect the owner wallet first.' });

    const wrong = gates({ report: report(true), account: stranger, takenOver: false });
    expect(wrong.takeoverAction.open).toBe(false);
    if (!wrong.takeoverAction.open) expect(wrong.takeoverAction.reason).toContain(owner);

    const right = gates({
      report: report(true),
      account: owner.toLowerCase() as typeof owner,
      takenOver: false,
    });
    expect(right.takeoverAction.open).toBe(true);
  });

  it('keeps Continue closed until the takeover happened, then needs the owner wallet to write', () => {
    expect(
      gates({ report: report(true), account: owner, takenOver: false }).continueScreen.open,
    ).toBe(false);

    const wrong = gates({ report: report(true), account: stranger, takenOver: true });
    expect(wrong.continueScreen.open).toBe(true);
    expect(wrong.writeAction.open).toBe(false);

    expect(gates({ report: report(true), account: owner, takenOver: true }).writeAction.open).toBe(
      true,
    );
  });

  it('does not offer a second takeover', () => {
    const result = gates({ report: report(true), account: owner, takenOver: true });
    expect(result.takeoverAction.open).toBe(false);
  });
});
