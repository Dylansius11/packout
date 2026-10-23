import { type Address, type Hex, hexToBytes } from 'viem';
import { z } from 'zod';
import { envelopeDigest } from './envelope.ts';
import { PackoutError } from './errors.ts';
import { chainHeads, ZERO_HEAD } from './head.ts';

export const BUNDLE_FORMAT = 'packout.bundle/1';
const bytes32 = z
  .string()
  .regex(/^0x[0-9a-f]{64}$/)
  .transform((value): Hex => value as Hex);
const bundleSchema = z
  .strictObject({
    format: z.literal(BUNDLE_FORMAT),
    chainId: z.int().positive(),
    registry: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/)
      .transform((value): Address => value as Address),
    wsId: bytes32,
    schemaId: bytes32,
    envelopes: z.array(
      z
        .string()
        .regex(/^0x(?:[0-9a-f]{2})*$/)
        .transform((value): Hex => value as Hex),
    ),
    checkpoint: z.strictObject({
      count: z.int().nonnegative(),
      head: bytes32,
      blockNumber: z.int().nonnegative(),
    }),
  })
  .superRefine((bundle, context) => {
    if (bundle.checkpoint.count !== bundle.envelopes.length) {
      context.addIssue({
        code: 'custom',
        path: ['checkpoint', 'count'],
        message: `must equal the ${bundle.envelopes.length} encrypted operations in this file`,
      });
    }
  });

export type Bundle = z.infer<typeof bundleSchema>;

export function parseBundle(json: unknown): Bundle {
  let value = json;
  if (typeof json === 'string') {
    try {
      value = JSON.parse(json) as unknown;
    } catch (cause) {
      throw new PackoutError(
        'invalid-bundle',
        'This file is not a PACKOUT bundle v1: the file is not valid JSON.',
        { cause },
      );
    }
  }
  const result = bundleSchema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first.path.length > 0 ? first.path.join('.') : 'bundle';
    throw new PackoutError(
      'invalid-bundle',
      `This file is not a PACKOUT bundle v1: ${path} is missing or invalid (${first.message}).`,
      { cause: result.error },
    );
  }
  return result.data;
}

export function createBundle(
  input: Omit<Bundle, 'format' | 'checkpoint'> & { checkpoint: { blockNumber: number } },
): Bundle {
  const bundle = parseBundle({
    ...input,
    format: BUNDLE_FORMAT,
    checkpoint: { ...input.checkpoint, count: input.envelopes.length, head: ZERO_HEAD },
  });
  const digests = bundle.envelopes.map((envelope) => envelopeDigest(hexToBytes(envelope)));
  const heads = chainHeads(bundle.wsId, 0n, ZERO_HEAD, digests);
  bundle.checkpoint.head = heads.at(-1) ?? ZERO_HEAD;
  return bundle;
}

export function serializeBundle(bundle: Bundle): string {
  // Zod reconstructs these fixed fields in schema order, independent of insertion order.
  return JSON.stringify(parseBundle(bundle), null, 2);
}
