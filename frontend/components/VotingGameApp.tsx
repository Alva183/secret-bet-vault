'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useVotingGame } from '../hooks/useVotingGame';
import { VotingPanel } from './VotingPanel';
import { RoundStats } from './RoundStats';
import { PastRounds } from './PastRounds';
import { VotingGameAddresses } from '../abi/VotingGameAddresses';

export function VotingGameApp() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const chainId = publicClient?.chain?.id;
  const contractAddress = chainId ? VotingGameAddresses[chainId] : undefined;
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const {
    currentRound,
    timeRemaining,
    loading,
    error,
    vote,
    endRound,
    claimReward,
    decryptRound
  } = useVotingGame(refreshTrigger);

  // Handle potential errors from the hook
  if (error) {
    console.error('VotingGame hook error:', error);
  }

  // Auto-refresh every 30 seconds to avoid rate limits
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <h2 className="text-3xl font-bold text-gray-800">Welcome to Voting Game</h2>
        <p className="text-gray-600">Please connect your wallet to participate</p>
      </div>
    );
  }

  // Check if contract is deployed on this network
  if (isConnected && (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 max-w-2xl" role="alert">
          <p className="font-bold">Wrong Network Detected</p>
          <p className="mt-2">Current Chain ID: <span className="font-mono">{chainId || 'Unknown'}</span></p>
          <p className="mt-2">Contract Address: <span className="font-mono">{contractAddress || 'Not Found'}</span></p>
          <p className="mt-4">
            Please switch to <strong>Hardhat Local Network</strong>:
          </p>
          <ul className="mt-2 ml-4 list-disc space-y-1">
            <li>Network Name: Hardhat Local</li>
            <li>RPC URL: http://127.0.0.1:8545</li>
            <li>Chain ID: 31337</li>
            <li>Currency Symbol: ETH</li>
          </ul>
          <p className="mt-4 text-sm">
            Make sure your Hardhat node is running with: <code className="bg-yellow-200 px-2 py-1 rounded">npx hardhat node</code>
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Debug Info */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <p className="text-sm font-mono">
          <strong>Chain ID:</strong> {chainId || 'Not connected'} | 
          <strong> Contract Address:</strong> {contractAddress || 'Not found'} |
          <strong> Expected Chain ID:</strong> 31337 (Hardhat Local)
        </p>
      </div>

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-gray-900">Encrypted Voting Game</h1>
        <p className="text-lg text-gray-600">
          Vote Red or Blue with encrypted privacy. Minority wins!
        </p>
      </div>

      {/* Current Round Stats */}
      {currentRound && (
        <RoundStats 
          round={currentRound} 
          timeRemaining={timeRemaining}
        />
      )}

      {/* Voting Panel */}
      {currentRound && currentRound.isActive && (
        <VotingPanel
          round={currentRound}
          userAddress={address}
          onVote={vote}
          onEndRound={endRound}
          timeRemaining={timeRemaining}
        />
      )}

      {/* Past Rounds */}
      <PastRounds 
        currentRoundId={currentRound?.roundId || 0n}
        userAddress={address}
        onClaimReward={claimReward}
        onDecryptRound={decryptRound}
      />
    </div>
  );
}

