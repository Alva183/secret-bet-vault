import { expect } from "chai";
import { ethers, deployments } from "hardhat";
import { VotingGame } from "../types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("VotingGame Sepolia Tests", function () {
  let votingGame: VotingGame;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  before(async function () {
    // Skip if not on Sepolia
    const networkName = (await ethers.provider.getNetwork()).name;
    if (networkName !== "sepolia") {
      this.skip();
    }

    [owner, user1, user2] = await ethers.getSigners();

    // Get deployed contract
    const deployment = await deployments.get("VotingGame");
    votingGame = await ethers.getContractAt("VotingGame", deployment.address);
  });

  describe("Sepolia Integration", function () {
    it("Should have an active round", async function () {
      const roundInfo = await votingGame.getCurrentRound();
      console.log("Current Round ID:", roundInfo.roundId.toString());
      console.log("Is Active:", roundInfo.isActive);
      console.log("Start Time:", new Date(Number(roundInfo.startTime) * 1000).toISOString());
      console.log("End Time:", new Date(Number(roundInfo.endTime) * 1000).toISOString());
      
      expect(roundInfo.roundId).to.be.gt(0);
    });

    it("Should show time remaining", async function () {
      const timeRemaining = await votingGame.getTimeRemaining();
      console.log("Time Remaining (seconds):", timeRemaining.toString());
      
      expect(timeRemaining).to.be.lte(5 * 60);
    });

    it("Should allow casting a vote", async function () {
      const minBet = ethers.parseEther("0.1");
      const roundId = await votingGame.currentRoundId();
      
      const hasVotedBefore = await votingGame.hasVoted(roundId, user1.address);
      
      if (!hasVotedBefore) {
        console.log("Casting vote for user1...");
        
        const tx = await votingGame.connect(user1).vote(true, { 
          value: minBet,
          gasLimit: 500000 
        });
        
        const receipt = await tx.wait();
        console.log("Vote cast! Gas used:", receipt?.gasUsed.toString());
        
        const hasVotedAfter = await votingGame.hasVoted(roundId, user1.address);
        expect(hasVotedAfter).to.be.true;
        
        const voteInfo = await votingGame.getUserVote(roundId, user1.address);
        console.log("Vote Info:", {
          hasVoted: voteInfo.hasVoted,
          isRed: voteInfo.isRed,
          amount: ethers.formatEther(voteInfo.amount)
        });
      } else {
        console.log("User1 has already voted in this round");
        this.skip();
      }
    });

    it("Should display current round statistics", async function () {
      const roundInfo = await votingGame.getCurrentRound();
      
      console.log("\n=== Current Round Statistics ===");
      console.log("Round ID:", roundInfo.roundId.toString());
      console.log("Total Red Amount:", ethers.formatEther(roundInfo.totalRedAmount), "ETH");
      console.log("Total Blue Amount:", ethers.formatEther(roundInfo.totalBlueAmount), "ETH");
      console.log("Total Participants:", roundInfo.participantCount.toString());
      console.log("Is Active:", roundInfo.isActive);
      console.log("Is Decrypted:", roundInfo.isDecrypted);
      console.log("================================\n");
    });

    it("Should retrieve past round results if available", async function () {
      const currentRoundId = await votingGame.currentRoundId();
      
      if (currentRoundId > 1n) {
        const pastRoundId = currentRoundId - 1n;
        const results = await votingGame.getRoundResults(pastRoundId);
        
        console.log("\n=== Past Round Results ===");
        console.log("Round ID:", pastRoundId.toString());
        console.log("Red Count:", results.redCount);
        console.log("Blue Count:", results.blueCount);
        console.log("Total Red Amount:", ethers.formatEther(results.totalRedAmount), "ETH");
        console.log("Total Blue Amount:", ethers.formatEther(results.totalBlueAmount), "ETH");
        console.log("Is Decrypted:", results.isDecrypted);
        console.log("==========================\n");
      } else {
        console.log("No past rounds available yet");
      }
    });
  });

  describe("Contract State", function () {
    it("Should have correct minimum bet", async function () {
      const minBet = await votingGame.MIN_BET();
      expect(minBet).to.equal(ethers.parseEther("0.1"));
      console.log("Minimum Bet:", ethers.formatEther(minBet), "ETH");
    });

    it("Should have correct round duration", async function () {
      const duration = await votingGame.ROUND_DURATION();
      expect(duration).to.equal(5 * 60);
      console.log("Round Duration:", duration.toString(), "seconds (", Number(duration) / 60, "minutes)");
    });
  });
});


