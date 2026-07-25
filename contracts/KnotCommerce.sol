// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import {IACPHook} from "./interfaces/IACPHook.sol";

/// @title KNOT Commerce
/// @notice ERC-8183-compatible escrow kernel with explicit hook governance.
contract KnotCommerce is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ERC165Checker for address;

    enum JobStatus {
        Open,
        Funded,
        Submitted,
        Completed,
        Rejected,
        Expired
    }

    struct Job {
        uint256 id;
        address client;
        address provider;
        address evaluator;
        string description;
        uint256 budget;
        uint256 expiredAt;
        JobStatus status;
        address hook;
    }

    IERC20 public immutable paymentToken;
    uint256 public jobCounter;

    mapping(uint256 jobId => Job) private jobs;
    mapping(address hook => bool) public allowedHooks;

    error InvalidJob();
    error InvalidState();
    error InvalidRole();
    error InvalidAddress();
    error InvalidBudget();
    error ExpiryTooShort();
    error HookNotAllowed();
    error TransferInvariantFailed();

    event JobCreated(
        uint256 indexed jobId,
        address indexed client,
        address indexed provider,
        address evaluator,
        uint256 expiredAt,
        address hook
    );
    event ProviderSet(uint256 indexed jobId, address indexed provider);
    event BudgetSet(uint256 indexed jobId, uint256 amount);
    event JobFunded(uint256 indexed jobId, uint256 amount);
    event JobSubmitted(uint256 indexed jobId, bytes32 indexed deliverable);
    event JobCompleted(uint256 indexed jobId, bytes32 indexed reason);
    event JobRejected(uint256 indexed jobId, bytes32 indexed reason);
    event JobExpired(uint256 indexed jobId);
    event HookPermissionUpdated(address indexed hook, bool allowed);

    constructor(address paymentToken_, address initialOwner) Ownable(initialOwner) {
        if (paymentToken_ == address(0) || initialOwner == address(0)) {
            revert InvalidAddress();
        }
        paymentToken = IERC20(paymentToken_);
    }

    function setHookAllowed(address hook, bool allowed) external onlyOwner {
        if (hook == address(0)) revert InvalidAddress();
        if (allowed && !hook.supportsInterface(type(IACPHook).interfaceId)) {
            revert InvalidJob();
        }
        allowedHooks[hook] = allowed;
        emit HookPermissionUpdated(hook, allowed);
    }

    function createJob(
        address provider,
        address evaluator,
        uint256 expiredAt,
        string calldata description,
        address hook
    ) external nonReentrant returns (uint256 jobId) {
        if (evaluator == address(0)) revert InvalidAddress();
        if (expiredAt <= block.timestamp + 5 minutes) revert ExpiryTooShort();
        if (hook != address(0) && !allowedHooks[hook]) revert HookNotAllowed();

        jobId = ++jobCounter;
        jobs[jobId] = Job({
            id: jobId,
            client: msg.sender,
            provider: provider,
            evaluator: evaluator,
            description: description,
            budget: 0,
            expiredAt: expiredAt,
            status: JobStatus.Open,
            hook: hook
        });

        emit JobCreated(jobId, msg.sender, provider, evaluator, expiredAt, hook);
    }

    function setProvider(
        uint256 jobId,
        address provider,
        bytes calldata optParams
    ) external {
        Job storage job = _job(jobId);
        if (msg.sender != job.client) revert InvalidRole();
        if (job.status != JobStatus.Open || job.provider != address(0)) {
            revert InvalidState();
        }
        if (provider == address(0)) revert InvalidAddress();

        _before(job, this.setProvider.selector, abi.encode(provider, optParams));
        job.provider = provider;
        emit ProviderSet(jobId, provider);
        _after(job, this.setProvider.selector, abi.encode(provider, optParams));
    }

    function setBudget(
        uint256 jobId,
        uint256 amount,
        bytes calldata optParams
    ) external {
        Job storage job = _job(jobId);
        if (msg.sender != job.client && msg.sender != job.provider) {
            revert InvalidRole();
        }
        if (job.status != JobStatus.Open) revert InvalidState();
        if (amount == 0) revert InvalidBudget();

        _before(job, this.setBudget.selector, abi.encode(amount, optParams));
        job.budget = amount;
        emit BudgetSet(jobId, amount);
        _after(job, this.setBudget.selector, abi.encode(amount, optParams));
    }

    function fund(uint256 jobId, bytes calldata optParams) external nonReentrant {
        Job storage job = _job(jobId);
        if (msg.sender != job.client) revert InvalidRole();
        if (
            job.status != JobStatus.Open ||
            job.provider == address(0) ||
            job.budget == 0
        ) revert InvalidState();

        _before(job, this.fund.selector, abi.encode(job.budget, optParams));
        uint256 balanceBefore = paymentToken.balanceOf(address(this));
        paymentToken.safeTransferFrom(job.client, address(this), job.budget);
        if (paymentToken.balanceOf(address(this)) - balanceBefore != job.budget) {
            revert TransferInvariantFailed();
        }
        job.status = JobStatus.Funded;
        emit JobFunded(jobId, job.budget);
        _after(job, this.fund.selector, abi.encode(job.budget, optParams));
    }

    function submit(
        uint256 jobId,
        bytes32 deliverable,
        bytes calldata optParams
    ) external {
        Job storage job = _job(jobId);
        if (msg.sender != job.provider) revert InvalidRole();
        if (job.status != JobStatus.Funded || block.timestamp >= job.expiredAt) {
            revert InvalidState();
        }
        if (deliverable == bytes32(0)) revert InvalidJob();

        _before(job, this.submit.selector, abi.encode(deliverable, optParams));
        job.status = JobStatus.Submitted;
        emit JobSubmitted(jobId, deliverable);
        _after(job, this.submit.selector, abi.encode(deliverable, optParams));
    }

    function complete(
        uint256 jobId,
        bytes32 reason,
        bytes calldata optParams
    ) external nonReentrant {
        Job storage job = _job(jobId);
        if (msg.sender != job.evaluator) revert InvalidRole();
        if (job.status != JobStatus.Submitted || block.timestamp >= job.expiredAt) {
            revert InvalidState();
        }

        bytes memory hookData = abi.encode(reason, optParams);
        _before(job, this.complete.selector, hookData);
        job.status = JobStatus.Completed;
        paymentToken.safeTransfer(job.provider, job.budget);
        emit JobCompleted(jobId, reason);
        _after(job, this.complete.selector, hookData);
    }

    function reject(
        uint256 jobId,
        bytes32 reason,
        bytes calldata optParams
    ) external nonReentrant {
        Job storage job = _job(jobId);
        bool clientCanReject = msg.sender == job.client && job.status == JobStatus.Open;
        bool evaluatorCanReject = msg.sender == job.evaluator && (
            job.status == JobStatus.Funded || job.status == JobStatus.Submitted
        );
        if (!clientCanReject && !evaluatorCanReject) revert InvalidRole();

        _before(job, this.reject.selector, abi.encode(reason, optParams));
        bool funded = job.status == JobStatus.Funded || job.status == JobStatus.Submitted;
        job.status = JobStatus.Rejected;
        if (funded) paymentToken.safeTransfer(job.client, job.budget);
        emit JobRejected(jobId, reason);
        _after(job, this.reject.selector, abi.encode(reason, optParams));
    }

    function claimRefund(uint256 jobId, bytes calldata optParams) external nonReentrant {
        Job storage job = _job(jobId);
        if (block.timestamp < job.expiredAt) revert InvalidState();
        if (job.status != JobStatus.Funded && job.status != JobStatus.Submitted) {
            revert InvalidState();
        }

        _before(job, this.claimRefund.selector, optParams);
        job.status = JobStatus.Expired;
        paymentToken.safeTransfer(job.client, job.budget);
        emit JobExpired(jobId);
        _after(job, this.claimRefund.selector, optParams);
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        Job memory job = jobs[jobId];
        if (job.id == 0) revert InvalidJob();
        return job;
    }

    function _job(uint256 jobId) internal view returns (Job storage job) {
        job = jobs[jobId];
        if (job.id == 0) revert InvalidJob();
    }

    function _before(Job storage job, bytes4 selector, bytes memory data) internal {
        if (job.hook != address(0)) {
            IACPHook(job.hook).beforeAction(job.id, selector, data);
        }
    }

    function _after(Job storage job, bytes4 selector, bytes memory data) internal {
        if (job.hook != address(0)) {
            IACPHook(job.hook).afterAction(job.id, selector, data);
        }
    }
}

