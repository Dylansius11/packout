import {
  type ChainReader,
  createBundle,
  JOURNAL_SCHEMA_ID,
  serializeBundle,
  type VerificationReport,
  verifyBundle,
} from '@packout/sdk';
import type { Address, Hex } from 'viem';

export type ExportResult = {
  report: VerificationReport;
  /** Present only when every verification step passed: nothing unverified is ever offered for download. */
  bundleJson: string | null;
};

/** Builds a bundle from anchored envelopes, verifies it with the workspace key, and releases it only if it passes. */
export async function verifyBeforeExport(input: {
  wsId: Hex;
  key: Uint8Array;
  chain: ChainReader;
  chainId: number;
  registry: Address;
  envelopes: Hex[];
  checkpointBlock: number;
}): Promise<ExportResult> {
  const bundle = createBundle({
    chainId: input.chainId,
    registry: input.registry,
    wsId: input.wsId,
    schemaId: JOURNAL_SCHEMA_ID,
    envelopes: input.envelopes,
    checkpoint: { blockNumber: input.checkpointBlock },
  });
  const report = await verifyBundle({ bundle, key: input.key, chain: input.chain });
  return { report, bundleJson: report.ok ? serializeBundle(bundle) : null };
}
