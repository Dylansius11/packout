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

### 9.2 Native Succession gate (2026-10-30)

`pnpm spike:succession` passed on runtime `portaldot-v3` spec 3002 with no Solidity change. Workspace `0x006a543a453f1cefd62b7e48e18ddfc232d199ee9fef2725727adb613d373d6b` started at epoch 0/count 0 and ended at epoch 1/count 3. Owner stayed `H160(W) = 0x2d313fc3e31a90b4a23f0e4b15a7c37817d70dd1`. W's direct and N's inherited appends both emit that author; inherited rotation and append both have `RecoveredAccountControlled.call_result = {"ok":null}`. A successful outer dispatch alone was not accepted.

Native signer legend:
- W: `5D5Qw6HsJ7wK4APZF9TfqTSP5omBtLE1uF9YFgYyk1jLj9zE`
- N (single-key inheritor): `5Fmz3FWJLobF12fs1H4JURy64fMPcQUxBnAD1G78JCZ2Qj1u`
- B1: `5GxTzNMXgU3ceaxgQhpEA5Aq9BX3gANNqJcsYR5gzrETLqJx`
- B2: `5HQ9xiNgS5aE7i4dP9c1B1AtccPQQrFJu1kwVW6Wwi961r5F`
- B3: `5GsW1XQw3hNWSGB6P6TRN6DiVLhvTmcTFrrf5QTn6t1VAtQH`
- V: vendor `0x651dBB5965c6538AbC4027bEFAc3523FF28fF1a0`, native payer `5EMHXSkuyeDhMMVft4oZagVoRmJ8KZF2RhxqgdxiCYuEYMu5`.

In the EVM column, W means `H160(W)`, V means the vendor address, and `—` means no EVM execution. The native hash is an extrinsic hash, not an Ethereum transaction hash. Each block below finalized.

