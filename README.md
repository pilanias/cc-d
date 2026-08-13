# 🔒 Escrow System — Decentralized P2P Token Escrow

A minimal, gas-efficient escrow smart contract for P2P trading platforms. Works on **Ethereum**, **BNB Chain**, and **Tron** (all using Solidity / ERC20-compatible tokens).

## How It Works

```
┌──────────┐   approve()   ┌───────────┐   executeTransfer()   ┌───────────┐
│  User /   │ ───────────→  │  Escrow   │ ────────────────────→ │ Seller /  │
│  Buyer    │               │  Contract │                       │ Recipient │
└──────────┘               └───────────┘                       └───────────┘
     │                           │
     │  ERC20 approve(spender)   │  Admin calls transferFrom
     │                           │  (contract never holds funds)
```

1. **Admin** deploys the contract with the target token address (e.g. USDT).
2. **User** calls `token.approve(escrowAddress, amount)` to authorize the contract.
3. **Admin** calls `executeTransfer(user, seller, amount)` to move tokens from user → seller.
4. The contract never holds tokens — it's a pure pass-through spender.

## Project Structure

```
escrow-system/
├── contracts/
│   ├── Escrow.sol          # Main escrow contract
│   ├── IERC20.sol          # Minimal ERC20 interface
│   └── MockERC20.sol       # Mock token for testing
├── test/
│   └── Escrow.test.js      # Comprehensive unit tests (20+ cases)
├── scripts/
│   ├── deploy.js           # Deploy to Ethereum/BNB (Hardhat)
│   └── deploy-tron.js      # Deploy to Tron (TronWeb)
├── frontend/
│   └── index.html          # Minimal web UI (MetaMask + TronLink)
├── hardhat.config.js       # Hardhat configuration
├── package.json
├── .env.example            # Environment variable template
└── README.md
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Compile Contracts

```bash
npx hardhat compile
```

### 3. Run Tests

```bash
npx hardhat test
```

Expected output: all 20+ tests passing.

### 4. Start Local Node (optional)

```bash
npx hardhat node
```

### 5. Deploy Locally

```bash
# In a new terminal
npx hardhat run scripts/deploy.js --network localhost
```

## Testnet Deployment

### Prerequisites

1. Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

2. Get testnet ETH/BNB from faucets:
   - **Sepolia**: https://sepoliafaucet.com
   - **BSC Testnet**: https://testnet.bnbchain.org/faucet-smart

### Ethereum Sepolia

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

### BNB Chain Testnet

```bash
npx hardhat run scripts/deploy.js --network bscTestnet
```

### Tron Shasta Testnet

For Tron, the Solidity contract is identical — only the deployment tooling differs.

```bash
# Install TronWeb
npm install tronweb

# Compile first (Hardhat compiles the same Solidity)
npx hardhat compile

# Deploy
TRON_PRIVATE_KEY=your_key node scripts/deploy-tron.js
```

Get test TRX from: https://www.trongrid.io/shasta

## Smart Contract Details

### `Escrow.sol`

| Function | Access | Description |
|----------|--------|-------------|
| `constructor(address _token)` | — | Sets deployer as admin and token address |
| `executeTransfer(address from, address to, uint256 amount)` | Admin only | Moves tokens from `from` to `to` via `transferFrom` |
| `setToken(address newToken)` | Admin only | Updates the token address |
| `setAdmin(address newAdmin)` | Admin only | Transfers admin role |

### Events

- `TransferExecuted(from, to, amount, timestamp)` — emitted on successful transfer
- `AdminChanged(oldAdmin, newAdmin)` — emitted on admin change
- `TokenChanged(oldToken, newToken)` — emitted on token change

### Security Considerations

- **Admin-only execution**: only the admin address can call `executeTransfer`.
- **No funds held**: the contract never holds tokens; it's a pure spender.
- **Explicit checks**: validates allowance, balance, and addresses before calling `transferFrom`.
- **Reentrancy**: not a concern here since `transferFrom` on standard ERC20 tokens is not reentrant (no callbacks). The function makes a single external call and doesn't modify state after.
- **USDT compatibility**: the mock token mimics USDT's non-resetting allowance behavior.

## Frontend

Open `frontend/index.html` in a browser with MetaMask (for Ethereum/BNB) or TronLink (for Tron) installed.

### Features

- Connect wallet (auto-detects MetaMask vs TronLink)
- Configure escrow and token contract addresses
- User: approve tokens for the escrow contract
- Admin: execute transfer from user to recipient
- Shows transaction hashes with block explorer links

### Usage

1. Open the HTML file.
2. Paste your deployed escrow and token addresses in the Config section and click Save.
3. Click "Connect Wallet".
4. As a **user**: enter amount and click Approve.
5. As an **admin**: enter from/to/amount and click Execute Transfer.

## Contract Addresses (Testnets)

After deployment, record your contract addresses here:

| Network | Escrow Address | Token Address |
|---------|---------------|---------------|
| Sepolia | — | — |
| BSC Testnet | — | — |
| Tron Shasta | — | — |

## Verifying Contracts (Optional)

### Etherscan (Sepolia)

```bash
npx hardhat verify --network sepolia <ESCROW_ADDRESS> <TOKEN_ADDRESS>
```

### BscScan (BSC Testnet)

```bash
npx hardhat verify --network bscTestnet <ESCROW_ADDRESS> <TOKEN_ADDRESS>
```

## Admin Signals

The admin can be:
- An **EOA** (externally owned account) that manually calls `executeTransfer` — suitable for small-scale or manual operations.
- A **backend service** that calls the function via a wallet/keystore after verifying the trade off-chain.
- Another **smart contract** that implements more complex trade logic — just call `setAdmin()` to point to it.

## License

MIT
# cc-d
