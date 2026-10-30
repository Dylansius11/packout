import { z } from 'zod';

const responseSchema = z
  .object({
    jsonrpc: z.literal('2.0'),
    id: z.number().int().safe(),
    result: z.unknown().optional(),
    error: z
      .object({
        code: z.number().int(),
        message: z.string(),
        data: z.unknown().optional(),
      })
      .optional(),
  })
  .refine((response) => Object.hasOwn(response, 'result') !== Object.hasOwn(response, 'error'));

export function parseNativeRpcResponse(input: unknown) {
  const parsed = responseSchema.safeParse(input);
  if (!parsed.success) throw new Error('Native RPC returned a malformed JSON-RPC response.');
  return parsed.data;
}
