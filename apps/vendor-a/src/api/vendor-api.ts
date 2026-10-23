import type { Address, Hex } from 'viem';
import { z } from 'zod';

const address = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .transform((value) => value as Address);
const hex = z
  .string()
  .regex(/^0x[0-9a-f]*$/)
  .transform((value) => value as Hex);

const healthSchema = z.object({
  ok: z.literal(true),
  chainId: z.int(),
  registry: address,
  writer: address,
});
const workspaceSchema = z.object({
  wsId: hex,
  writer: address,
  writerState: z.enum(['active', 'revoked']),
  pending: z.int(),
  anchoredCount: z.int(),
  chainCount: z.int(),
  lastError: z.string().nullable(),
});
const itemSchema = z.object({
  seq: z.int(),
  digest: hex,
  envelope: hex,
  status: z.enum(['pending', 'anchored', 'rejected']),
  index: z.int().nullable(),
  txHash: hex.nullable(),
  blockNumber: z.int().nullable(),
  receivedAt: z.string(),
});
const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

export type VendorHealth = z.infer<typeof healthSchema>;
export type WorkspaceView = z.infer<typeof workspaceSchema>;
export type EnvelopeItem = z.infer<typeof itemSchema>;

/** The vendor answered, but not with success. `message` is a sentence meant for the UI. */
export class VendorApiError extends Error {
  readonly name = 'VendorApiError' as const;
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** The vendor did not answer at all. */
export class VendorUnreachableError extends Error {
  readonly name = 'VendorUnreachableError' as const;
  constructor(cause: unknown) {
    super('Vendor A is offline.', { cause });
  }
}

const REQUEST_TIMEOUT_MS = 10_000;

export interface VendorApi {
  health(): Promise<VendorHealth>;
  registerWorkspace(wsId: Hex): Promise<WorkspaceView>;
  /** Null when the vendor does not know this workspace yet. */
  getWorkspace(wsId: Hex): Promise<WorkspaceView | null>;
  postEnvelope(wsId: Hex, envelope: Hex): Promise<EnvelopeItem>;
  listEnvelopes(
    wsId: Hex,
    after: number,
    limit: number,
  ): Promise<{ items: EnvelopeItem[]; nextAfter: number }>;
}

export function createVendorApi(baseUrl: string): VendorApi {
  async function request<T>(
    method: 'GET' | 'POST',
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
  ): Promise<{ status: number; data: T }> {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (cause) {
      throw new VendorUnreachableError(cause);
    }
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new VendorApiError(
        response.status,
        'invalid-response',
        'Vendor A sent a response this app cannot read.',
      );
    }
    if (!response.ok) {
      const failure = errorSchema.safeParse(json);
      throw new VendorApiError(
        response.status,
        failure.success ? failure.data.error.code : 'http-error',
        failure.success
          ? failure.data.error.message
          : `Vendor A answered with status ${response.status}.`,
      );
    }
    const result = schema.safeParse(json);
    if (!result.success) {
      throw new VendorApiError(
        response.status,
        'invalid-response',
        'Vendor A sent a response in an unexpected format.',
      );
    }
    return { status: response.status, data: result.data };
  }

  return {
    async health() {
      return (await request('GET', '/health', healthSchema)).data;
    },
    async registerWorkspace(wsId) {
      const { data } = await request(
        'POST',
        '/workspaces',
        z.object({ workspace: workspaceSchema }),
        { wsId },
      );
      return data.workspace;
    },
    async getWorkspace(wsId) {
      try {
        const { data } = await request(
          'GET',
          `/workspaces/${wsId}`,
          z.object({ workspace: workspaceSchema }),
        );
        return data.workspace;
      } catch (error) {
        if (error instanceof VendorApiError && error.code === 'unknown-workspace') return null;
        throw error;
      }
    },
    async postEnvelope(wsId, envelope) {
      const { data } = await request(
        'POST',
        `/workspaces/${wsId}/envelopes`,
        z.object({ item: itemSchema }),
        {
          envelope,
        },
      );
      return data.item;
    },
    async listEnvelopes(wsId, after, limit) {
      const { data } = await request(
        'GET',
        `/workspaces/${wsId}/envelopes?after=${after}&limit=${limit}`,
        z.object({ items: z.array(itemSchema), nextAfter: z.int() }),
      );
      return data;
    },
  };
}
