export type PackoutErrorCode =
  | 'malformed-envelope'
  | 'decrypt-failed'
  | 'workspace-mismatch'
  | 'unknown-op-type'
  | 'invalid-op'
  | 'invalid-bundle'
  | 'invalid-workspace-key'
  | 'invalid-key-shares';

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
