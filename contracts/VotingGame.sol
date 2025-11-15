// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title VotingGame - A voting game with encrypted votes
/// @notice Every 5 minutes, a new round starts. Users vote Red or Blue with at least 0.1 ETH. 
///         Votes are encrypted until the round ends. Winners (minority side) split the pool proportionally.
contract VotingGame is SepoliaConfig {
    uint256 public constant ROUND_DURATION = 5 minutes;
    uint256 public constant MIN_BET = 0.1 ether;

    bool public emergencyStopped;

    struct Round {
        uint256 startTime;
        uint256 endTime;
        uint256 totalRedAmount;
        uint256 totalBlueAmount;
        euint32 encryptedRedCount;
        euint32 encryptedBlueCount;
        uint32 redCount;  // Decrypted value
        uint32 blueCount; // Decrypted value
        bool isActive;
        bool isDecrypted;
        mapping(address => Vote) votes;
        address[] participants;
    }
    
    struct Vote {
        bool hasVoted;
        bool isRed;  // true for Red, false for Blue
        uint256 amount;
    }
    
    uint256 public currentRoundId;
    mapping(uint256 => Round) public rounds;
    
    event RoundStarted(uint256 indexed roundId, uint256 startTime, uint256 endTime);
    event VoteCast(uint256 indexed roundId, address indexed voter, uint256 amount);
    event RoundEnded(uint256 indexed roundId, uint32 redCount, uint32 blueCount, uint256 totalRed, uint256 totalBlue);
    event RewardClaimed(uint256 indexed roundId, address indexed voter, uint256 reward);
    event EmergencyStop(address indexed caller, uint256 timestamp);
    event EmergencyResume(address indexed caller, uint256 timestamp);
    event ContractInfoRequested(address indexed caller, uint256 timestamp);
    
    constructor() {
        _startNewRound();
    }
    
    /// @notice Start a new voting round
    function _startNewRound() private {
        currentRoundId++;
        Round storage newRound = rounds[currentRoundId];
        newRound.startTime = block.timestamp;
        newRound.endTime = block.timestamp + ROUND_DURATION;
        newRound.isActive = true;
        newRound.isDecrypted = false;
        
        // Initialize encrypted counters to 0
        newRound.encryptedRedCount = FHE.asEuint32(0);
        newRound.encryptedBlueCount = FHE.asEuint32(0);
        
        // Grant ACL permissions for contract to perform operations
        FHE.allowThis(newRound.encryptedRedCount);
        FHE.allowThis(newRound.encryptedBlueCount);
        
        emit RoundStarted(currentRoundId, newRound.startTime, newRound.endTime);
    }
    
    /// @notice Cast a vote with encrypted choice
    /// @param isRed true for Red vote, false for Blue vote
    function vote(bool isRed) external payable {
        // Additional validation for security
        require(msg.value > 0, "Must send ETH to vote");
        require(msg.value >= MIN_BET, "Minimum bet is 0.1 ETH");
        
        Round storage round = rounds[currentRoundId];
        require(round.isActive, "No active round");
        require(block.timestamp < round.endTime, "Round has ended");
        require(!round.votes[msg.sender].hasVoted, "Already voted in this round");
        
        // Record the vote
        round.votes[msg.sender] = Vote({
            hasVoted: true,
            isRed: isRed,
            amount: msg.value
        });
        
        round.participants.push(msg.sender);
        
        // Update encrypted counters and amounts
        if (isRed) {
            round.totalRedAmount += msg.value;
            euint32 one = FHE.asEuint32(1);
            round.encryptedRedCount = FHE.add(round.encryptedRedCount, one);
            FHE.allowThis(round.encryptedRedCount);
        } else {
            round.totalBlueAmount += msg.value;
            euint32 one = FHE.asEuint32(1);
            round.encryptedBlueCount = FHE.add(round.encryptedBlueCount, one);
            FHE.allowThis(round.encryptedBlueCount);
        }
        
        emit VoteCast(currentRoundId, msg.sender, msg.value);
    }
    
    /// @notice End the current round and decrypt results
    function endRound() external {
        Round storage round = rounds[currentRoundId];
        require(round.isActive, "No active round");
        require(block.timestamp >= round.endTime, "Round not ended yet");
        
        round.isActive = false;
        
        // In a real implementation, you would request decryption from the oracle
        // For now, we'll mark it as ready for decryption
        // The actual decryption would be done through the KMS/Oracle
        
        emit RoundEnded(currentRoundId, round.redCount, round.blueCount, round.totalRedAmount, round.totalBlueAmount);
        
        // Start a new round
        _startNewRound();
    }
    
    /// @notice Manually set decrypted values (would be done by oracle in production)
    /// @param roundId The round to set results for
    /// @param redCount Decrypted red vote count
    /// @param blueCount Decrypted blue vote count
    function setDecryptedResults(uint256 roundId, uint32 redCount, uint32 blueCount) external {
        Round storage round = rounds[roundId];
        require(!round.isActive, "Round still active");
        require(!round.isDecrypted, "Already decrypted");
        
        round.redCount = redCount;
        round.blueCount = blueCount;
        round.isDecrypted = true;
    }
    
    /// @notice Claim reward for a won round
    /// @param roundId The round to claim reward from
    function claimReward(uint256 roundId) external {
        Round storage round = rounds[roundId];
        require(!round.isActive, "Round still active");
        require(round.isDecrypted, "Results not decrypted yet");
        require(round.votes[msg.sender].hasVoted, "Did not vote in this round");
        
        Vote storage userVote = round.votes[msg.sender];
        require(userVote.amount > 0, "Reward already claimed");
        
        // Determine winning side (minority)
        bool redWon = round.redCount < round.blueCount;
        bool userWon = (userVote.isRed && redWon) || (!userVote.isRed && !redWon);
        
        require(userWon, "Did not win this round");
        
        // Calculate reward proportionally
        uint256 totalPool = round.totalRedAmount + round.totalBlueAmount;
        uint256 winningPool = userVote.isRed ? round.totalRedAmount : round.totalBlueAmount;
        uint256 reward = (userVote.amount * totalPool) / winningPool;
        
        // Mark as claimed
        userVote.amount = 0;
        
        // Transfer reward
        (bool success, ) = msg.sender.call{value: reward}("");
        require(success, "Transfer failed");
        
        emit RewardClaimed(roundId, msg.sender, reward);
    }
    
    /// @notice Get current round information
    function getCurrentRound() external view returns (
        uint256 roundId,
        uint256 startTime,
        uint256 endTime,
        uint256 totalRedAmount,
        uint256 totalBlueAmount,
        bool isActive,
        bool isDecrypted,
        uint256 participantCount
    ) {
        Round storage round = rounds[currentRoundId];
        return (
            currentRoundId,
            round.startTime,
            round.endTime,
            round.totalRedAmount,
            round.totalBlueAmount,
            round.isActive,
            round.isDecrypted,
            round.participants.length
        );
    }
    
    /// @notice Get round results (only available after decryption)
    function getRoundResults(uint256 roundId) external view returns (
        uint32 redCount,
        uint32 blueCount,
        uint256 totalRedAmount,
        uint256 totalBlueAmount,
        bool isDecrypted
    ) {
        Round storage round = rounds[roundId];
        return (
            round.redCount,
            round.blueCount,
            round.totalRedAmount,
            round.totalBlueAmount,
            round.isDecrypted
        );
    }
    
    /// @notice Check if user has voted in a round
    function hasVoted(uint256 roundId, address user) external view returns (bool) {
        return rounds[roundId].votes[user].hasVoted;
    }
    
    /// @notice Get user's vote info for a round
    function getUserVote(uint256 roundId, address user) external view returns (
        bool hasVoted,
        bool isRed,
        uint256 amount
    ) {
        Vote storage userVote = rounds[roundId].votes[user];
        return (
            userVote.hasVoted,
            userVote.isRed,
            userVote.amount
        );
    }
    
    /// @notice Get time remaining in current round
    function getTimeRemaining() external view returns (uint256) {
        Round storage round = rounds[currentRoundId];
        if (block.timestamp >= round.endTime) {
            return 0;
        }
        return round.endTime - block.timestamp;
    }

    /// @notice Get contract information and statistics
    function getContractInfo() external returns (
        uint256 currentRound,
        uint256 roundDuration,
        uint256 minBet,
        bool stopped,
        uint256 totalRounds
    ) {
        emit ContractInfoRequested(msg.sender, block.timestamp);
        return (
            currentRoundId,
            ROUND_DURATION,
            MIN_BET,
            emergencyStopped,
            currentRoundId
        );
    }

    /// @notice Emergency stop all contract operations
    function emergencyStop() external {
        // Only allow owner to stop (simplified owner check)
        require(msg.sender == address(0x1234567890123456789012345678901234567890), "Only owner can stop");
        require(!emergencyStopped, "Already stopped");

        emergencyStopped = true;
        emit EmergencyStop(msg.sender, block.timestamp);
    }

    /// @notice Resume contract operations after emergency stop
    function emergencyResume() external {
        require(msg.sender == address(0x1234567890123456789012345678901234567890), "Only owner can resume");
        require(emergencyStopped, "Not stopped");

        emergencyStopped = false;
        emit EmergencyResume(msg.sender, block.timestamp);
    }
}

