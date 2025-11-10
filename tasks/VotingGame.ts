import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("voting-game:status", "Get current voting game status").setAction(
  async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const deployment = await deployments.get("VotingGame");
    const votingGame = await ethers.getContractAt("VotingGame", deployment.address);

    console.log("\n=== Voting Game Status ===");
    console.log("Contract Address:", deployment.address);
    
    const currentRoundId = await votingGame.currentRoundId();
    console.log("Current Round ID:", currentRoundId.toString());
    
    const roundInfo = await votingGame.getCurrentRound();
    console.log("\nCurrent Round:");
    console.log("  Start Time:", new Date(Number(roundInfo.startTime) * 1000).toISOString());
    console.log("  End Time:", new Date(Number(roundInfo.endTime) * 1000).toISOString());
    console.log("  Total Red Amount:", ethers.formatEther(roundInfo.totalRedAmount), "ETH");
    console.log("  Total Blue Amount:", ethers.formatEther(roundInfo.totalBlueAmount), "ETH");
    console.log("  Participants:", roundInfo.participantCount.toString());
    console.log("  Is Active:", roundInfo.isActive);
    console.log("  Is Decrypted:", roundInfo.isDecrypted);
    
    const timeRemaining = await votingGame.getTimeRemaining();
    console.log("  Time Remaining:", timeRemaining.toString(), "seconds");
    console.log("==========================\n");
  }
);

task("voting-game:vote", "Cast a vote")
  .addParam("choice", "Vote choice: 'red' or 'blue'")
  .addParam("amount", "Amount in ETH (minimum 0.1)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const [signer] = await ethers.getSigners();
    
    const deployment = await deployments.get("VotingGame");
    const votingGame = await ethers.getContractAt("VotingGame", deployment.address, signer);
    
    const isRed = taskArguments.choice.toLowerCase() === "red";
    const amount = ethers.parseEther(taskArguments.amount);
    
    console.log(`\nCasting ${taskArguments.choice} vote with ${taskArguments.amount} ETH...`);
    
    const tx = await votingGame.vote(isRed, { value: amount });
    const receipt = await tx.wait();
    
    console.log("Vote cast successfully!");
    console.log("Transaction Hash:", receipt?.hash);
    console.log("Gas Used:", receipt?.gasUsed.toString());
  });

task("voting-game:end-round", "End the current round").setAction(
  async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const [signer] = await ethers.getSigners();
    
    const deployment = await deployments.get("VotingGame");
    const votingGame = await ethers.getContractAt("VotingGame", deployment.address, signer);
    
    console.log("\nEnding current round...");
    
    const tx = await votingGame.endRound();
    const receipt = await tx.wait();
    
    console.log("Round ended successfully!");
    console.log("Transaction Hash:", receipt?.hash);
    console.log("New Round Started");
  }
);

task("voting-game:set-results", "Set decrypted results for a round")
  .addParam("round", "Round ID")
  .addParam("red", "Red vote count")
  .addParam("blue", "Blue vote count")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const [signer] = await ethers.getSigners();
    
    const deployment = await deployments.get("VotingGame");
    const votingGame = await ethers.getContractAt("VotingGame", deployment.address, signer);
    
    console.log(`\nSetting results for round ${taskArguments.round}...`);
    console.log(`Red: ${taskArguments.red}, Blue: ${taskArguments.blue}`);
    
    const tx = await votingGame.setDecryptedResults(
      taskArguments.round,
      taskArguments.red,
      taskArguments.blue
    );
    const receipt = await tx.wait();
    
    console.log("Results set successfully!");
    console.log("Transaction Hash:", receipt?.hash);
  });

task("voting-game:claim", "Claim reward from a won round")
  .addParam("round", "Round ID to claim from")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const [signer] = await ethers.getSigners();
    
    const deployment = await deployments.get("VotingGame");
    const votingGame = await ethers.getContractAt("VotingGame", deployment.address, signer);
    
    console.log(`\nClaiming reward from round ${taskArguments.round}...`);
    
    const tx = await votingGame.claimReward(taskArguments.round);
    const receipt = await tx.wait();
    
    console.log("Reward claimed successfully!");
    console.log("Transaction Hash:", receipt?.hash);
  });

task("voting-game:round-results", "Get results for a specific round")
  .addParam("round", "Round ID")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    
    const deployment = await deployments.get("VotingGame");
    const votingGame = await ethers.getContractAt("VotingGame", deployment.address);
    
    const results = await votingGame.getRoundResults(taskArguments.round);
    
    console.log(`\n=== Round ${taskArguments.round} Results ===`);
    console.log("Red Votes:", results.redCount);
    console.log("Blue Votes:", results.blueCount);
    console.log("Total Red Amount:", ethers.formatEther(results.totalRedAmount), "ETH");
    console.log("Total Blue Amount:", ethers.formatEther(results.totalBlueAmount), "ETH");
    console.log("Is Decrypted:", results.isDecrypted);
    
    if (results.isDecrypted) {
      const winner = results.redCount < results.blueCount ? "Red" : "Blue";
      console.log("Winner:", winner, "(minority side)");
    }
    console.log("=============================\n");
  });


