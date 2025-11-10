import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia, hardhat } from 'wagmi/chains';
import { http, fallback } from 'wagmi';

export const config = getDefaultConfig({
  appName: 'Voting Game',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  // Put hardhat first to make it the default network
  chains: [hardhat, sepolia],
  transports: {
    // Local Hardhat network (default)
    [hardhat.id]: http('http://127.0.0.1:8545'),
    // Use fallback with multiple RPC endpoints for Sepolia to avoid rate limits
    [sepolia.id]: fallback([
      http('https://rpc.sepolia.org'),
      http('https://ethereum-sepolia-rpc.publicnode.com'),
      http('https://sepolia.gateway.tenderly.co'),
      http('https://rpc2.sepolia.org'),
      http('https://sepolia.infura.io/v3/b18fb7e6ca7045ac83c41157ab93f990'),
    ]),
  },
  ssr: true,
});

