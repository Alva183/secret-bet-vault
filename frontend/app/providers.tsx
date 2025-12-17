'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { config } from '../config/wagmi';
import { MetaMaskProvider } from '../hooks/metamask/useMetaMaskProvider';
import { MetaMaskEthersSignerProvider } from '../hooks/metamask/useMetaMaskEthersSigner';

const queryClient = new QueryClient();

// Hardhat mock chain mapping used by FHEVM + MetaMask helpers
const MOCK_CHAINS: Readonly<Record<number, string>> = {
  31337: 'http://127.0.0.1:8545',
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <MetaMaskProvider>
            <MetaMaskEthersSignerProvider initialMockChains={MOCK_CHAINS}>
              {children}
            </MetaMaskEthersSignerProvider>
          </MetaMaskProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
