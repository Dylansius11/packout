import type { Abi } from 'viem';

// Copied from the PackoutRegistry artifact; integration tests reject ABI drift.
export const packoutRegistryAbi = [
  {
    inputs: [
      { internalType: 'uint256', name: 'length', type: 'uint256' },
      { internalType: 'uint256', name: 'max', type: 'uint256' },
    ],
    name: 'BatchTooLarge',
    type: 'error',
  },
  { inputs: [], name: 'EmptyBatch', type: 'error' },
  {
    inputs: [{ internalType: 'address', name: 'writer', type: 'address' }],
    name: 'InvalidWriter',
    type: 'error',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'wsId', type: 'bytes32' },
      { internalType: 'address', name: 'caller', type: 'address' },
    ],
    name: 'NotOwner',
    type: 'error',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'wsId', type: 'bytes32' },
      { internalType: 'address', name: 'caller', type: 'address' },
      { internalType: 'uint32', name: 'epoch', type: 'uint32' },
    ],
    name: 'NotWriter',
    type: 'error',
  },
  {
    inputs: [
      { internalType: 'uint64', name: 'expected', type: 'uint64' },
      { internalType: 'uint64', name: 'actual', type: 'uint64' },
    ],
    name: 'StaleCount',
    type: 'error',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'expected', type: 'bytes32' },
      { internalType: 'bytes32', name: 'actual', type: 'bytes32' },
    ],
    name: 'StaleHead',
    type: 'error',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'length', type: 'uint256' },
      { internalType: 'uint256', name: 'max', type: 'uint256' },
    ],
    name: 'TooManyWriters',
    type: 'error',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'wsId', type: 'bytes32' }],
    name: 'UnknownWorkspace',
    type: 'error',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'wsId', type: 'bytes32' }],
    name: 'WorkspaceExists',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'wsId', type: 'bytes32' },
      { indexed: true, internalType: 'uint64', name: 'index', type: 'uint64' },
      { indexed: true, internalType: 'address', name: 'author', type: 'address' },
      { indexed: false, internalType: 'uint32', name: 'epoch', type: 'uint32' },
      { indexed: false, internalType: 'bytes32', name: 'digest', type: 'bytes32' },
      { indexed: false, internalType: 'bytes32', name: 'head', type: 'bytes32' },
    ],
    name: 'Appended',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'wsId', type: 'bytes32' },
      { indexed: true, internalType: 'uint32', name: 'epoch', type: 'uint32' },
      { indexed: false, internalType: 'address[]', name: 'writers', type: 'address[]' },
    ],
    name: 'EpochRotated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'wsId', type: 'bytes32' },
      { indexed: true, internalType: 'address', name: 'owner', type: 'address' },
      { indexed: false, internalType: 'bytes32', name: 'schemaId', type: 'bytes32' },
    ],
    name: 'WorkspaceCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'wsId', type: 'bytes32' },
      { indexed: true, internalType: 'uint32', name: 'epoch', type: 'uint32' },
      { indexed: true, internalType: 'address', name: 'writer', type: 'address' },
    ],
    name: 'WriterGranted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'wsId', type: 'bytes32' },
      { indexed: true, internalType: 'uint32', name: 'epoch', type: 'uint32' },
      { indexed: true, internalType: 'address', name: 'writer', type: 'address' },
    ],
    name: 'WriterRevoked',
    type: 'event',
  },
  {
    inputs: [],
    name: 'HEAD_DOMAIN',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MAX_BATCH',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MAX_ROTATION_WRITERS',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'wsId', type: 'bytes32' },
      { internalType: 'uint64', name: 'expectedCount', type: 'uint64' },
      { internalType: 'bytes32', name: 'expectedHead', type: 'bytes32' },
      { internalType: 'bytes32[]', name: 'digests', type: 'bytes32[]' },
    ],
    name: 'appendBatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'wsId', type: 'bytes32' },
      { internalType: 'address', name: 'account', type: 'address' },
    ],
    name: 'canWrite',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'salt', type: 'bytes32' },
      { internalType: 'bytes32', name: 'schemaId', type: 'bytes32' },
    ],
    name: 'createWorkspace',
    outputs: [{ internalType: 'bytes32', name: 'wsId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'wsId', type: 'bytes32' }],
    name: 'getWorkspace',
    outputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'uint32', name: 'epoch', type: 'uint32' },
      { internalType: 'uint64', name: 'count', type: 'uint64' },
      { internalType: 'bytes32', name: 'head', type: 'bytes32' },
      { internalType: 'bytes32', name: 'schemaId', type: 'bytes32' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'wsId', type: 'bytes32' },
      { internalType: 'address', name: 'writer', type: 'address' },
    ],
    name: 'grantWriter',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'wsId', type: 'bytes32' },
      { internalType: 'address', name: 'writer', type: 'address' },
    ],
    name: 'revokeWriter',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'wsId', type: 'bytes32' },
      { internalType: 'address[]', name: 'newWriters', type: 'address[]' },
    ],
    name: 'rotateEpoch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'bytes32', name: 'salt', type: 'bytes32' },
    ],
    name: 'workspaceId',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'pure',
    type: 'function',
  },
] as const satisfies Abi;
