# PackoutRegistry: contract specification

One contract holds many workspaces. It is the referee for three facts no vendor may control: who owns a workspace, who may write in the current epoch, and the exact ordered history (count + running head). Operation contents never touch the chain; only 32-byte digests do, and only in events.

This file is the protocol. Solidity (`contracts/contracts/PackoutRegistry.sol`) and the SDK (`packages/sdk`) must agree with it byte for byte. Change it here first, in the same commit as the code.

## 1. Design choices and why

| Choice | Reason |
| --- | --- |
| History in events, not storage | Portaldot storage deposits are 0.06 tPOT per byte and 0.15 tPOT per item. Storing digests would cost every append; events cost only execution. |
| `wsId = keccak256(abi.encode(owner, salt))`, derived by the contract | A caller-chosen `wsId` can be front-run and squatted. Deriving it from `msg.sender` makes every id unique to its owner. |
| `epoch` is `uint32`, `count` is `uint64` | `owner (20) + epoch (4) + count (8) = 32 bytes`: one storage slot instead of two. 4 billion epochs is more than enough. |
| Writer flags keyed by epoch | `rotateEpoch` is O(new writers), not O(old writers): bumping the epoch makes every old flag unreachable without deleting it. |
| Owner can always append | The owner never needs to grant itself; after takeover Client B can write with the owner wallet alone. |
| `expectedCount` and `expectedHead` on every append | Optimistic concurrency: a writer that has not seen the latest op cannot fork history; it gets a typed revert and must resync. |
| No owner transfer, no pause, no upgrade proxy | Not in scope (PRD section 6). Fewer paths, fewer bugs, smaller code deposit. |

## 2. Storage

```solidity
struct Workspace {
    address owner;   // 20 bytes  ┐
    uint32  epoch;   //  4 bytes  ├ slot 0
    uint64  count;   //  8 bytes  ┘
    bytes32 head;    // slot 1
    bytes32 schemaId;// slot 2
}
mapping(bytes32 wsId => Workspace) internal _workspaces;
mapping(bytes32 wsId => mapping(uint32 epoch => mapping(address writer => bool))) internal _writers;

uint256 public constant MAX_BATCH = 64;
uint256 public constant MAX_ROTATION_WRITERS = 16;
bytes32 public constant HEAD_DOMAIN = keccak256("packout.head.v1");
```

A workspace exists iff `owner != address(0)`. A new workspace starts at `epoch = 0`, `count = 0`, `head = bytes32(0)`.

## 3. Head chain (the protocol)

For the op at zero-based position `index` with envelope digest `digest`:

```
head_index  = keccak256(abi.encode(HEAD_DOMAIN, wsId, uint64(index), head_(index-1), digest))
head_(-1)   = bytes32(0)
HEAD_DOMAIN = keccak256("packout.head.v1")
            = 0x10da955da60e60bc0c9ebc8c2ec92bf052d8ba642128801c6119a58b5b1ad792
```

`abi.encode` means standard ABI encoding: five 32-byte words, `uint64` left-padded with zeros. After an append of `n` digests starting at stored `count = c`, the stored head is `head_(c+n-1)` and `count = c + n`.

Shared vectors: `packages/sdk/test/vectors/head-chain.json`. The Hardhat tests and the Vitest suite both consume this file; neither generates it at test time.

## 4. Functions

| Function | Who | Effect | Reverts |
| --- | --- | --- | --- |
| `createWorkspace(bytes32 salt, bytes32 schemaId) returns (bytes32 wsId)` | anyone | `wsId = keccak256(abi.encode(msg.sender, salt))`; owner = `msg.sender` | `WorkspaceExists(wsId)` |
| `grantWriter(bytes32 wsId, address writer)` | owner | `_writers[wsId][epoch][writer] = true` | `UnknownWorkspace`, `NotOwner`, `InvalidWriter` (zero address) |
| `revokeWriter(bytes32 wsId, address writer)` | owner | `_writers[wsId][epoch][writer] = false` | `UnknownWorkspace`, `NotOwner` |
| `rotateEpoch(bytes32 wsId, address[] calldata newWriters)` | owner | `epoch++`, then grant each of `newWriters` in the new epoch. This is the one-tx "take over from the vendor". | `UnknownWorkspace`, `NotOwner`, `TooManyWriters(len, max)`, `InvalidWriter` |
| `appendBatch(bytes32 wsId, uint64 expectedCount, bytes32 expectedHead, bytes32[] calldata digests)` | owner or current-epoch writer | extends the head chain, emits one `Appended` per digest, stores final count and head | `UnknownWorkspace`, `NotWriter(wsId, caller, epoch)`, `EmptyBatch`, `BatchTooLarge(len, max)`, `StaleCount(expected, actual)`, `StaleHead(expected, actual)` |
| `getWorkspace(bytes32 wsId) view returns (address owner, uint32 epoch, uint64 count, bytes32 head, bytes32 schemaId)` | anyone | read | `UnknownWorkspace` |
| `canWrite(bytes32 wsId, address account) view returns (bool)` | anyone | owner or current-epoch writer; false for unknown workspace | none |
| `workspaceId(address owner, bytes32 salt) pure returns (bytes32)` | anyone | id derivation helper | none |

Check order in `appendBatch` (tests pin it): workspace exists, caller authorized, batch size, count, head.

## 5. Events

```solidity
event WorkspaceCreated(bytes32 indexed wsId, address indexed owner, bytes32 schemaId);
event WriterGranted(bytes32 indexed wsId, uint32 indexed epoch, address indexed writer);
event WriterRevoked(bytes32 indexed wsId, uint32 indexed epoch, address indexed writer);
event EpochRotated(bytes32 indexed wsId, uint32 indexed epoch, address[] writers);
event Appended(bytes32 indexed wsId, uint64 indexed index, address indexed author, uint32 epoch, bytes32 digest, bytes32 head);
```

`index` is indexed so a verifier can fetch the single `Appended` log for position `count - 1` by topic, without scanning history. `rotateEpoch` emits `EpochRotated` only (not a `WriterGranted` per writer).

## 6. Errors

```solidity
error WorkspaceExists(bytes32 wsId);
error UnknownWorkspace(bytes32 wsId);
error NotOwner(bytes32 wsId, address caller);
error NotWriter(bytes32 wsId, address caller, uint32 epoch);
error InvalidWriter(address writer);
error TooManyWriters(uint256 length, uint256 max);
error EmptyBatch();
error BatchTooLarge(uint256 length, uint256 max);
error StaleCount(uint64 expected, uint64 actual);
error StaleHead(bytes32 expected, bytes32 actual);
```

## 7. Compiler and target

Pinned after the Portaldot deploy spike (BUILD-PLAN 1.4, OPEN-DECISIONS D1). Until then: solc 0.8.28, optimizer 200 runs.

## 8. Cost on Portaldot testnet

Filled from observed receipts only (BUILD-PLAN 1.4). Native units: 1 tPOT = 10^14 planck; EVM units: 1 tPOT = 10^18 wei.

| Action | Gas used | Fee paid (tPOT) | Storage deposit (tPOT) | Tx |
| --- | --- | --- | --- | --- |
| deploy | | | | |
| createWorkspace | | | | |
| grantWriter | | | | |
| appendBatch (1 digest) | | | | |
| appendBatch (64 digests) | | | | |

## 9. Deployments

| Network | Chain id | Address | Deploy tx | Block | Compiler | Date |
| --- | --- | --- | --- | --- | --- | --- |
| Portaldot testnet v3 | 420420777 | | | | | |
