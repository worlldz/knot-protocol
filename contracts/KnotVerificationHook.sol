// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IACPHook} from "./interfaces/IACPHook.sol";

/// @title KNOT Verification Hook
/// @notice Blocks ERC-8183 completion unless a trusted verifier accepted the evidence.
contract KnotVerificationHook is AccessControl, IACPHook {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes4 public constant COMPLETE_SELECTOR =
        bytes4(keccak256("complete(uint256,bytes32,bytes)"));

    address public immutable commerceProtocol;

    struct Attestation {
        bytes32 evidenceHash;
        uint64 validUntil;
        bool accepted;
        bool consumed;
    }

    mapping(uint256 jobId => Attestation) public attestations;

    error OnlyCommerceProtocol();
    error EvidenceNotAttested(uint256 jobId);
    error EvidenceRejected(uint256 jobId);
    error EvidenceExpired(uint256 jobId);
    error EvidenceAlreadyConsumed(uint256 jobId);
    error EvidenceHashMismatch(bytes32 expected, bytes32 received);
    error InvalidAddress();
    error InvalidValidityWindow();

    event EvidenceAttested(
        uint256 indexed jobId,
        bytes32 indexed evidenceHash,
        bool accepted,
        uint64 validUntil,
        address indexed verifier
    );
    event EvidenceConsumed(uint256 indexed jobId, bytes32 indexed evidenceHash);

    constructor(address commerceProtocol_, address admin_, address verifier_) {
        if (
            commerceProtocol_ == address(0) ||
            admin_ == address(0) ||
            verifier_ == address(0)
        ) revert InvalidAddress();

        commerceProtocol = commerceProtocol_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(VERIFIER_ROLE, verifier_);
    }

    modifier onlyCommerceProtocol() {
        if (msg.sender != commerceProtocol) revert OnlyCommerceProtocol();
        _;
    }

    function attest(
        uint256 jobId,
        bytes32 evidenceHash,
        bool accepted,
        uint64 validUntil
    ) external onlyRole(VERIFIER_ROLE) {
        if (evidenceHash == bytes32(0)) revert EvidenceNotAttested(jobId);
        if (validUntil <= block.timestamp) revert InvalidValidityWindow();

        attestations[jobId] = Attestation({
            evidenceHash: evidenceHash,
            validUntil: validUntil,
            accepted: accepted,
            consumed: false
        });

        emit EvidenceAttested(jobId, evidenceHash, accepted, validUntil, msg.sender);
    }

    function beforeAction(
        uint256 jobId,
        bytes4 selector,
        bytes calldata data
    ) external view onlyCommerceProtocol {
        if (selector != COMPLETE_SELECTOR) return;

        (bytes32 reason, ) = abi.decode(data, (bytes32, bytes));
        Attestation memory proof = attestations[jobId];

        if (proof.evidenceHash == bytes32(0)) revert EvidenceNotAttested(jobId);
        if (proof.consumed) revert EvidenceAlreadyConsumed(jobId);
        if (!proof.accepted) revert EvidenceRejected(jobId);
        if (proof.validUntil < block.timestamp) revert EvidenceExpired(jobId);
        if (proof.evidenceHash != reason) {
            revert EvidenceHashMismatch(proof.evidenceHash, reason);
        }
    }

    function afterAction(
        uint256 jobId,
        bytes4 selector,
        bytes calldata data
    ) external onlyCommerceProtocol {
        if (selector != COMPLETE_SELECTOR) return;

        (bytes32 reason, ) = abi.decode(data, (bytes32, bytes));
        Attestation storage proof = attestations[jobId];
        if (proof.evidenceHash != reason) {
            revert EvidenceHashMismatch(proof.evidenceHash, reason);
        }

        proof.consumed = true;
        emit EvidenceConsumed(jobId, reason);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(AccessControl, IERC165) returns (bool) {
        return interfaceId == type(IACPHook).interfaceId || super.supportsInterface(interfaceId);
    }
}
