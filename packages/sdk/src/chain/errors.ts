import { packoutRegistryAbi } from './abi.ts';

export type RegistryErrorReason = Extract<
  (typeof packoutRegistryAbi)[number],
  { type: 'error' }
>['name'];

export class RegistryError extends Error {
  readonly name = 'RegistryError' as const;

  constructor(
    readonly reason: RegistryErrorReason,
    readonly args: readonly unknown[],
    options?: ErrorOptions,
  ) {
    super(reason, options);
  }
}

// Preserve transport/wallet errors; only ABI-recognized contract reverts are translated.
export function registryFailure(error: unknown): unknown {
  // PublicClient may come from a second viem peer installation. Class identity
  // is not portable across those copies; inspect its standard Error cause chain.
  let cause = error;
  while (cause instanceof Error) {
    if (cause.name === 'ContractFunctionRevertedError' && 'data' in cause) {
      const data = cause.data;
      if (data && typeof data === 'object' && 'errorName' in data) {
        const errorName = data.errorName;
        if (
          packoutRegistryAbi.some((entry) => entry.type === 'error' && entry.name === errorName)
        ) {
          const args = 'args' in data && Array.isArray(data.args) ? data.args : [];
          return new RegistryError(errorName as RegistryErrorReason, args, { cause: error });
        }
      }
    }
    cause = cause.cause;
  }
  return error;
}

const descriptions: Record<RegistryErrorReason, string> = {
  WorkspaceExists: 'This workspace already exists for this owner and salt.',
  UnknownWorkspace: 'This workspace does not exist in the selected registry.',
  NotOwner: 'Only the workspace owner can change writer permissions.',
  NotWriter: 'Write access revoked: this account is not an authorized writer in the current epoch.',
  InvalidWriter: 'A writer cannot be the zero address.',
  TooManyWriters: 'An epoch rotation can authorize at most 16 writers.',
  EmptyBatch: 'An append batch must contain at least one operation digest.',
  BatchTooLarge: 'An append batch can contain at most 64 operation digests.',
  StaleCount: 'The workspace history changed. Refresh its count and head before writing again.',
  StaleHead: 'The workspace head does not match. Refresh its history before writing again.',
};

export function describeRegistryError(error: unknown): string {
  if (error instanceof RegistryError) return descriptions[error.reason];
  return error instanceof Error ? error.message : String(error);
}
