import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseEther, Address } from 'viem';
import { VotingGameABI } from '../abi/VotingGameABI';
import { VotingGameAddresses } from '../abi/VotingGameAddresses';

export function useVotingGameContract() {
  const publicClient = usePublicClient();
  const chainId = publicClient?.chain?.id;
  const contractAddress = chainId ? VotingGameAddresses[chainId] : undefined;

  if (!publicClient || !contractAddress) {
    return null;
  }

  return {
    address: contractAddress as Address,
    abi: VotingGameABI,
    read: {
      getCurrentRound: async () => {
        return publicClient.readContract({
          address: contractAddress as Address,
          abi: VotingGameABI,
          functionName: 'getCurrentRound',
        });
      },
      getRoundResults: async (args: [bigint]) => {
        return publicClient.readContract({
          address: contractAddress as Address,
          abi: VotingGameABI,
          functionName: 'getRoundResults',
          args,
        });
      },
      getUserVote: async (args: [bigint, Address]) => {
        return publicClient.readContract({
          address: contractAddress as Address,
          abi: VotingGameABI,
          functionName: 'getUserVote',
          args,
        });
      },
      hasVoted: async (args: [bigint, Address]) => {
        return publicClient.readContract({
          address: contractAddress as Address,
          abi: VotingGameABI,
          functionName: 'hasVoted',
          args,
        });
      },
      getTimeRemaining: async () => {
        return publicClient.readContract({
          address: contractAddress as Address,
          abi: VotingGameABI,
          functionName: 'getTimeRemaining',
        });
      },
      currentRoundId: async () => {
        return publicClient.readContract({
          address: contractAddress as Address,
          abi: VotingGameABI,
          functionName: 'currentRoundId',
        });
      },
    },
  };
}

export function useVotingGame(refreshTrigger: number = 0) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const contract = useVotingGameContract();
  
  const [currentRound, setCurrentRound] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRoundData = useCallback(async () => {
    if (!contract) {
      setError('Contract not found on this network');
      setLoading(false);
      return;
    }

    try {
      const [roundData, timeLeft] = await Promise.all([
        contract.read.getCurrentRound(),
        contract.read.getTimeRemaining(),
      ]);

      let userHasVoted = false;
      if (address && roundData[0]) {
        userHasVoted = await contract.read.hasVoted([roundData[0], address]);
      }

      setCurrentRound({
        roundId: roundData[0],
        startTime: roundData[1],
        endTime: roundData[2],
        totalRedAmount: roundData[3],
        totalBlueAmount: roundData[4],
        isActive: roundData[5],
        isDecrypted: roundData[6],
        participantCount: roundData[7],
        userHasVoted,
      });

      setTimeRemaining(Number(timeLeft));
      setError(null);
    } catch (err: any) {
      console.error('Error loading round data:', err);
      setError(err.message || 'Failed to load round data');
    } finally {
      setLoading(false);
    }
  }, [contract, address]);

  useEffect(() => {
    loadRoundData();
  }, [loadRoundData, refreshTrigger]);

  const vote = async (isRed: boolean, amountInEth: string) => {
    if (!walletClient || !publicClient || !contract || !address) {
      throw new Error('Wallet not connected');
    }

    const amount = parseEther(amountInEth);
    
    const { request } = await publicClient.simulateContract({
      address: contract.address,
      abi: contract.abi,
      functionName: 'vote',
      args: [isRed],
      value: amount,
      account: address,
    });

    const hash = await walletClient.writeContract(request);
    
    // Wait for transaction
    await publicClient.waitForTransactionReceipt({ hash });
    
    // Reload data
    await loadRoundData();
  };

  const endRound = async () => {
    if (!walletClient || !publicClient || !contract || !address) {
      throw new Error('Wallet not connected');
    }

    const { request } = await publicClient.simulateContract({
      address: contract.address,
      abi: contract.abi,
      functionName: 'endRound',
      account: address,
    });

    const hash = await walletClient.writeContract(request);
    
    await publicClient.waitForTransactionReceipt({ hash });
    
    await loadRoundData();
  };

  const claimReward = async (roundId: number) => {
    if (!walletClient || !publicClient || !contract || !address) {
      throw new Error('Wallet not connected');
    }

    const { request } = await publicClient.simulateContract({
      address: contract.address,
      abi: contract.abi,
      functionName: 'claimReward',
      args: [BigInt(roundId)],
      account: address,
    });

    const hash = await walletClient.writeContract(request);
    
    await publicClient.waitForTransactionReceipt({ hash });
  };

  const decryptRound = async (roundId: number, redCount: number, blueCount: number) => {
    if (!walletClient || !publicClient || !contract || !address) {
      throw new Error('Wallet not connected');
    }

    const { request } = await publicClient.simulateContract({
      address: contract.address,
      abi: contract.abi,
      functionName: 'setDecryptedResults',
      args: [BigInt(roundId), redCount, blueCount],
      account: address,
    });

    const hash = await walletClient.writeContract(request);
    
    await publicClient.waitForTransactionReceipt({ hash });
  };

  return {
    currentRound,
    timeRemaining,
    loading,
    error,
    vote,
    endRound,
    claimReward,
    decryptRound,
    refresh: loadRoundData,
  };
}

