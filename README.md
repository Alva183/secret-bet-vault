# 🔐 FHEVM Voting Game - Fully Homomorphic Encryption Counter

[![Demo Video](https://img.shields.io/badge/Demo-Video-blue)](https://github.com/Alva183/secret-bet-vault/blob/master/voting-game.mp4)

A secure voting game implementation using **FHEVM (Fully Homomorphic Encryption Virtual Machine)** technology, enabling privacy-preserving vote counting and encrypted data operations on Ethereum-compatible blockchains.

## 🎥 Demo Video

Watch the complete demo: [voting-game.mp4](https://github.com/Alva183/secret-bet-vault/blob/master/voting-game.mp4)

The video demonstrates:
- Smart contract deployment on Sepolia testnet
- Encrypted vote submission and counting
- Real-time decryption verification
- Privacy-preserving computation

## 🚀 Features

- **🔒 Privacy-First**: All votes are encrypted using FHE technology
- **⚡ Real-Time**: Instant encrypted computations without decryption
- **🔐 Secure**: Mathematical operations on encrypted data
- **🌐 Ethereum Compatible**: Deployable on any EVM-compatible chain
- **🛡️ Zero-Knowledge**: No private keys or sensitive data exposed

## 🏗️ Architecture

### Smart Contract: `FHECounter.sol`

The core contract implements an encrypted counter with privacy-preserving operations:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract FHECounter is SepoliaConfig {
    euint32 private _count;

    function getCount() external view returns (euint32) {
        return _count;
    }

    function increment(externalEuint32 inputEuint32, bytes calldata inputProof) external {
        euint32 encryptedEuint32 = FHE.fromExternal(inputEuint32, inputProof);
        _count = FHE.add(_count, encryptedEuint32);
        FHE.allowThis(_count);
        FHE.allow(_count, msg.sender);
    }

    function decrement(externalEuint32 inputEuint32, bytes calldata inputProof) external {
        euint32 encryptedEuint32 = FHE.fromExternal(inputEuint32, inputProof);
        _count = FHE.sub(_count, encryptedEuint32);
        FHE.allowThis(_count);
        FHE.allow(_count, msg.sender);
    }
}
```

### 🔑 FHE Data Encryption Flow

```
User Input → FHE Encryption → Smart Contract → Encrypted Computation → Result Storage
     ↓              ↓              ↓              ↓              ↓
   Plaintext   Ciphertext      euint32       FHE.add()     euint32
```

#### Key Encryption Components:

1. **Input Encryption**:
   ```typescript
   // Client-side encryption using FHEVM SDK
   const encryptedVote = FHE.encrypt_uint32(voteValue);
   ```

2. **Contract Processing**:
   ```solidity
   // Smart contract receives encrypted data
   euint32 encryptedValue = FHE.fromExternal(inputEuint32, inputProof);

   // Perform mathematical operations on encrypted data
   _count = FHE.add(_count, encryptedValue);
   ```

3. **Permission Management**:
   ```solidity
   // Allow contract to access encrypted result
   FHE.allowThis(_count);

   // Allow specific user to decrypt result
   FHE.allow(_count, msg.sender);
   ```

## 🛠️ Installation & Setup

### Prerequisites

- Node.js >= 20
- npm >= 7.0.0
- Git

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/Alva183/secret-bet-vault.git
   cd voting-game
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Compile contracts**
   ```bash
   npm run compile
   ```

4. **Run tests**
   ```bash
   npm run test
   ```

5. **Deploy to Sepolia testnet**
   ```bash
   npx hardhat run scripts/deploy.ts --network sepolia
   ```

## 🔧 Configuration

### Hardhat Configuration

The project uses Zama's FHEVM plugin for encrypted smart contract development:

```javascript
// hardhat.config.ts
import "@fhevm/hardhat-plugin";

export default {
  solidity: "0.8.24",
  networks: {
    sepolia: {
      // Sepolia testnet configuration
    }
  },
  fhevm: {
    // FHEVM specific configuration
  }
};
```

### Environment Variables

Create a `.env` file in the root directory:

```env
PRIVATE_KEY=your_private_key_here
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm run test

# Run with coverage
npm run coverage

# Run specific test
npx hardhat test test/FHECounter.ts
```

## 🚀 Deployment

### Local Development

```bash
npx hardhat node
npx hardhat run scripts/deploy.ts --network localhost
```

### Sepolia Testnet

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

## 🔒 Security Considerations

- **Zero-Knowledge Proofs**: All operations use ZKPs for verification
- **Encrypted State**: No plaintext data stored on-chain
- **Access Control**: Fine-grained permission management for encrypted data
- **Audit Trail**: All operations are transparently logged

## 📚 FHEVM Documentation

- [FHEVM Official Documentation](https://docs.zama.ai/fhevm)
- [Zama FHEVM GitHub](https://github.com/zama-ai/fhevm)
- [Solidity FHE Library](https://docs.zama.ai/fhevm/solidity-lib)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the BSD-3-Clause-Clear License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Zama](https://zama.ai/) - For the FHEVM technology
- [Ethereum](https://ethereum.org/) - For the blockchain infrastructure
- [Hardhat](https://hardhat.org/) - For the development framework

---

**Built with ❤️ using FHEVM technology**
