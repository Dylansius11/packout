// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PackoutRegistry} from "../PackoutRegistry.sol";

/// @dev Test-only exposure of the exact head step used by appendBatch.
contract HeadChainHarness is PackoutRegistry {
    function nextHead(bytes32 wsId, uint64 index, bytes32 prevHead, bytes32 digest) external pure returns (bytes32) {
        return _nextHead(wsId, index, prevHead, digest);
    }
}
