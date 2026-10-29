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

Pinned by the Portaldot deploy (BUILD-PLAN 1.4, OPEN-DECISIONS D1): solc 0.8.28, EVM target `cancun`, optimizer 200 runs. Runtime bytecode is 3,068 bytes on-chain (3,096 bytes of initcode).

## 8. Cost on Portaldot testnet

All rows come from receipts observed on 2026-10-29 (BUILD-PLAN 1.4 and 7.4). Native units: 1 tPOT = 10^14 planck; EVM units: 1 tPOT = 10^18 wei.

pallet-revive folds weight and the storage deposit into one gas scalar, so the total is `gasUsed × effectiveGasPrice` (27,565 wei per gas on every tx here). Writes that create new storage pay its deposit; writes that only update existing slots cost cents.

| Action | Gas used | Total charged (tPOT) | What drives it | Tx |
| --- | --- | --- | --- | --- |
| deploy | 9,168,649,114,419,060 | 252.734 | Code deposit. A dry run (`ReviveApi_instantiate`) quoted 252.414 of storage deposit, so the rest is about 0.32 of fee | `0xb6031694794e71df4706ebb41962d3333f1f31e6c60349598f0c45e385c4969d` |
| createWorkspace | 279,390,929,776,592 | 7.701 | new workspace slots | `0x6be4bd7e792131d0e948072efec28ec1f92364aad2ab00e345ea2125578ee7e7` |
| grantWriter | 140,025,780,335,616 | 3.860 | new writer flag | `0x97ad8be4f267890e2c4211d3839227af12f9295d4a27041d1752b827bf262cf6` |
| appendBatch, first (3 digests) | 140,729,632,932,422 | 3.879 | first head/count write | `0xa1820b85d7b2bf28a888633bd35b93c865e61cd5202b998dc47ff454fd137e1c` |
| appendBatch, later (1 digest) | 1,132,479,098,578 | 0.031 | updates existing slots only | `0xc3e5da5b066995454036cb5f52e044fa959744b3fa61252c7456118628fafa16` |
| rotateEpoch(wsId, []) | 776,854,530,471 | 0.021 | updates existing slots only | `0x22e5dd0d48169cc727cd580e5c01d0bd83e4615867992ec4641d988ed71bf925` |
| appendBatch by revoked vendor (reverted, `NotWriter`) | 1,132,441,662,792 | 0.031 | gas forced from an earlier append (D10) | `0xda10f18edf2b1901d17d25fd0ca7c59d3a6d7458f3d52f1273010b2c86db8838` |

appendBatch with 64 digests is not measured yet.

## 9. Deployments

| Network | Chain id | Address | Deploy tx | Block | Compiler | Date |
| --- | --- | --- | --- | --- | --- | --- |
| Portaldot testnet v3 | 420420777 | `0xA76ae793b3a648b87F512aacbf7C4cE2eeac61E0` | `0xb6031694794e71df4706ebb41962d3333f1f31e6c60349598f0c45e385c4969d` | [238168](https://scanner-testnet-v3.portaldot.dev/#/blocks/238168) | 0.8.28, cancun, 200 runs | 2026-10-29 |

### 9.1 Recorded testnet runs

Deployer (owner) `0xb8c47dfB101938a0F57011aEf6EF5cC2CE97D859`, vendor writer `0x651dBB5965c6538AbC4027bEFAc3523FF28fF1a0`. Every tx below finalized with the expected status.

**`pnpm demo:checkin`** (BUILD-PLAN 1.5), workspace `0xbc91edc9a3921861f880e6d414b98050d1ca1c77b96220cb11c52e40345fb99e`. Restore verified all six checks; both tampered copies were refused (omitted op at "Anchored", flipped byte at "History integrity"). `eth_getLogs` returned the three `Appended` events.

| Step | Tx | Block |
| --- | --- | --- |
| createWorkspace | `0x6be4bd7e792131d0e948072efec28ec1f92364aad2ab00e345ea2125578ee7e7` | [238174](https://scanner-testnet-v3.portaldot.dev/#/blocks/238174) |
| grantWriter(vendor) | `0x97ad8be4f267890e2c4211d3839227af12f9295d4a27041d1752b827bf262cf6` | [238178](https://scanner-testnet-v3.portaldot.dev/#/blocks/238178) |
| vendor appendBatch (3 ops) | `0xa1820b85d7b2bf28a888633bd35b93c865e61cd5202b998dc47ff454fd137e1c` | [238182](https://scanner-testnet-v3.portaldot.dev/#/blocks/238182) |

**`pnpm demo:full`** (BUILD-PLAN 7.4, PRD section 4), workspace `0xf9997451ca021ee6f0ec7d6ce5aeb467372fc5e06ef4088b904feccc82b94649`. After takeover, `canWrite(vendor)` was false, the SDK simulation refused the vendor, and the forced vendor tx was mined as reverted with `NotWriter(wsId, vendor, 1)`. The old export then failed "Complete history" with 1 operation missing.

| Step | Tx | Block |
| --- | --- | --- |
| createWorkspace | `0x0e290affc47862c3b77d0e5b88f928bd87251043d2560c3658e225a78b9e56e8` | [238195](https://scanner-testnet-v3.portaldot.dev/#/blocks/238195) |
| grantWriter(vendor) | `0x92f54a3f7e82434290515c3be0f72cd9108425f33244c35d0778a4842e0cbddd` | [238198](https://scanner-testnet-v3.portaldot.dev/#/blocks/238198) |
| vendor appendBatch (3 ops) | `0x055de07800b0b934bffdcf3ac2f5fc0598f0109e6466486377884d515f8eb4e0` | [238201](https://scanner-testnet-v3.portaldot.dev/#/blocks/238201) |
| owner rotateEpoch(wsId, []) | `0x22e5dd0d48169cc727cd580e5c01d0bd83e4615867992ec4641d988ed71bf925` | [238204](https://scanner-testnet-v3.portaldot.dev/#/blocks/238204) |
| owner appendBatch at index 3 | `0xc3e5da5b066995454036cb5f52e044fa959744b3fa61252c7456118628fafa16` | [238207](https://scanner-testnet-v3.portaldot.dev/#/blocks/238207) |
| vendor appendBatch, reverted `NotWriter` | `0xda10f18edf2b1901d17d25fd0ca7c59d3a6d7458f3d52f1273010b2c86db8838` | [238210](https://scanner-testnet-v3.portaldot.dev/#/blocks/238210) |
