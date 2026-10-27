import { createHash } from 'node:crypto';
import { z } from 'zod';

const metadataShape = z
  .object({
    metadata: z
      .object({
        v16: z
          .object({
            pallets: z.array(
              z
                .object({
                  name: z.string(),
                  storage: z
                    .object({
                      items: z.array(
                        z.object({ name: z.string(), fallback: z.string() }).passthrough(),
                      ),
                    })
                    .passthrough()
                    .nullable(),
                })
                .passthrough(),
            ),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();
/** The only state-dependent metadata field observed at spec 3002 is the
 * default EthBlockBuilderIR. All type IDs, constants, calls and other defaults
 * remain part of this compatibility fingerprint. The raw snapshot hash is
 * checked separately before this exception is considered. */
export function metadataFingerprint(value: unknown): string {
  const parsed = metadataShape.parse(value);
  const revive = parsed.metadata.v16.pallets.find((pallet) => pallet.name === 'Revive');
  const builder = revive?.storage?.items.find((item) => item.name === 'EthBlockBuilderIR');
  if (!builder) throw new Error('Pinned Revive.EthBlockBuilderIR metadata entry missing.');
  builder.fallback = 'DYNAMIC_BLOCK_BUILDER_STATE';
  return createHash('sha256').update(JSON.stringify(parsed)).digest('hex');
}
