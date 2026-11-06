// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title AgentPassVerifier — verified-human step-up authorization.
/// @notice Server-side chain link: our backend verifies a human's identity
///         (Privy email verification and/or an external verified-human flow),
///         then signs an EIP-712 assertion with the dedicated
///         `BACKEND_SIGNER` key (HSM/KMS-held, per docs/limits.md). The
///         on-chain verifier accepts ONLY that signature — a client-side
///         assertion is never authorization.
///         nonce-bound + replay-guarded; expiry enforced.
contract AgentPassVerifier {
    bytes32 public constant PROOF_TYPEHASH =
        keccak256("Proof(address user,uint8 tier,uint64 expiry,uint256 nonce)");

    struct Tier {
        uint128 perDrawCapWad; // 2x the standard cap for 24h
        uint16 maxDrawsPerWindow; // 6 instead of 3
    }

    mapping(address => uint256) public usedNonces;
    mapping(address => uint256) public lastValidatedAt;
    address public owner;
    address public backendSigner;
    address public engine; // the only contract allowed to consume a proof result

    error NotOwner();
    error ReplayedProof();
    error ExpiredProof();
    error NotEngine();
    error BadSignature();

    event ProofValidated(address indexed user, uint8 tier, uint64 expiry, uint256 nonce);
    event ProofConsumed(address indexed user, uint8 tier);

    constructor(address backendSigner_, address engine_) {
        owner = msg.sender;
        backendSigner = backendSigner_;
        engine = engine_;
    }

    function setBackendSigner(address s) external {
        if (msg.sender != owner) revert NotOwner();
        backendSigner = s;
    }

    /// @notice Validate a backend-signed assertion for `user`. Callable by
    ///         ANYONE (it is permissionless to *check*), but consumption
    ///         requires the engine to call back `assertVerified`.
    function verifyBackendAssertion(address user, uint8 tier, uint64 expiry, uint256 nonce, bytes calldata signature)
        external
        view
        returns (bool ok)
    {
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", _domainSeparator(), keccak256(abi.encode(PROOF_TYPEHASH, user, tier, expiry, nonce)))
        );
        address recovered = _recover(digest, signature);
        ok = recovered == backendSigner && block.timestamp < expiry && usedNonces[user] != nonce;
    }

    /// @notice Called BY the engine after it checks the assertion's inputs;
    ///         burns the nonce and stamps `lastValidatedAt` for tier actions.
    function consume(address user, uint8 tier, uint64 expiry, uint256 nonce, bytes calldata signature) external {
        if (msg.sender != engine) revert NotEngine();
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", _domainSeparator(), keccak256(abi.encode(PROOF_TYPEHASH, user, tier, expiry, nonce)))
        );
        address recovered = _recover(digest, signature);
        if (recovered != backendSigner) revert BadSignature();
        if (usedNonces[user] == nonce) revert ReplayedProof();
        if (block.timestamp >= expiry) revert ExpiredProof();
        usedNonces[user] = nonce;
        lastValidatedAt[user] = block.timestamp;
        emit ProofValidated(user, tier, expiry, nonce);
    }

    /// @notice The engine checks the result is still fresh within expiry.
    function assertVerifiedAt(address user) external view returns (bool active) {
        // set at consume time; tier is valid 24h
        return lastValidatedAt[user] != 0 && block.timestamp < lastValidatedAt[user] + 24 hours;
    }

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("CashflowHook AgentPass")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function _recover(bytes32 digest, bytes calldata sig) private pure returns (address) {
        require(sig.length == 65, BadSignature());
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        // The backend signs EIP-191 personal messages (v ∈ {27,28}).
        require(v == 27 || v == 28, BadSignature());
        return ecrecover(digest, v, r, s);
    }
}
