// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IACPHook} from "../interfaces/IACPHook.sol";

/// @notice Minimal ERC-8183 callback harness. It does not model escrow.
contract MockAgenticCommerce {
    IACPHook public hook;

    event JobCompleted(uint256 indexed jobId, bytes32 indexed reason);

    function setHook(address hook_) external {
        hook = IACPHook(hook_);
    }

    function complete(uint256 jobId, bytes32 reason, bytes calldata optParams) external {
        bytes memory data = abi.encode(reason, optParams);
        hook.beforeAction(jobId, this.complete.selector, data);
        emit JobCompleted(jobId, reason);
        hook.afterAction(jobId, this.complete.selector, data);
    }
}
