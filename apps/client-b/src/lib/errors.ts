import { describeRegistryError } from '@packout/sdk';

const REJECTED_CODE = 4001;

/** A plain sentence for any failure the owner can see: wallet refusal, contract revert or transport. */
export function describeFailure(error: unknown): string {
  let cause: unknown = error;
  while (cause instanceof Error) {
    const code = 'code' in cause ? cause.code : undefined;
    if (cause.name === 'UserRejectedRequestError' || code === REJECTED_CODE) {
      return 'You rejected the request in your wallet. Nothing was sent.';
    }
    cause = cause.cause;
  }
  if (error instanceof Error && 'shortMessage' in error && typeof error.shortMessage === 'string') {
    return error.shortMessage;
  }
  return describeRegistryError(error).split('\n')[0] ?? 'Something went wrong.';
}
