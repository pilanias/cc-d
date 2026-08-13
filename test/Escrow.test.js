const { expect } = require("chai");
const { ethers }  = require("hardhat");

describe("Escrow", function () {
  // ─── Shared state ──────────────────────────────────────────────────
  let escrow, token;
  let admin, user, recipient, other;

  const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1M tokens
  const TRADE_AMOUNT   = ethers.parseEther("20");      // 20 tokens

  // ─── Deploy fresh contracts before each test ───────────────────────
  beforeEach(async function () {
    [admin, user, recipient, other] = await ethers.getSigners();

    // Deploy mock token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("Mock USDT", "mUSDT", INITIAL_SUPPLY);
    await token.waitForDeployment();

    // Deploy escrow with the mock token
    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy(await token.getAddress());
    await escrow.waitForDeployment();

    // Transfer some tokens to the user so they can approve & trade
    await token.transfer(user.address, ethers.parseEther("1000"));
  });

  // ═══════════════════════════════════════════════════════════════════
  //  DEPLOYMENT
  // ═══════════════════════════════════════════════════════════════════
  describe("Deployment", function () {
    it("should set the deployer as admin", async function () {
      expect(await escrow.admin()).to.equal(admin.address);
    });

    it("should set the token address", async function () {
      expect(await escrow.token()).to.equal(await token.getAddress());
    });

    it("should allow deploying with zero address token (set later)", async function () {
      const Escrow = await ethers.getContractFactory("Escrow");
      const esc = await Escrow.deploy(ethers.ZeroAddress);
      await esc.waitForDeployment();
      expect(await esc.token()).to.equal(ethers.ZeroAddress);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  ACCESS CONTROL
  // ═══════════════════════════════════════════════════════════════════
  describe("Access Control", function () {
    it("should revert executeTransfer if caller is not admin", async function () {
      await expect(
        escrow.connect(user).executeTransfer(user.address, recipient.address, TRADE_AMOUNT)
      ).to.be.revertedWith("Escrow: caller is not admin");
    });

    it("should revert setToken if caller is not admin", async function () {
      await expect(
        escrow.connect(user).setToken(other.address)
      ).to.be.revertedWith("Escrow: caller is not admin");
    });

    it("should revert setAdmin if caller is not admin", async function () {
      await expect(
        escrow.connect(user).setAdmin(other.address)
      ).to.be.revertedWith("Escrow: caller is not admin");
    });

    it("should allow admin to call executeTransfer", async function () {
      // User approves escrow
      await token.connect(user).approve(await escrow.getAddress(), TRADE_AMOUNT);

      await expect(
        escrow.connect(admin).executeTransfer(user.address, recipient.address, TRADE_AMOUNT)
      ).to.not.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  TRANSFER FLOW
  // ═══════════════════════════════════════════════════════════════════
  describe("executeTransfer", function () {
    it("should transfer tokens from user to recipient after approval", async function () {
      const userBalBefore = await token.balanceOf(user.address);
      const recBalBefore  = await token.balanceOf(recipient.address);

      // User approves the escrow contract
      await token.connect(user).approve(await escrow.getAddress(), TRADE_AMOUNT);

      // Admin executes the transfer
      await escrow.executeTransfer(user.address, recipient.address, TRADE_AMOUNT);

      expect(await token.balanceOf(user.address)).to.equal(userBalBefore - TRADE_AMOUNT);
      expect(await token.balanceOf(recipient.address)).to.equal(recBalBefore + TRADE_AMOUNT);
    });

    it("should emit TransferExecuted event", async function () {
      await token.connect(user).approve(await escrow.getAddress(), TRADE_AMOUNT);

      const tx = await escrow.executeTransfer(user.address, recipient.address, TRADE_AMOUNT);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(escrow, "TransferExecuted")
        .withArgs(user.address, recipient.address, TRADE_AMOUNT, block.timestamp);
    });

    it("should revert when user has insufficient allowance", async function () {
      // Approve less than needed
      await token.connect(user).approve(await escrow.getAddress(), TRADE_AMOUNT - 1n);

      await expect(
        escrow.executeTransfer(user.address, recipient.address, TRADE_AMOUNT)
      ).to.be.revertedWith("Escrow: insufficient allowance");
    });

    it("should revert when user has insufficient balance", async function () {
      // Approve a huge amount, but user only has 1000 tokens
      const tooMuch = ethers.parseEther("2000");
      await token.connect(user).approve(await escrow.getAddress(), tooMuch);

      await expect(
        escrow.executeTransfer(user.address, recipient.address, tooMuch)
      ).to.be.revertedWith("Escrow: insufficient balance");
    });

    it("should revert when amount is zero", async function () {
      await expect(
        escrow.executeTransfer(user.address, recipient.address, 0)
      ).to.be.revertedWith("Escrow: amount must be > 0");
    });

    it("should revert when from is zero address", async function () {
      await expect(
        escrow.executeTransfer(ethers.ZeroAddress, recipient.address, TRADE_AMOUNT)
      ).to.be.revertedWith("Escrow: from is zero address");
    });

    it("should revert when to is zero address", async function () {
      await expect(
        escrow.executeTransfer(user.address, ethers.ZeroAddress, TRADE_AMOUNT)
      ).to.be.revertedWith("Escrow: to is zero address");
    });

    it("should revert when token is not set", async function () {
      const Escrow = await ethers.getContractFactory("Escrow");
      const esc = await Escrow.deploy(ethers.ZeroAddress);
      await esc.waitForDeployment();

      await expect(
        esc.executeTransfer(user.address, recipient.address, TRADE_AMOUNT)
      ).to.be.revertedWith("Escrow: token not set");
    });

    it("should handle multiple sequential transfers", async function () {
      const half = TRADE_AMOUNT / 2n;
      await token.connect(user).approve(await escrow.getAddress(), TRADE_AMOUNT);

      await escrow.executeTransfer(user.address, recipient.address, half);
      await escrow.executeTransfer(user.address, recipient.address, half);

      expect(await token.balanceOf(recipient.address)).to.equal(TRADE_AMOUNT);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  ADMIN MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════
  describe("setToken", function () {
    it("should update the token address", async function () {
      await escrow.setToken(other.address);
      expect(await escrow.token()).to.equal(other.address);
    });

    it("should emit TokenChanged event", async function () {
      const oldToken = await escrow.token();
      await expect(escrow.setToken(other.address))
        .to.emit(escrow, "TokenChanged")
        .withArgs(oldToken, other.address);
    });

    it("should revert with zero address", async function () {
      await expect(escrow.setToken(ethers.ZeroAddress))
        .to.be.revertedWith("Escrow: zero address");
    });
  });

  describe("setAdmin", function () {
    it("should update the admin address", async function () {
      await escrow.setAdmin(other.address);
      expect(await escrow.admin()).to.equal(other.address);
    });

    it("should emit AdminChanged event", async function () {
      await expect(escrow.setAdmin(other.address))
        .to.emit(escrow, "AdminChanged")
        .withArgs(admin.address, other.address);
    });

    it("should allow new admin to call executeTransfer", async function () {
      await escrow.setAdmin(other.address);
      await token.connect(user).approve(await escrow.getAddress(), TRADE_AMOUNT);

      await expect(
        escrow.connect(other).executeTransfer(user.address, recipient.address, TRADE_AMOUNT)
      ).to.not.be.reverted;
    });

    it("should revoke old admin's access", async function () {
      await escrow.setAdmin(other.address);

      await expect(
        escrow.connect(admin).executeTransfer(user.address, recipient.address, TRADE_AMOUNT)
      ).to.be.revertedWith("Escrow: caller is not admin");
    });

    it("should revert with zero address", async function () {
      await expect(escrow.setAdmin(ethers.ZeroAddress))
        .to.be.revertedWith("Escrow: zero address");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  //  EDGE CASES
  // ═══════════════════════════════════════════════════════════════════
  describe("Edge Cases", function () {
    it("should handle very large amounts", async function () {
      const largeAmount = ethers.parseEther("999000");
      // Admin has ~999,000 left after sending 1,000 to user in beforeEach.
      // Transfer directly from admin (who has the bulk of supply) to keep it simple.
      await token.connect(admin).approve(await escrow.getAddress(), largeAmount);
      await escrow.executeTransfer(admin.address, recipient.address, largeAmount);
      expect(await token.balanceOf(recipient.address)).to.equal(largeAmount);
    });

    it("should not hold tokens itself (pure pass-through)", async function () {
      await token.connect(user).approve(await escrow.getAddress(), TRADE_AMOUNT);
      await escrow.executeTransfer(user.address, recipient.address, TRADE_AMOUNT);

      const escrowBalance = await token.balanceOf(await escrow.getAddress());
      expect(escrowBalance).to.equal(0);
    });
  });

  // ─── Helpers ───────────────────────────────────────────────────────
  async function getBlockTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
  }
});
