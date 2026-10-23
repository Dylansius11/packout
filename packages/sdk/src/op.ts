import { randomBytes } from '@noble/ciphers/utils.js';
import { bytesToHex, type Hex } from 'viem';
import { z } from 'zod';
import { canonicalJson } from './canonical.ts';
import { PackoutError } from './errors.ts';

const memberIdSchema = z
  .string()
  .regex(/^0x[0-9a-f]{32}$/)
  .transform((value): Hex => value as Hex);
const workspaceSchema = z
  .string()
  .regex(/^0x[0-9a-f]{64}$/)
  .transform((value): Hex => value as Hex);
const authorSchema = z.strictObject({
  memberId: memberIdSchema,
  name: z.string().min(1).max(64),
});
const common = {
  v: z.literal(1),
  wsId: workspaceSchema,
  opId: memberIdSchema,
  ts: z.int().nonnegative(),
  author: authorSchema,
};
const statusSchema = z.enum(['open', 'in_progress', 'done']);
const opSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...common,
    type: z.literal('issue.create'),
    body: z.strictObject({ title: z.string().min(1).max(200), description: z.string().max(5000) }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('issue.setStatus'),
    body: z.strictObject({ issueId: memberIdSchema, status: statusSchema }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('comment.add'),
    body: z.strictObject({ issueId: memberIdSchema, text: z.string().min(1).max(5000) }),
  }),
]);

export type IssueStatus = z.infer<typeof statusSchema>;
export type OpAuthor = z.infer<typeof authorSchema>;
export type Op = z.infer<typeof opSchema>;
export type OpBody =
  | Pick<Extract<Op, { type: 'issue.create' }>, 'type' | 'body'>
  | Pick<Extract<Op, { type: 'issue.setStatus' }>, 'type' | 'body'>
  | Pick<Extract<Op, { type: 'comment.add' }>, 'type' | 'body'>;

function parseOp(value: unknown): Op {
  if (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string' &&
    value.type !== 'issue.create' &&
    value.type !== 'issue.setStatus' &&
    value.type !== 'comment.add'
  ) {
    throw new PackoutError('unknown-op-type', `Unsupported journal operation type: ${value.type}`);
  }
  const result = opSchema.safeParse(value);
  if (!result.success) {
    throw new PackoutError('invalid-op', 'Operation does not match packout.journal/1.', {
      cause: result.error,
    });
  }
  return result.data;
}

export function createOp(
  input: { wsId: Hex; author: OpAuthor; ts?: number; opId?: Hex } & OpBody,
): Op {
  return parseOp({
    ...input,
    v: 1,
    opId: input.opId === undefined ? bytesToHex(randomBytes(16)) : input.opId,
    ts: input.ts === undefined ? Date.now() : input.ts,
  });
}

export function encodeOp(op: Op): Uint8Array {
  return new TextEncoder().encode(canonicalJson(parseOp(op)));
}

export function decodeOp(bytes: Uint8Array): Op {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (cause) {
    throw new PackoutError('invalid-op', 'Operation is not valid UTF-8 JSON.', { cause });
  }
  return parseOp(value);
}
