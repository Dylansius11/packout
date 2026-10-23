export type PackoutErrorCode =
  | 'malformed-envelope'
  | 'decrypt-failed'
  | 'workspace-mismatch'
  | 'unknown-op-type'
  | 'invalid-op';

export class PackoutError extends Error {
  constructor(
    readonly code: PackoutErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'PackoutError';
  }
}
