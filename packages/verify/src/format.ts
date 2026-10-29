import type { Hex } from 'viem';
import { z } from 'zod';

const bytes32 = z
  .string()
  .regex(/^0x[0-9a-f]{64}$/)
  .transform((value) => value as Hex);
const id16 = z.string().regex(/^0x[0-9a-f]{32}$/);
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

// Extra constraints absent from the original prose are characterized against the
// public implementation in tests and documented in ARCHITECTURE.md's spec gaps.
export const bundleSchema = z
  .strictObject({
    format: z.literal('packout.bundle/1'),
    chainId: integer.positive(),
    registry: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/)
      .transform((value) => value as Hex),
    wsId: bytes32,
    schemaId: bytes32,
    envelopes: z.array(
      z
        .string()
        .regex(/^0x(?:[0-9a-f]{2})*$/)
        .transform((value) => value as Hex),
    ),
    checkpoint: z.strictObject({ count: integer, head: bytes32, blockNumber: integer }),
  })
  .refine((bundle) => bundle.checkpoint.count === bundle.envelopes.length, {
    path: ['checkpoint', 'count'],
    message: 'must equal the number of envelopes',
  });
export type Bundle = z.infer<typeof bundleSchema>;

const base = {
  v: z.literal(1),
  wsId: z.string().regex(/^0x[0-9a-f]{64}$/),
  opId: id16,
  ts: integer,
  author: z.strictObject({ memberId: id16, name: z.string().min(1).max(64) }),
};
export const opSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...base,
    type: z.literal('issue.create'),
    body: z.strictObject({
      title: z.string().min(1).max(200),
      description: z.string().max(5000),
    }),
  }),
  z.strictObject({
    ...base,
    type: z.literal('issue.setStatus'),
    body: z.strictObject({
      issueId: id16,
      status: z.enum(['open', 'in_progress', 'done']),
    }),
  }),
  z.strictObject({
    ...base,
    type: z.literal('comment.add'),
    body: z.strictObject({
      issueId: id16,
      text: z.string().min(1).max(5000),
    }),
  }),
]);
