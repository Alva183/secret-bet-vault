import { expect } from "chai";
import { ethers } from "hardhat";
import { VotingGame } from "../types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("VotingGame", function () {
  let votingGame: VotingGame;
  let owner: HardhatEthersSigner;
  let addr1: HardhatEthersSigner;
  let addr2: HardhatEthersSigner;
  let addr3: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    const VotingGameFactory = await ethers.getContractFactory("VotingGame");
    votingGame = await VotingGameFactory.deploy();
    await votingGame.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should start the first round automatically", async function () {
      const currentRoundId = await votingGame.currentRoundId();
      expect(currentRoundId).to.equal(1);

      const roundInfo = await votingGame.getCurrentRound();
      expect(roundInfo.isActive).to.be.true;
    });

    it("Should set correct round duration", async function () {
      const roundInfo = await votingGame.getCurrentRound();
      const duration = roundInfo.endTime - roundInfo.startTime;
      expect(duration).to.equal(5 * 60); // 5 minutes
    });
  });

  describe("Voting", function () {
    it("Should allow voting with minimum bet", async function () {
      const minBet = ethers.parseEther("0.1");
      
      await expect(
        votingGame.connect(addr1).vote(true, { value: minBet })
      ).to.emit(votingGame, "VoteCast");

      const hasVoted = await votingGame.hasVoted(1, addr1.address);
      expect(hasVoted).to.be.true;
    });

    it("Should reject votes below minimum bet", async function () {
      const lowBet = ethers.parseEther("0.05");
      
      await expect(
        votingGame.connect(addr1).vote(true, { value: lowBet })
      ).to.be.revertedWith("Minimum bet is 0.1 ETH");
    });

    it("Should prevent double voting in same round", async function () {
      const minBet = ethers.parseEther("0.1");
      
      await votingGame.connect(addr1).vote(true, { value: minBet });
      
      await expect(
        votingGame.connect(addr1).vote(false, { value: minBet })
      ).to.be.revertedWith("Already voted in this round");
    });

    it("Should track red and blue amounts correctly", async function () {
      const redBet = ethers.parseEther("0.2");
      const blueBet = ethers.parseEther("0.3");
      
      await votingGame.connect(addr1).vote(true, { value: redBet });
      await votingGame.connect(addr2).vote(false, { value: blueBet });
      
      const roundInfo = await votingGame.getCurrentRound();
      expect(roundInfo.totalRedAmount).to.equal(redBet);
      expect(roundInfo.totalBlueAmount).to.equal(blueBet);
    });

    it("Should track multiple votes", async function () {
      const bet1 = ethers.parseEther("0.1");
      const bet2 = ethers.parseEther("0.2");
      const bet3 = ethers.parseEther("0.15");
      
      await votingGame.connect(addr1).vote(true, { value: bet1 });
      await votingGame.connect(addr2).vote(true, { value: bet2 });
      await votingGame.connect(addr3).vote(false, { value: bet3 });
      
      const roundInfo = await votingGame.getCurrentRound();
      expect(roundInfo.participantCount).to.equal(3);
      expect(roundInfo.totalRedAmount).to.equal(bet1 + bet2);
      expect(roundInfo.totalBlueAmount).to.equal(bet3);
    });
  });

  describe("Round Management", function () {
    it("Should not allow ending round before time", async function () {
      await expect(
        votingGame.endRound()
      ).to.be.revertedWith("Round not ended yet");
    });

    it("Should allow ending round after duration", async function () {
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [5 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);
      
      await expect(votingGame.endRound())
        .to.emit(votingGame, "RoundEnded");
      
      const currentRoundId = await votingGame.currentRoundId();
      expect(currentRoundId).to.equal(2);
    });

    it("Should start new round after ending previous", async function () {
      // Fast forward and end round
      await ethers.provider.send("evm_increaseTime", [5 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);
      await votingGame.endRound();
      
      const roundInfo = await votingGame.getCurrentRound();
      expect(roundInfo.isActive).to.be.true;
      expect(roundInfo.roundId).to.equal(2);
    });
  });

  describe("Results and Rewards", function () {
    beforeEach(async function () {
      // Cast some votes
      await votingGame.connect(addr1).vote(true, { value: ethers.parseEther("0.1") });
      await votingGame.connect(addr2).vote(false, { value: ethers.parseEther("0.2") });
      await votingGame.connect(addr3).vote(false, { value: ethers.parseEther("0.1") });
      
      // End the round
      await ethers.provider.send("evm_increaseTime", [5 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);
      await votingGame.endRound();
    });

    it("Should allow setting decrypted results", async function () {
      await votingGame.setDecryptedResults(1, 1, 2);
      
      const results = await votingGame.getRoundResults(1);
      expect(results.redCount).to.equal(1);
      expect(results.blueCount).to.equal(2);
      expect(results.isDecrypted).to.be.true;
    });

    it("Should not allow claiming before decryption", async function () {
      await expect(
        votingGame.connect(addr1).claimReward(1)
      ).to.be.revertedWith("Results not decrypted yet");
    });

    it("Should allow winners to claim rewards", async function () {
      // Set results: Red won (1 < 2)
      await votingGame.setDecryptedResults(1, 1, 2);
      
      const balanceBefore = await ethers.provider.getBalance(addr1.address);
      const tx = await votingGame.connect(addr1).claimReward(1);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(addr1.address);
      
      // Winner should receive proportional reward
      expect(balanceAfter).to.be.gt(balanceBefore - gasUsed);
    });

    it("Should not allow losers to claim rewards", async function () {
      // Set results: Red won (1 < 2)
      await votingGame.setDecryptedResults(1, 1, 2);
      
      await expect(
        votingGame.connect(addr2).claimReward(1)
      ).to.be.revertedWith("Did not win this round");
    });

    it("Should prevent double claiming", async function () {
      await votingGame.setDecryptedResults(1, 1, 2);
      
      await votingGame.connect(addr1).claimReward(1);
      
      await expect(
        votingGame.connect(addr1).claimReward(1)
      ).to.be.revertedWith("Reward already claimed");
    });
  });

  describe("View Functions", function () {
    it("Should return correct time remaining", async function () {
      const timeRemaining = await votingGame.getTimeRemaining();
      expect(timeRemaining).to.be.lte(5 * 60);
      expect(timeRemaining).to.be.gt(0);
    });

    it("Should return user vote info", async function () {
      await votingGame.connect(addr1).vote(true, { value: ethers.parseEther("0.15") });
      
      const voteInfo = await votingGame.getUserVote(1, addr1.address);
      expect(voteInfo.hasVoted).to.be.true;
      expect(voteInfo.isRed).to.be.true;
      expect(voteInfo.amount).to.equal(ethers.parseEther("0.15"));
    });
  });
});


