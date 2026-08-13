/**
 * Tron (Shasta Testnet) Deployment Script
 *
 * This script uses TronWeb to deploy the Escrow contract on Tron.
 * The Solidity code is identical — only the deployment tooling differs.
 *
 * Prerequisites:
 *   npm install tronweb
 *
 * Usage:
 *   node scripts/deploy-tron.js
 *
 * Environment variables:
 *   TRON_PRIVATE_KEY      — your Tron private key
 *   TRON_FULL_NODE        — RPC URL (default: Shasta testnet)
 *   TRON_TOKEN_ADDRESS    — TRC20 token address (optional; deploys mock if not set)
 */

TRON_PRIVATE_KEY='1da28f16cd038328a153a84474cdabdf736bfe7ea75742a52da14ba2c556b94e' 
TRON_FULL_NODE='https://api.trongrid.io'
TRON_TOKEN_ADDRESS='TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

const TronWeb = require("tronweb");
const fs      = require("fs");
const path    = require("path");

// ─── Configuration ──────────────────────────────────────────────────
const SHASTA_FULL_NODE     = "https://api.shasta.trongrid.io";
const SHASTA_SOLIDITY_NODE = "https://api.shasta.trongrid.io";
const SHASTA_EVENT_SERVER  = "https://api.shasta.trongrid.io";

// Known USDT on Shasta (update if needed)
const SHASTA_USDT = "TG3XXyExBkPp9nzdajDZsozEu1Bxo8CLPY";

async function main() {
  const privateKey = process.env.TRON_PRIVATE_KEY;
  if (!privateKey) {
    console.error("Error: Set TRON_PRIVATE_KEY environment variable.");
    process.exit(1);
  }

  const tronWeb = new TronWeb({
    fullHost: process.env.TRON_FULL_NODE || SHASTA_FULL_NODE,
    privateKey: privateKey,
  });

  const deployerAddress = tronWeb.address.fromPrivateKey(privateKey);
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Escrow Deployment — Tron Shasta Testnet");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Deployer: ${deployerAddress}`);

  // ─── Load compiled contract ───────────────────────────────────────
  // First compile with: npx hardhat compile
  const artifactPath = path.join(__dirname, "../artifacts/contracts/Escrow.sol/Escrow.json");
  if (!fs.existsSync(artifactPath)) {
    console.error("Error: Contract not compiled. Run `npx hardhat compile` first.");
    process.exit(1);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // ─── Determine token address ──────────────────────────────────────
  let tokenAddress = process.env.TRON_TOKEN_ADDRESS || SHASTA_USDT;
  console.log(`  Token: ${tokenAddress}`);

  // ─── Deploy ───────────────────────────────────────────────────────
  console.log("\n  → Deploying Escrow...");

  // TronWeb expects the ABI and bytecode separately
  const contract = await tronWeb.contract().new({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    parameters: [tokenAddress],
    feeLimit: 100000000, // 100 TRX fee limit
  });

  const escrowAddress = tronWeb.address.fromHex(contract.address);
  console.log(`  ✓ Escrow deployed at: ${escrowAddress}`);

  // ─── Summary ──────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  Deployment Complete!");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Escrow (hex)    : ${contract.address}`);
  console.log(`  Escrow (base58) : ${escrowAddress}`);
  console.log(`  Token           : ${tokenAddress}`);
  console.log(`  Explorer        : https://shasta.tronscan.org/#/contract/${escrowAddress}`);
  console.log("═══════════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
