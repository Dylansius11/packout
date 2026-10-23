import { zValidator } from '@hono/zod-validator';
import { ENVELOPE_VERSION, type RegistryReader } from '@packout/sdk';
import { type Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import type { Address, Hex } from 'viem';
import { z } from 'zod';
import { type EnvelopeStore, StoreError } from './store.ts';

export interface VendorChain
  extends Pick<RegistryReader, 'chainId' | 'registry' | 'getWorkspace' | 'canWrite'> {
  writer: Address;
}
export interface AppOptions {
  store: EnvelopeStore;
  chain: VendorChain;
  corsOrigin?: string;
  onWorkspaceRegistered?: (wsId: Hex) => void;
}

const wsIdSchema = z
  .string()
  .regex(/^0x[0-9a-f]{64}$/, 'Workspace id must be 32 bytes of lowercase hex.')
  .transform((value): Hex => value as Hex);
const envelopeSchema = z
  .string()
  .min(84, 'Envelope must contain at least 41 bytes.')
  .max(32_770, 'Envelope must not exceed 16 KiB.')
  .regex(/^0x(?:[0-9a-f]{2})+$/, 'Envelope must be lowercase hexadecimal bytes.')
  .startsWith(
    `0x${ENVELOPE_VERSION.toString(16).padStart(2, '0')}`,
    'Only envelope version 0x01 is supported.',
  )
  .transform((value): Hex => value as Hex);
function validationFailure(
  result: { success: boolean; error?: { issues: { message: string }[] } },
  context: Context,
) {
  if (!result.success)
    return context.json(
      {
        error: {
          code: 'invalid-input',
          message: result.error?.issues[0]?.message ?? 'Request fields are missing or invalid.',
        },
      },
      400,
    );
}
const wsParam = zValidator('param', z.strictObject({ wsId: wsIdSchema }), validationFailure);
const pagination = z.strictObject({
  after: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export function createApp({
  store,
  chain,
  corsOrigin = 'http://localhost:5173',
  onWorkspaceRegistered,
}: AppOptions) {
  const app = new Hono();
  app.use(
    '*',
    cors({
      origin: corsOrigin,
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
    }),
  );
  app.onError((error, context) => {
    if (error instanceof StoreError)
      return context.json(
        { error: { code: error.code, message: error.message } },
        error.code === 'unknown-workspace' ? 404 : 409,
      );
    if (error instanceof HTTPException && error.status === 400)
      return context.json(
        { error: { code: 'invalid-input', message: 'The request must contain valid JSON.' } },
        400,
      );
    return context.json(
      {
        error: {
          code: 'server-error',
          message: 'Vendor A could not complete this request. Check the API and chain connection.',
        },
      },
      500,
    );
  });
  app.notFound((context) =>
    context.json(
      { error: { code: 'not-found', message: 'This API endpoint does not exist.' } },
      404,
    ),
  );
  app.get('/health', (context) =>
    context.json({
      ok: true,
      chainId: chain.chainId,
      registry: chain.registry,
      writer: chain.writer,
    }),
  );

  app.post(
    '/workspaces',
    zValidator('json', z.strictObject({ wsId: wsIdSchema }), validationFailure),
    async (context) => {
      const { wsId } = context.req.valid('json');
      const existing = store.getWorkspace(wsId);
      if (existing) return context.json({ workspace: existing });
      const workspace = await chain.getWorkspace(wsId);
      if (!workspace)
        return context.json(
          {
            error: {
              code: 'unknown-workspace',
              message: 'This workspace does not exist on the selected chain.',
            },
          },
          404,
        );
      if (!(await chain.canWrite(wsId, chain.writer)))
        return context.json(
          {
            error: {
              code: 'writer-not-granted',
              message: 'Grant the vendor writer permission before registering this workspace.',
            },
          },
          409,
        );
      const registered = store.registerWorkspace(wsId, chain.writer, workspace.count);
      if (registered.created) onWorkspaceRegistered?.(wsId);
      return context.json({ workspace: registered.workspace }, registered.created ? 201 : 200);
    },
  );

  app.get('/workspaces/:wsId', wsParam, (context) => {
    const workspace = store.getWorkspace(context.req.valid('param').wsId);
    if (!workspace)
      throw new StoreError('unknown-workspace', 'This workspace is not registered with Vendor A.');
    return context.json({ workspace });
  });

  app.post(
    '/workspaces/:wsId/envelopes',
    wsParam,
    zValidator('json', z.strictObject({ envelope: envelopeSchema }), validationFailure),
    (context) => {
      const { item, created } = store.submitEnvelope(
        context.req.valid('param').wsId,
        context.req.valid('json').envelope,
      );
      return context.json({ item }, created ? 202 : 200);
    },
  );

  app.get(
    '/workspaces/:wsId/envelopes',
    wsParam,
    zValidator('query', pagination, validationFailure),
    (context) => {
      const { wsId } = context.req.valid('param');
      if (!store.getWorkspace(wsId))
        throw new StoreError(
          'unknown-workspace',
          'This workspace is not registered with Vendor A.',
        );
      const { after, limit } = context.req.valid('query');
      const items = store.listEnvelopes(wsId, after, limit);
      return context.json({ items, nextAfter: items.at(-1)?.seq ?? after });
    },
  );
  return app;
}