| Step | Signer | EVM caller | Dispatch | Extrinsic / EVM tx hash | Block |
| --- | --- | --- | --- | --- | --- |
| Forward 0.4 tPOT to N | W | — | Ok | `0x6627f4a69d048fae51bd0da18f907d5add08758e5d12f38f1d9bbb6676485511` | [248366](https://scanner-testnet-v3.portaldot.dev/#/blocks/248366) |
| Forward 0.2 tPOT to B1 | W | — | Ok | `0xabbd5b3b0e38359c566697a6638ab929d95553bb60ab8173911c49b2fc6dfecd` | [248369](https://scanner-testnet-v3.portaldot.dev/#/blocks/248369) |
| Forward 0.2 tPOT to B2 | W | — | Ok | `0x7cda96959be97cb395917123a33c6814645fe69e545e3c23b4da8ecd4232a78b` | [248372](https://scanner-testnet-v3.portaldot.dev/#/blocks/248372) |
| Forward 0.2 tPOT to B3 | W | — | Ok | `0x86c9bfbddcf3c1d2c0cf67dc26e4a8c91e8f7cf32e54e7f03cfb2ef75fb3fb0a` | [248375](https://scanner-testnet-v3.portaldot.dev/#/blocks/248375) |
| Create workspace | W | W | Ok | `0xbadddb1db76ae81619417ea75c5b95cb0bd5c8d224a0d282e66ea2c82838b755` | [248378](https://scanner-testnet-v3.portaldot.dev/#/blocks/248378) |
| Grant vendor | W | W | Ok | `0xe3a89df4621e0534573e4bae93310e1b9393bebc4a1fb71a9a22bb3e77fd1bba` | [248381](https://scanner-testnet-v3.portaldot.dev/#/blocks/248381) |
| Vendor append index 0 | V | V | Ok | `0xad90217111e8383ff1cea431eca0d7a4c162805349269b291ada3e8306670045` | [248384](https://scanner-testnet-v3.portaldot.dev/#/blocks/248384) |
| Native append index 1 (gate 1) | W | W | Ok | `0xedc73ca4b31cc9b393b736c13bd9f8c2864d51060d7e9c2bc80402a3a273b7ca` | [248387](https://scanner-testnet-v3.portaldot.dev/#/blocks/248387) |
| Configure friend group 2-of-3, delay 24 blocks | W | — | Ok | `0xe02b074e3ca4954df6d9e7c606e5977b93e77ddecca649b3ebeee8729a8de034` | [248394](https://scanner-testnet-v3.portaldot.dev/#/blocks/248394) |
| Initiate attempt A (first approval) | B1 | — | Ok | `0x802611fb527fc6116c2011648a3194ae3ce4b076a39f0e7d222a73590f1b9f8f` | [248397](https://scanner-testnet-v3.portaldot.dev/#/blocks/248397) |
| W cancels A | W | — | Ok | `0xf0aa382d601cbf47a8631358453b1f5d9191c2dddce80e80c2a75110afa0a0d8` | [248400](https://scanner-testnet-v3.portaldot.dev/#/blocks/248400) |
| Initiate B (first approval) | B1 | — | Ok | `0xada29515916d0706767c4c9d211f85917c42f55fb780c129e283a07247cdfd23` | [248403](https://scanner-testnet-v3.portaldot.dev/#/blocks/248403) |
| Finish with one approval | N | — | recovery.NotApproved | `0xbe64f0ae47013c5363f0a568a0aa2bfd5bea6d0d9f67349b8b4efad8411e26f5` | [248406](https://scanner-testnet-v3.portaldot.dev/#/blocks/248406) |
| Second approval | B2 | — | Ok | `0xd0cd4fcb5bb8bc571ff6703268a24cc8456e3f14744500f9595a90336d0924d1` | [248409](https://scanner-testnet-v3.portaldot.dev/#/blocks/248409) |
| Finish before delay | N | — | recovery.NotYetInheritable | `0x7bfdf66016b59aa0f02e221547b1906226b4832022493fe898141bec9d171cc5` | [248412](https://scanner-testnet-v3.portaldot.dev/#/blocks/248412) |
| Control before inheritance | N | — | recovery.NoInheritor | `0xdbcbb26fae6890647d80c91ff43d48de68a700d5f7c96254bc4af35aea09c49a` | [248415](https://scanner-testnet-v3.portaldot.dev/#/blocks/248415) |
| Finish after delay | N | — | Ok | `0xb858d5b409464b93ddf7042522df6c1ccfb8dc450b5753f4bd652c92a31d9650` | [248428](https://scanner-testnet-v3.portaldot.dev/#/blocks/248428) |
| Inherited rotateEpoch (gate 2) | N | W | Outer + inner Ok | `0x171c37c20671e7cee8327190fe7005f8bb41983d12ad08a69bea36acf4b8a9dc` | [248431](https://scanner-testnet-v3.portaldot.dev/#/blocks/248431) |
| Inherited append index 2 | N | W | Outer + inner Ok | `0x7e887a4437c0836abd94f453b4b34a4dc11a0b4de97061da3c4a134418a5f658` | [248434](https://scanner-testnet-v3.portaldot.dev/#/blocks/248434) |
| Vendor comeback | V | V | Reverted NotWriter, epoch 1 | `0x4dbab6f5e856bc6ebbee2b8b201589412218a5dad319e84d9fe3c5d8d41c7807` | [248437](https://scanner-testnet-v3.portaldot.dev/#/blocks/248437) |

Native gate block hashes: direct append `0xbb9ee31fd27a19b6cbe500bbec844093fc96995d9f917a74fcc1796b31b5bb26`; inherited rotation `0xd81e51a36aa09e2494951e0e79b6b9fb7f24b36450f3c410378b25144f74533d`; inherited append `0x55160debb9ceada6d95b75574eac28e485fc837b6fc4963a981ff3682854dc8d`.

Measured native free-balance reductions include storage plus transaction fees:

| Step | Payer | tPOT |
| --- | --- | --- |
| Create (7.683 storage) | W | 7.70460853881862 |
| Grant (3.8415 storage) | W | 3.86310820325165 |
| Direct append, existing head slot | W | 0.03370867260862 |
| Inherited rotation, no new storage | N | 0.02760852346663 |
| Inherited append, no new storage | N | 0.03720970129843 |

W's balance did not move for either inherited call; N paid those fees. This does **not** establish the payer of a nonzero inherited storage allocation, which was not exercised. Public evidence: gitignored `out/succession/2026-10-30T05-27-46.838Z/evidence.json` contains fee events, native origins, inner results and account hold deltas. Private `workspace.json` must not be published.

Funding: W received 25 tPOT from the founder (observed before the first spike) and a verified 10 tPOT project-deployer top-up, tx `0x6dd3953dedc2df612db06e0601dc3652886bf5cc11020ee92dd6aa557b3ebe81` in block 248354. The abandoned first attempt and its event-indexing diagnosis are recorded in INTEGRATIONS 6.8.

### 9.3 Key-recovery Succession demo (2026-10-30)

`pnpm demo:succession` reused the same workspace, explicitly revoked the spike's inheritor during setup, and added operations 3–5 without another workspace create deposit. The 2-of-3 group accepted **10-block inheritance and cancellation test delays** (~60 seconds); this is not a production policy or a proven minimum. After inherited rotation, two Shamir shares reconstructed the key; all six verifier checks passed on the then-complete five-operation history, including decryption. The recovered key encrypted operation 5, appended through N as W. Final state: epoch 2, count 6, unchanged owner `H160(W)`; vendor comeback reverted `NotWriter` and changed neither count nor head.

| Step | Signer | EVM caller | Dispatch | Extrinsic / EVM tx hash | Block |
| --- | --- | --- | --- | --- | --- |
| Revoke prior rehearsal inheritor | W | — | Ok | `0x835f93f344a617afe0bbda8594af3fbd0e006146e14e8add3d924a45751a1a94` | [248444](https://scanner-testnet-v3.portaldot.dev/#/blocks/248444) |
| Grant vendor in epoch 1 | W | W | Ok | `0x010358633d04fd1f1e546678f8b377e0c96286823cb7c2c9776a2ed464715dee` | [248447](https://scanner-testnet-v3.portaldot.dev/#/blocks/248447) |
| Vendor append index 3 | V | V | Ok | `0x43f32a35f066fce70b5dd9f6cb0262d9b0ef3a4d13206182dfaf5b0ca2d2723f` | [248450](https://scanner-testnet-v3.portaldot.dev/#/blocks/248450) |
| Native append index 4 | W | W | Ok | `0xd3f653513b9bba5dd491923579f81523257017e82e657a95f29c1718a66491fe` | [248453](https://scanner-testnet-v3.portaldot.dev/#/blocks/248453) |
| Configure 2-of-3, 10-block delays | W | — | Ok | `0x71d654bacbf848df26bd57cfc4b39de156cc95eb41fb9150d2e4398074cb6886` | [248456](https://scanner-testnet-v3.portaldot.dev/#/blocks/248456) |
| Initiate (first approval) | B1 | — | Ok | `0x9bd8b87d10c0a32f9615cc471cb0a1f3fbcbc94d4e2a2f45955ce818847ab03c` | [248459](https://scanner-testnet-v3.portaldot.dev/#/blocks/248459) |
| Second approval | B2 | — | Ok | `0x9631c2904937f1a478f49aefaa25537e635f7e3c62bf6594219624a3a03a2df2` | [248462](https://scanner-testnet-v3.portaldot.dev/#/blocks/248462) |
| Finish after delay | N | — | Ok | `0x338fe26cc18cf81ecf9fb3ef39a6464fe2857ba6791c124984624fd61cb4f992` | [248470](https://scanner-testnet-v3.portaldot.dev/#/blocks/248470) |
| Inherited rotate epoch 1 → 2 | N | W | Outer + inner Ok | `0x1d0602c778f52ed20141b038529946c7d2a3b1078096eac2acec89c6025f4b17` | [248474](https://scanner-testnet-v3.portaldot.dev/#/blocks/248474) |
| Recover key from two shares; inherited append index 5 | N | W | Outer + inner Ok | `0x221ef497c0882042e3a4df7fd7d8269affe5fafcc11ec996a12969b55f012c65` | [248479](https://scanner-testnet-v3.portaldot.dev/#/blocks/248479) |
| Vendor comeback | V | V | Reverted NotWriter, epoch 2 | `0x3de750162c758cfb3da22b7b212e330de9b7ec16aea6cb4211962457c9428211` | [248482](https://scanner-testnet-v3.portaldot.dev/#/blocks/248482) |

Public evidence: gitignored `out/succession/2026-10-30T05-35-43.091Z/evidence.json`, `keyPath = {threshold:2, backups:3, verified:true}`. Key reconstruction is local and has no transaction; its table row pairs it with the resulting continuation, not a claim of an on-chain key operation.

**Security boundary:** all backup keys/shares are on one machine for this headless rehearsal; independent custody/delivery has not been demonstrated. The in-memory owner key is cleared before recovery, but the private rehearsal checkpoint retains a copy and is not used for reconstruction. A Biome diagnostic exposed this test-only workspace key before `out` was excluded (`79ea018`); never use it for private data. No production key-loss or independent-custodian claim is made. Browser native-history integration remains open; opt-in SDK/CLI support is verified below.

Read-only follow-up at native finalized block 248509 confirmed owner `H160(W)`, epoch 2, count 6, head `0x5f1a4e891cb58d394ac4fa6c96e6a64ee3383fcb7164e1ed9f434e81f928a612`, `canWrite(vendor) = false`, inheritor N and the 2-of-3 friend group with both delays set to 10. A fresh `pnpm succession:preflight` re-fetched native block events and verified the complete saved ciphertext/key; W had 5.70457338301402 tPOT spendable, enough for its quoted 4.5 tPOT reuse budget. No additional funding was sent.

### 9.4 Independent native-history verification (2026-10-30)

Read-only verification of workspace `0x006a543a453f1cefd62b7e48e18ddfc232d199ee9fef2725727adb613d373d6b` passed in both `@packout/sdk/native` and the compiled independent CLI. Each verified all six checks, including decryption, on the six-operation history at epoch 2. No transaction was signed or submitted and no tPOT was spent.

The public bundle remains `packout.bundle/1`. Its native lookup sidecar references the real append blocks [248387](https://scanner-testnet-v3.portaldot.dev/#/blocks/248387), [248434](https://scanner-testnet-v3.portaldot.dev/#/blocks/248434), [248453](https://scanner-testnet-v3.portaldot.dev/#/blocks/248453) and [248479](https://scanner-testnet-v3.portaldot.dev/#/blocks/248479). Both implementations re-fetch canonical finalized node events and combine them with EVM admissions; sidecar contents are not accepted as event proof. Protocol, genesis pin and RPC trust boundary: INTEGRATIONS 6.9.

| Live scenario | SDK verdict | Compiled CLI verdict / exit |
| --- | --- | --- |
| Complete six-operation history and correct key | All six pass | All six pass / 0 |
| No key | Not exercised in this SDK smoke | Decryption SKIPPED / 0 |
| Wrong key | Decryption fails | Decryption fails / 1 |
| Last native block hint omitted | Anchored check fails | Anchored check fails / 1 |
| Stale five-operation bundle | Completeness fails | Completeness fails / 1 |
| Altered ciphertext | Head-chain check fails | Head-chain check fails / 1 |

Evidence: gitignored `out/native-verification/sdk-evidence.json` and `cli-evidence.json`; public `bundle.json` and `native-blocks.json` were exported through the production Succession helper. CLI verification used its default native WSS endpoint and each process exited on its own. Native HTTP returned intermittent gateway 503 errors during earlier probes and remains explicitly selectable, without automatic fallback. Local real-socket regressions cover HTTP abort, stalled WebSocket upgrade, an established silent peer and per-request cancellation. Wrong-network, noncanonical/future references, conflicting admissions, cache mutation and equal-count stored-head contradictions are covered by deterministic regressions. No Solidity or browser behavior changed.

