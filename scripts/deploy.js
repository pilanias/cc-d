const { ethers } = require("hardhat");

/**
 * Deployment script for the Escrow contract.
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network <network>
 *
 * Supported networks: localhost, sepolia, bscTestnet
 *
 * Environment variables:
 *   TOKEN_ADDRESS  — pre-existing USDT address on the target network.
 *                    If not set, deploys a MockERC20 for testing.
 *   ADMIN_ADDRESS  — address to receive admin role. Defaults to deployer.
 */

// Known USDT addresses on testnets (update if needed)
const USDT_ADDRESSES = {
  sepolia:    "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06", // Sepolia USDT (example)
  bscTestnet: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd", // BSC Testnet USDT
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const network    = hre.network.name;

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Escrow Deployment");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Network : ${network}`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log("───────────────────────────────────────────────────────────");

  // ─── Determine token address ──────────────────────────────────────
  let tokenAddress = process.env.TOKEN_ADDRESS;

  if (!tokenAddress && network === "localhost") {
    // Deploy a mock token for local testing
    console.log("\n  → No TOKEN_ADDRESS set; deploying MockERC20...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockToken = await MockERC20.deploy("Mock USDT", "mUSDT", ethers.parseEther("1000000"));
    await mockToken.waitForDeployment();
    tokenAddress = await mockToken.getAddress();
    console.log(`  ✓ MockERC20 deployed at: ${tokenAddress}`);
  } else if (!tokenAddress && USDT_ADDRESSES[network]) {
    tokenAddress = USDT_ADDRESSES[network];
    console.log(`\n  → Using known USDT on ${network}: ${tokenAddress}`);
  } else if (!tokenAddress) {
    console.log("\n  ⚠  No TOKEN_ADDRESS set and no known USDT for this network.");
    console.log("     Deploying Escrow with zero address; call setToken() later.");
    tokenAddress = ethers.ZeroAddress;
  }

  // ─── Determine admin address ──────────────────────────────────────
  const adminAddress = process.env.ADMIN_ADDRESS || deployer.address;
  console.log(`  Admin address: ${adminAddress}`);

  // ─── Deploy Escrow ────────────────────────────────────────────────
  console.log("\n  → Deploying Escrow...");
  const Escrow = await ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy(tokenAddress);
  await escrow.waitForDeployment();

  const escrowAddress = await escrow.getAddress();
  console.log(`  ✓ Escrow deployed at: ${escrowAddress}`);

  // ─── Transfer admin if needed ─────────────────────────────────────
  if (adminAddress !== deployer.address) {
    console.log(`\n  → Transferring admin to ${adminAddress}...`);
    const tx = await escrow.setAdmin(adminAddress);
    await tx.wait();
    console.log("  ✓ Admin transferred.");
  }

  // ─── Summary ──────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  Deployment Complete!");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Escrow contract : ${escrowAddress}`);
  console.log(`  Token address   : ${tokenAddress}`);
  console.log(`  Admin           : ${adminAddress}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // Return for programmatic use
  return { escrowAddress, tokenAddress, adminAddress };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
