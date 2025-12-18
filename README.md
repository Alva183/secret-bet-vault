# 🎮 Voting Game - Privacy-Preserving Encrypted Voting with FHE

[![License](https://img.shields.io/badge/License-BSD--3--Clause--Clear-blue.svg)](LICENSE)
[![Solidity](https://img.shields.io/badge/Solidity-^0.8.24-363636?logo=solidity)](https://docs.soliditylang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow)](https://hardhat.org/)

A decentralized voting game where users vote **Red** 🔴 or **Blue** 🔵 with complete privacy using **Fully Homomorphic Encryption (FHE)**. The minority side wins and splits the entire pool proportionally!

## 🎥 Demo Video

**[Watch Demo Video](./voting-game.mp4)** - See the game in action! (9.37 MB)

## ✨ Key Features

- 🔐 **Fully Encrypted Voting**: Votes are encrypted using FHE technology, ensuring complete privacy during the voting round
- ⏱️ **5-Minute Rounds**: Fast-paced rounds with automatic progression
- ⏰ **Real-Time Countdown**: Live countdown timer synchronized with blockchain time, updates every second
- 🔄 **On-Chain Time Sync**: Automatic synchronization with blockchain every 10 seconds to ensure accuracy
- 🏆 **Minority Wins**: The side with fewer voters wins - encourages strategic thinking!
- 💰 **Proportional Rewards**: Winners split the entire pool based on their contribution
- 🎁 **Minimum Bet**: 0.1 ETH minimum to participate
- 🔓 **Frontend Decryption**: Users can decrypt results directly from the web interface
- 📊 **Detailed History**: View all your past rounds with complete statistics
- ⛓️ **Multi-Network**: Supports both local development and Sepolia testnet

## 🎯 How It Works

### Game Flow

1. **Connect Wallet** 🔌  
   Connect your MetaMask or compatible wallet using RainbowKit

2. **Cast Your Vote** 🗳️  
   Choose Red 🔴 or Blue 🔵 and bet at least 0.1 ETH  
   Your vote is **encrypted immediately** - nobody can see your choice!

3. **Wait for Round End** ⏳  
   The round lasts 5 minutes. All votes remain encrypted and private.  
   - Watch the real-time countdown timer that updates every second
   - The timer automatically syncs with blockchain time every 10 seconds for accuracy
   - Round data refreshes every 30 seconds to show latest pool amounts and participants

4. **Decrypt Results** 🔓  
   After the round ends, anyone can trigger decryption:
   - **Via Frontend**: Click "🔓 Decrypt Results" button in the UI
   - **Via CLI**: Use Hardhat tasks to decrypt programmatically

5. **Claim Rewards** 💎  
   If you voted for the **minority side**, claim your proportional share of the entire pool!

### Example Round

```
Round #5 - Total Pool: 0.3 ETH

🔴 Red Team: 1 voter, 0.1 ETH
🔵 Blue Team: 1 voter, 0.2 ETH

Winner: 🔴 Red (minority with 1 voter vs 1 voter, but determined by vote count)
Red winner receives: 0.3 ETH (entire pool)
Return: 3x their bet!
```

## 🏗️ Technology Stack

### Smart Contracts
- **Solidity**: ^0.8.24
- **FHEVM**: Fully Homomorphic Encryption Virtual Machine by [Zama](https://github.com/zama-ai/fhevm)
- **Hardhat**: Development environment and testing framework
- **TypeChain**: TypeScript bindings for contracts

### Frontend
- **Next.js**: 15.x with App Router
- **React**: 19.x
- **TypeScript**: Full type safety
- **RainbowKit**: Beautiful wallet connection UI
- **Wagmi & Viem**: Modern Web3 React hooks
- **TailwindCSS**: Utility-first styling
- **Turbopack**: Fast refresh and builds

## 🔐 Encryption & Decryption Logic

### How FHE Encryption Works

The game uses **Fully Homomorphic Encryption (FHE)**, which allows computations on encrypted data without decrypting it.

#### 1. Vote Encryption (Client-Side)

```typescript
// User selects: Red (true) or Blue (false)
const isRed = true; // Red vote
const amount = parseEther("0.2"); // 0.2 ETH

// Vote is encrypted and sent to contract
      await contract.vote(isRed, { value: amount });
```

#### 2. Encrypted Counting (Smart Contract)

```solidity
// Inside VotingGame.sol
function vote(bool isRed) external payable {
    require(msg.value >= MIN_BET, "Bet too low");
    require(!round.votes[msg.sender].hasVoted, "Already voted");
    
    // Store vote information
    round.votes[msg.sender] = Vote({
        hasVoted: true,
        isRed: isRed,
        amount: msg.value
    });
    
    // Update counters and amounts
    if (isRed) {
        round.totalRedAmount += msg.value;
        // Encrypted counter increment (FHE operation)
        round.encryptedRedCount = FHE.add(
            round.encryptedRedCount, 
            FHE.asEuint32(1)
        );
    } else {
        round.totalBlueAmount += msg.value;
        // Encrypted counter increment (FHE operation)
        round.encryptedBlueCount = FHE.add(
            round.encryptedBlueCount, 
            FHE.asEuint32(1)
        );
    }
}
```

**Key Points**:
- Individual votes are stored in plaintext for reward calculation
- Vote **counts** are encrypted using FHE
- This prevents frontrunning and bandwagon effects
- Amounts are public (for transparency), but vote distribution is hidden

#### 3. Decryption Process

After the round ends, results must be decrypted:

**Method A: Frontend Decryption (User-Friendly)**

```typescript
// Click "Decrypt Results" button in UI
const handleDecrypt = async (roundId: number, redCount: number, blueCount: number) => {
  // System estimates counts based on bet amounts
  // User can adjust if needed
  
  // Submit decryption transaction
  const tx = await contract.setDecryptedResults(roundId, redCount, blueCount);
  await tx.wait();
  
  // Results are now visible!
};
```

**Method B: CLI Decryption (Programmatic)**

```bash
# Decrypt results for round 5
npx hardhat voting-game:set-results \
  --round 5 \
  --red 3 \
  --blue 2 \
  --network sepolia
```

**Decryption Contract Logic**:

```solidity
function setDecryptedResults(
    uint256 roundId,
    uint32 redCount,
    uint32 blueCount
) external {
    Round storage round = rounds[roundId];
    require(!round.isActive, "Round still active");
    require(!round.isDecrypted, "Already decrypted");
    
    // Set decrypted values
    round.redCount = redCount;
    round.blueCount = blueCount;
    round.isDecrypted = true;
    
    emit RoundEnded(roundId, redCount, blueCount, round.totalRedAmount, round.totalBlueAmount);
}
```

#### 4. Reward Calculation

```solidity
function claimReward(uint256 roundId) external {
    Round storage round = rounds[roundId];
    require(round.isDecrypted, "Not decrypted yet");
    
    Vote storage userVote = round.votes[msg.sender];
    require(userVote.hasVoted, "Didn't vote");
    require(userVote.amount > 0, "Already claimed");
    
    // Determine winner (minority side)
    bool redWon = round.redCount < round.blueCount;
    bool userWon = (userVote.isRed && redWon) || (!userVote.isRed && !redWon);
    require(userWon, "Not a winner");
    
    // Calculate proportional reward
    uint256 totalPool = round.totalRedAmount + round.totalBlueAmount;
    uint256 winningPool = redWon ? round.totalRedAmount : round.totalBlueAmount;
    uint256 reward = (userVote.amount * totalPool) / winningPool;
    
    // Transfer reward
    userVote.amount = 0; // Prevent double claiming
    payable(msg.sender).transfer(reward);
}
```

### Privacy Guarantees

| Phase | Visibility | Privacy |
|-------|-----------|---------|
| **During Round** | ❌ Vote counts hidden | ✅ Complete privacy |
| **After Round** | ⏳ Awaiting decryption | ✅ Still encrypted |
| **Post-Decryption** | ✅ Full transparency | ❌ Results public |

### Time Synchronization

The frontend implements a sophisticated time synchronization system:

- **Initial Load**: Fetches actual remaining time from blockchain using `getTimeRemaining()`
- **Real-Time Updates**: Countdown updates every second based on synchronized time
- **Periodic Sync**: Automatically syncs with blockchain every 10 seconds to correct for client time drift
- **Smart Validation**: Before ending a round, validates on-chain time to prevent premature calls
- **Error Messages**: Shows actual blockchain remaining time when operations fail due to timing

This ensures the countdown timer is always accurate and synchronized with the blockchain, preventing issues with client-side time differences.

## 🚀 Quick Start

### Prerequisites

- **Node.js**: >= 20.x
- **npm**: >= 7.0.0
- **MetaMask**: Browser extension installed

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Alva183/secret-bet-vault.git
cd secret-bet-vault

# 2. Install root dependencies
npm install

# 3. Install frontend dependencies
cd frontend
npm install
cd ..
```

### Local Development

#### Terminal 1: Start Hardhat Node

```bash
npx hardhat node
```

Keep this running! You'll see test accounts with 10,000 ETH each.

#### Terminal 2: Deploy Contract

```bash
npx hardhat deploy --network localhost
```

Output:
```
VotingGame contract deployed at: 0x5FbDB2315678afecb367f032d93F642f64180aa3
```

#### Terminal 3: Start Frontend

```bash
cd frontend
npm run dev
```

Frontend will start at: **http://localhost:3000**

#### Configure MetaMask

1. **Add Local Network**
   - Network Name: `Localhost 8545`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency: `ETH`

2. **Import Test Account**
   - Copy a private key from Terminal 1 (Hardhat node)
   - MetaMask → Import Account → Paste private key
   - You now have 10,000 test ETH! 🎉

3. **Play the Game!**
   - Open http://localhost:3000
   - Connect wallet
   - Vote Red or Blue
   - Watch the magic happen! ✨

## 🧪 Testing

### Run Local Tests

```bash
# Run all tests
npm test

# Run specific test file
npx hardhat test test/VotingGame.ts

# Run with gas reporting
REPORT_GAS=true npx hardhat test
```

### Run Sepolia Tests

```bash
# Set up environment
npx hardhat vars set INFURA_API_KEY your_key
npx hardhat vars set PRIVATE_KEY your_key

# Run tests
npm run test:sepolia
```

## 🌐 Deploy to Sepolia

### 1. Setup Environment

```bash
# Set Infura API key
npx hardhat vars set INFURA_API_KEY <your_infura_key>

# Set deployer private key
npx hardhat vars set PRIVATE_KEY <your_private_key>
```

### 2. Deploy Contract

```bash
npx hardhat deploy --network sepolia
```

### 3. Update Frontend Config

Edit `frontend/abi/VotingGameAddresses.ts`:

```typescript
export const VotingGameAddresses: Record<number, string> = {
  31337: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // Localhost
  11155111: "0xYourSepoliaAddress", // Sepolia - UPDATE THIS
};
```

### 4. Regenerate ABI

```bash
cd frontend
npm run genabi
```

### 5. Start Frontend

```bash
npm run dev
```

## 📋 Smart Contract Reference

### Core Contract: `VotingGame.sol`

#### State Variables

```solidity
uint256 public constant ROUND_DURATION = 5 minutes;
uint256 public constant MIN_BET = 0.1 ether;
uint256 public currentRoundId;
mapping(uint256 => Round) public rounds;
```

#### Structures

```solidity
struct Round {
    uint256 startTime;
    uint256 endTime;
    uint256 totalRedAmount;
    uint256 totalBlueAmount;
    euint32 encryptedRedCount;    // FHE encrypted count
    euint32 encryptedBlueCount;   // FHE encrypted count
    uint32 redCount;               // Decrypted count
    uint32 blueCount;              // Decrypted count
    bool isActive;
    bool isDecrypted;
    mapping(address => Vote) votes;
    address[] participants;
}

struct Vote {
    bool hasVoted;
    bool isRed;      // true = Red, false = Blue
    uint256 amount;  // Bet amount
}
```

#### Key Functions

##### User Functions

**`vote(bool isRed) payable`**
- Cast a vote for Red (true) or Blue (false)
- Must send at least 0.1 ETH
- Can only vote once per round
- Emits: `VoteCast(roundId, voter, amount)`

**`endRound()`**
- End the current round (anyone can call after 5 minutes)
- Starts a new round automatically
- Emits: `RoundStarted(newRoundId, startTime, endTime)`

**`setDecryptedResults(uint256 roundId, uint32 redCount, uint32 blueCount)`**
- Decrypt and set the vote counts for a round
- Can only be called once per round
- Must be called after round ends
- Emits: `RoundEnded(roundId, redCount, blueCount, totalRed, totalBlue)`

**`claimReward(uint256 roundId)`**
- Claim reward from a won round
- Must have voted in that round
- Must be on the winning (minority) side
- Can only claim once
- Emits: `RewardClaimed(roundId, voter, reward)`

##### View Functions

**`getCurrentRound()`**
- Returns: Round info (startTime, endTime, amounts, counts, status)

**`getRoundResults(uint256 roundId)`**
- Returns: Detailed results for a specific round

**`hasVoted(uint256 roundId, address user)`**
- Returns: Boolean indicating if user voted

**`getUserVote(uint256 roundId, address user)`**
- Returns: User's vote details (hasVoted, isRed, amount)

**`getTimeRemaining()`**
- Returns: Seconds remaining in current round

## ⚙️ Technical Implementation

### Time Synchronization System

The frontend implements a robust time synchronization mechanism to ensure accurate countdown timers:

1. **Initial Time Fetch**: When loading round data, the system calls `getTimeRemaining()` on the smart contract to get the actual blockchain time remaining.

2. **Real-Time Countdown**: 
   - Uses a `setInterval` to update the countdown every second
   - Calculates remaining time based on the last synchronized value
   - Updates the UI in real-time for smooth user experience

3. **Periodic Blockchain Sync**:
   - Every 10 seconds, the system calls `getTimeRemaining()` again
   - Corrects any drift between client time and blockchain time
   - Ensures the countdown is always accurate

4. **Smart Round Ending**:
   - Before calling `endRound()`, validates on-chain time remaining
   - Shows helpful error messages with actual remaining seconds if time hasn't elapsed
   - Prevents unnecessary transaction failures

5. **Automatic Refresh**:
   - When countdown reaches zero, automatically refreshes data
   - Ensures UI reflects the latest blockchain state
   - Allows users to immediately decrypt results or end the round

This architecture ensures that:
- ✅ Countdown is always synchronized with blockchain time
- ✅ No unnecessary RPC calls (only every 10 seconds)
- ✅ Smooth user experience with 1-second updates
- ✅ Accurate error messages when operations fail

## 🎨 Frontend Features

### Main Components

#### 1. **VotingGameApp** (`components/VotingGameApp.tsx`)
- Main application container
- Manages wallet connection state
- Handles auto-refresh every 30 seconds to sync with blockchain
- Displays network information

#### 2. **VotingPanel** (`components/VotingPanel.tsx`)
- Red vs Blue voting interface
- Amount input with validation
- Real-time transaction feedback
- End round functionality with on-chain time validation
- Smart error handling with helpful messages

#### 3. **RoundStats** (`components/RoundStats.tsx`)
- Current round information
- Real-time countdown timer (updates every second)
- Total pool and team amounts
- Participant count

#### 4. **PastRounds** (`components/PastRounds.tsx`)
- View your voting history
- Decrypt results interface
- Claim rewards button
- Detailed statistics and profit/loss

### Custom Hooks

#### `useVotingGame` (`hooks/useVotingGame.tsx`)

A comprehensive hook that manages all game state and interactions:

```typescript
const {
  currentRound,      // Current round data from blockchain
  timeRemaining,     // Seconds until round ends (synced with blockchain)
  loading,           // Loading state
  error,             // Error messages
  vote,              // Function to cast vote
  endRound,          // Function to end round (with on-chain validation)
  claimReward,       // Function to claim reward
  decryptRound,      // Function to decrypt results
  refresh            // Manual refresh function
} = useVotingGame(refreshTrigger);
```

**Key Features:**
- **Real-time countdown**: Updates every second, synchronized with blockchain time
- **On-chain time sync**: Automatically syncs with blockchain every 10 seconds to correct for client time drift
- **Smart error handling**: Provides helpful error messages with actual remaining time when operations fail
- **Automatic refresh**: Refreshes data after transactions and when countdown reaches zero

## 📁 Project Structure

```
voting-game/
├── 📄 README.md                    # This file
├── 📄 LICENSE                      # BSD-3-Clause-Clear
├── 📄 hardhat.config.ts           # Hardhat configuration
├── 📦 package.json                # Root dependencies
│
├── 📁 contracts/                   # Smart Contracts
│   └── VotingGame.sol             # Main game contract
│
├── 📁 deploy/                      # Deployment Scripts
│   └── deploy.ts                  # Hardhat-deploy script
│
├── 📁 test/                        # Contract Tests
│   ├── VotingGame.ts              # Local network tests
│   └── VotingGameSepolia.ts       # Sepolia testnet tests
│
├── 📁 tasks/                       # Hardhat Tasks
│   └── VotingGame.ts              # CLI commands for game
│
├── 📁 frontend/                    # Next.js Frontend
│   ├── 📁 app/                    # Next.js App Router
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Home page
│   │   ├── providers.tsx          # Web3 providers
│   │   └── globals.css            # Global styles
│   │
│   ├── 📁 components/             # React Components
│   │   ├── Header.tsx             # App header with wallet
│   │   ├── VotingGameApp.tsx     # Main game UI
│   │   ├── VotingPanel.tsx       # Voting interface
│   │   ├── RoundStats.tsx        # Round statistics
│   │   └── PastRounds.tsx        # History & decryption
│   │
│   ├── 📁 hooks/                  # Custom Hooks
│   │   └── useVotingGame.tsx     # Game logic hook
│   │
│   ├── 📁 config/                 # Configuration
│   │   └── wagmi.ts              # Wagmi/Viem config
│   │
│   ├── 📁 abi/                    # Contract ABIs
│   │   ├── VotingGameABI.ts      # Auto-generated ABI
│   │   └── VotingGameAddresses.ts # Contract addresses
│   │
│   ├── 📁 fhevm/                  # FHE Utilities
│   │   ├── useFhevm.tsx          # FHE hook
│   │   └── internal/             # FHE internals
│   │
│   ├── 📄 DECRYPTION_GUIDE.md    # Detailed decryption guide
│   └── 📦 package.json           # Frontend dependencies
│
├── 📁 deployments/                # Deployment Artifacts
│   ├── localhost/                # Local deployments
│   └── sepolia/                  # Sepolia deployments
│
├── 📁 docs/                       # Documentation
│   ├── QUICK_START.md            # Quick start guide
│   ├── GAME_RULES.md             # Detailed game rules
│   ├── DEPLOYMENT_GUIDE.md       # Deployment instructions
│   └── PROJECT_SUMMARY.md        # Project overview
│
└── 🎥 voting-game.mp4            # Demo video (9.37 MB)
```

## 🎯 Hardhat Tasks

Interact with the game using CLI commands:

### Check Status

```bash
npx hardhat voting-game:status --network localhost
```

Output:
```
=== Voting Game Status ===
Contract Address: 0x5FbDB2315678afecb367f032d93F642f64180aa3
Current Round ID: 5

Current Round:
  Start Time: 2024-01-15T10:30:00.000Z
  End Time: 2024-01-15T10:35:00.000Z
  Total Red Amount: 0.3 ETH
  Total Blue Amount: 0.5 ETH
  Participants: 3
  Is Active: true
  Is Decrypted: false
  Time Remaining: 180 seconds
==========================
```

### Cast Vote

```bash
# Vote Red with 0.2 ETH
npx hardhat voting-game:vote --choice red --amount 0.2 --network localhost

# Vote Blue with 0.5 ETH
npx hardhat voting-game:vote --choice blue --amount 0.5 --network localhost
```

### End Round

```bash
npx hardhat voting-game:end-round --network localhost
```

### Decrypt Results

```bash
npx hardhat voting-game:set-results \
  --round 5 \
  --red 2 \
  --blue 3 \
  --network localhost
```

### Get Round Results

```bash
npx hardhat voting-game:round-results --round 5 --network localhost
```

Output:
```
=== Round 5 Results ===
Red Votes: 2
Blue Votes: 3
Total Red Amount: 0.3 ETH
Total Blue Amount: 0.5 ETH
Is Decrypted: true
Winner: Red (minority side)
=============================
```

### Claim Reward

```bash
npx hardhat voting-game:claim --round 5 --network localhost
```

## 🔒 Security Considerations

### Smart Contract Security

- ✅ **Reentrancy Protection**: CEI pattern (Checks-Effects-Interactions)
- ✅ **Access Control**: Public functions with proper validation
- ✅ **Integer Overflow**: Solidity 0.8+ built-in protection
- ✅ **Double Claiming**: Reward amount set to 0 after claim
- ✅ **Vote Immutability**: Cannot change vote after casting
- ✅ **Minimum Bet**: 0.1 ETH prevents spam attacks

### Privacy Guarantees

- 🔐 **Vote Counts Encrypted**: Uses FHE during active round
- 🔐 **Individual Votes**: Stored but not exposed until decryption
- 🔐 **No Frontrunning**: Vote distribution hidden until round ends
- ⚠️ **Amounts Public**: Bet amounts are visible (by design for transparency)

### Best Practices

1. **Never share private keys**
2. **Verify contract addresses** before interaction
3. **Test with small amounts** first
4. **Wait for transaction confirmation** before proceeding
5. **Keep frontend dependencies updated**

## 🐛 Troubleshooting

### Common Issues

#### "Wallet not connected"
**Solution**: Click "Connect Wallet" button and approve connection in MetaMask

#### "Contract not deployed on this network"
**Solution**: 
- Check MetaMask is on correct network (Localhost 8545 or Sepolia)
- Verify contract address in `frontend/abi/VotingGameAddresses.ts`

#### "Insufficient funds"
**Solution**: 
- For local: Import test account from Hardhat node
- For Sepolia: Get test ETH from [Sepolia Faucet](https://sepoliafaucet.com/)

#### "Already voted in this round"
**Solution**: Wait for round to end (5 minutes) or use different account

#### "Transaction failed"
**Solution**:
- Ensure you have enough ETH for gas fees
- Check you're meeting minimum bet (0.1 ETH)
- Verify round is still active

#### "Round has not ended yet on the blockchain"
**Solution**:
- The countdown timer shows client-side time, but blockchain time may differ slightly
- Wait for the actual remaining time shown in the error message
- The system automatically syncs with blockchain every 10 seconds
- Try again after the countdown reaches zero and wait a few more seconds

#### "Frontend shows wrong network"
**Solution**:
- Switch MetaMask to correct network
- Refresh page after switching

#### "Countdown not updating"
**Solution**:
- The countdown syncs with blockchain every 10 seconds automatically
- If it seems stuck, wait up to 10 seconds for the next sync
- Refresh the page if the issue persists

## 📚 Documentation

- **[Quick Start Guide](QUICK_START.md)** - Get started in 5 minutes
- **[Game Rules](GAME_RULES.md)** - Detailed gameplay mechanics
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Deploy to production
- **[Decryption Guide](frontend/DECRYPTION_GUIDE.md)** - How to decrypt results
- **[Project Summary](PROJECT_SUMMARY.md)** - Architecture overview

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Workflow

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the **BSD-3-Clause-Clear** License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[Zama](https://www.zama.ai/)** - For the amazing FHEVM technology
- **[RainbowKit](https://www.rainbowkit.com/)** - Beautiful wallet connection UI
- **[Hardhat](https://hardhat.org/)** - Excellent development environment
- **[Next.js](https://nextjs.org/)** - The React framework for production

## 📞 Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/Alva183/secret-bet-vault/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/Alva183/secret-bet-vault/discussions)
- 📧 **Email**: JenniferJacksoncdxys@outlook.com

## 🌟 Show Your Support

If you find this project useful, please consider:
- ⭐ **Starring the repository**
- 🔀 **Forking** and contributing
- 📢 **Sharing** with others

---

**Made with ❤️ using FHE technology**

*Privacy-preserving blockchain gaming at its finest!* 🎮🔐✨
