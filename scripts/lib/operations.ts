import { randomBytes } from 'node:crypto';
import { createOp, type Op } from '@packout/sdk';
import { bytesToHex, type Hex } from 'viem';

export function createDemoOperations(wsId: Hex): Op[] {
  const dina = { memberId: bytesToHex(randomBytes(16)), name: 'Dina' };
  const rafi = { memberId: bytesToHex(randomBytes(16)), name: 'Rafi' };
  const issue = createOp({
    wsId,
    author: dina,
    type: 'issue.create',
    body: {
      title: 'Migrate billing to the new provider',
      description: 'Keep the workspace history when leaving the vendor.',
    },
  });
  return [
    issue,
    createOp({
      wsId,
      author: rafi,
      type: 'comment.add',
      body: {
        issueId: issue.opId,
        text: 'The history and the right to continue stay with our team.',
      },
    }),
    createOp({
      wsId,
      author: dina,
      type: 'issue.setStatus',
      body: { issueId: issue.opId, status: 'in_progress' },
    }),
  ];
}
