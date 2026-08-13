// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IERC20.sol";

/**
 * @title Escrow
 * @notice Minimal escrow contract for P2P trading platforms.
 *
 *  Workflow:
 *    1. Admin deploys the contract with the target token address (e.g. USDT).
 *    2. User calls `token.approve(escrowAddress, amount)` from their wallet.
 *    3. Admin calls `executeTransfer(user, seller, amount)` to move tokens
 *       from the user to the seller once a trade is agreed upon.
 *
 *  The contract is intentionally minimal — it holds no funds itself and
 *  simply acts as an approved spender that only the admin can invoke.
 *
 *  Compatible with Ethereum, BNB Chain, and Tron (Solidity compiler).
 */
contract Escrow {
    // ─── State ────────────────────────────────────────────────────────
    address public admin;
    address public token;

    // ─── Events ───────────────────────────────────────────────────────
    event TransferExecuted(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);
    event TokenChanged(address indexed oldToken, address indexed newToken);

    // ─── Modifiers ────────────────────────────────────────────────────
    modifier onlyAdmin() {
        require(msg.sender == admin, "Escrow: caller is not admin");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────
    /**
     * @param _token  Address of the ERC20/TRC20 token (e.g. USDT).
     *                Pass address(0) to set the token later via setToken().
     */
    constructor(address _token) {
        admin = msg.sender;
        token = _token;
    }

    // ─── Core Functions ───────────────────────────────────────────────

    /**
     * @notice Transfer tokens from `from` to `to`.
     * @dev    Requires that `from` has approved this contract for at least
     *         `amount` tokens beforehand.
     * @param from    The user/seller who approved the escrow.
     * @param to      The recipient (e.g. buyer or seller).
     * @param amount  Number of tokens (in smallest unit) to transfer.
     */
    function executeTransfer(
        address from,
        address to,
        uint256 amount
    ) external onlyAdmin {
        require(token != address(0), "Escrow: token not set");
        require(from != address(0), "Escrow: from is zero address");
        require(to != address(0), "Escrow: to is zero address");
        require(amount > 0, "Escrow: amount must be > 0");

        IERC20 erc20 = IERC20(token);

        // Verify allowance and balance before calling transferFrom
        // to give clearer error messages.
        require(
            erc20.allowance(from, address(this)) >= amount,
            "Escrow: insufficient allowance"
        );
        require(
            erc20.balanceOf(from) >= amount,
            "Escrow: insufficient balance"
        );

        // Transfer tokens directly from the user to the recipient.
        // The contract never holds tokens itself.
        bool success = erc20.transferFrom(from, to, amount);
        require(success, "Escrow: transferFrom failed");

        emit TransferExecuted(from, to, amount, block.timestamp);
    }

    // ─── Admin Management ─────────────────────────────────────────────

    /**
     * @notice Change the token address.
     * @dev    Only callable by admin. Useful when the platform switches
     *         to a different stablecoin or uses a mock token for testing.
     */
    function setToken(address newToken) external onlyAdmin {
        require(newToken != address(0), "Escrow: zero address");
        emit TokenChanged(token, newToken);
        token = newToken;
    }

    /**
     * @notice Transfer admin role to a new address.
     * @dev    Two-step pattern would be safer for production;
     *         this single-step version keeps the contract minimal.
     */
    function setAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Escrow: zero address");
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }
}
