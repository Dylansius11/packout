/** Waits for the RPC's finalized height to cover an included transaction, never just its receipt. */
export async function waitForFinalized(
  client: { getBlock(input: { blockTag: 'finalized' }): Promise<{ number: bigint | null }> },
  blockNumber: bigint,
  options: { timeoutMs?: number; pollMs?: number } = {},
): Promise<bigint> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const finalized = await client.getBlock({ blockTag: 'finalized' });
    if (finalized.number !== null && finalized.number >= blockNumber) return finalized.number;
    if (Date.now() >= deadline) {
      throw new Error(
        `Transaction included in block ${blockNumber} is not finalized yet: timeout after ${timeoutMs / 1000} seconds. It may finalize later; check the transaction hash before sending again.`,
      );
    }
    await new Promise<void>((resolve) =>
      setTimeout(resolve, Math.min(options.pollMs ?? 1000, Math.max(0, deadline - Date.now()))),
    );
  }
}
