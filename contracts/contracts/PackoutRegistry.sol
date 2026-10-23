// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Owner-controlled writer authority and ordered digest history for PACKOUT.
contract PackoutRegistry {
    struct Workspace {
        address owner;
        uint32 epoch;
        uint64 count;
        bytes32 head;
        bytes32 schemaId;
    }

    mapping(bytes32 wsId => Workspace) internal _workspaces;
    mapping(bytes32 wsId => mapping(uint32 epoch => mapping(address writer => bool))) internal _writers;

    uint256 public constant MAX_BATCH = 64;
    uint256 public constant MAX_ROTATION_WRITERS = 16;
    bytes32 public constant HEAD_DOMAIN = keccak256("packout.head.v1");

    event WorkspaceCreated(bytes32 indexed wsId, address indexed owner, bytes32 schemaId);
    event WriterGranted(bytes32 indexed wsId, uint32 indexed epoch, address indexed writer);
    event WriterRevoked(bytes32 indexed wsId, uint32 indexed epoch, address indexed writer);
    event EpochRotated(bytes32 indexed wsId, uint32 indexed epoch, address[] writers);
    event Appended(bytes32 indexed wsId, uint64 indexed index, address indexed author, uint32 epoch, bytes32 digest, bytes32 head);

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

    function workspaceId(address owner, bytes32 salt) public pure returns (bytes32) {
        return keccak256(abi.encode(owner, salt));
    }

    function createWorkspace(bytes32 salt, bytes32 schemaId) external returns (bytes32 wsId) {
        wsId = workspaceId(msg.sender, salt);
        Workspace storage ws = _workspaces[wsId];
        if (ws.owner != address(0)) revert WorkspaceExists(wsId);
        ws.owner = msg.sender;
        ws.schemaId = schemaId;
        emit WorkspaceCreated(wsId, msg.sender, schemaId);
    }

    function grantWriter(bytes32 wsId, address writer) external {
        Workspace storage ws = _ownedWorkspace(wsId);
        if (writer == address(0)) revert InvalidWriter(writer);
        _writers[wsId][ws.epoch][writer] = true;
        emit WriterGranted(wsId, ws.epoch, writer);
    }

    function revokeWriter(bytes32 wsId, address writer) external {
        Workspace storage ws = _ownedWorkspace(wsId);
        _writers[wsId][ws.epoch][writer] = false;
        emit WriterRevoked(wsId, ws.epoch, writer);
    }

    function rotateEpoch(bytes32 wsId, address[] calldata newWriters) external {
        Workspace storage ws = _ownedWorkspace(wsId);
        uint256 length = newWriters.length;
        if (length > MAX_ROTATION_WRITERS) revert TooManyWriters(length, MAX_ROTATION_WRITERS);
        uint32 epoch = ws.epoch + 1;
        ws.epoch = epoch;
        for (uint256 i; i < length; ++i) {
            address writer = newWriters[i];
            if (writer == address(0)) revert InvalidWriter(writer);
            _writers[wsId][epoch][writer] = true;
        }
        emit EpochRotated(wsId, epoch, newWriters);
    }

    function appendBatch(
        bytes32 wsId,
        uint64 expectedCount,
        bytes32 expectedHead,
        bytes32[] calldata digests
    ) external {
        Workspace storage ws = _existingWorkspace(wsId);
        uint32 epoch = ws.epoch;
        if (msg.sender != ws.owner && !_writers[wsId][epoch][msg.sender]) {
            revert NotWriter(wsId, msg.sender, epoch);
        }
        uint256 length = digests.length;
        if (length == 0) revert EmptyBatch();
        if (length > MAX_BATCH) revert BatchTooLarge(length, MAX_BATCH);
        uint64 count = ws.count;
        if (expectedCount != count) revert StaleCount(expectedCount, count);
        bytes32 head = ws.head;
        if (expectedHead != head) revert StaleHead(expectedHead, head);

        for (uint256 i; i < length; ++i) {
            bytes32 digest = digests[i];
            head = _nextHead(wsId, count, head, digest);
            emit Appended(wsId, count, msg.sender, epoch, digest, head);
            ++count;
        }
        // History lives in events. Only the final checkpoint is stored.
        ws.count = count;
        ws.head = head;
    }

    function getWorkspace(bytes32 wsId) external view returns (
        address owner, uint32 epoch, uint64 count, bytes32 head, bytes32 schemaId
    ) {
        Workspace storage ws = _existingWorkspace(wsId);
        return (ws.owner, ws.epoch, ws.count, ws.head, ws.schemaId);
    }

    function canWrite(bytes32 wsId, address account) external view returns (bool) {
        Workspace storage ws = _workspaces[wsId];
        return ws.owner != address(0) && (account == ws.owner || _writers[wsId][ws.epoch][account]);
    }

    function _existingWorkspace(bytes32 wsId) internal view returns (Workspace storage ws) {
        ws = _workspaces[wsId];
        if (ws.owner == address(0)) revert UnknownWorkspace(wsId);
    }

    function _ownedWorkspace(bytes32 wsId) internal view returns (Workspace storage ws) {
        ws = _existingWorkspace(wsId);
        if (msg.sender != ws.owner) revert NotOwner(wsId, msg.sender);
    }

    function _nextHead(bytes32 wsId, uint64 index, bytes32 prevHead, bytes32 digest) internal pure returns (bytes32) {
        return keccak256(abi.encode(HEAD_DOMAIN, wsId, index, prevHead, digest));
    }
}
