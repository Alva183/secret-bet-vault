import { useState, useEffect, useCallback, useRef } from 'react';
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
  const contractAddress = contract?.address;
  
  const [currentRound, setCurrentRound] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const loadRoundDataRef = useRef<(() => Promise<void>) | null>(null);
  const countdownStateRef = useRef<{ lastSyncTime: number; lastKnownRemaining: number } | null>(null);

  const loadRoundData = useCallback(
    async () => {
      if (!publicClient || !contractAddress) {
        setError('Contract not found on this network');
        setLoading(false);
        return;
      }

      try {
        // Use publicClient and contractAddress directly to avoid dependency on contract object
        const [roundData, timeRemainingOnChain] = await Promise.all([
          publicClient.readContract({
            address: contractAddress as Address,
            abi: VotingGameABI,
            functionName: 'getCurrentRound',
          }),
          publicClient.readContract({
            address: contractAddress as Address,
            abi: VotingGameABI,
            functionName: 'getTimeRemaining',
          }).catch(() => 0n), // Fallback to 0 if call fails
        ]);

        let userHasVoted = false;
        if (address && roundData[0]) {
          userHasVoted = await publicClient.readContract({
            address: contractAddress as Address,
            abi: VotingGameABI,
            functionName: 'hasVoted',
            args: [roundData[0], address],
          });
        }

        const roundInfo = {
          roundId: roundData[0],
          startTime: roundData[1],
          endTime: roundData[2],
          totalRedAmount: roundData[3],
          totalBlueAmount: roundData[4],
          isActive: roundData[5],
          isDecrypted: roundData[6],
          participantCount: roundData[7],
          userHasVoted,
        };

        setCurrentRound(roundInfo);

        // Use on-chain time remaining instead of client-side calculation
        // This ensures synchronization with blockchain time
        const remaining = Number(timeRemainingOnChain);
        setTimeRemaining(remaining);

        setError(null);
      } catch (err: any) {
        console.error('Error loading round data:', err);
        setError(err.message || 'Failed to load round data');
      } finally {
        setLoading(false);
      }
    },
    // Only recreate when address or contract address changes to avoid infinite loops
    [contractAddress, address, publicClient],
  );

  // Store the latest loadRoundData function in ref
  useEffect(() => {
    loadRoundDataRef.current = loadRoundData;
  }, [loadRoundData]);

  // Sync countdown state when timeRemaining is updated from chain
  useEffect(() => {
    if (currentRound?.isActive && timeRemaining >= 0) {
      if (!countdownStateRef.current) {
        countdownStateRef.current = {
          lastSyncTime: Date.now(),
          lastKnownRemaining: timeRemaining,
        };
      } else {
        // Update the known remaining time when synced from chain
        countdownStateRef.current.lastKnownRemaining = timeRemaining;
        countdownStateRef.current.lastSyncTime = Date.now();
      }
    }
  }, [timeRemaining, currentRound?.isActive]);

  // Real-time countdown update
  useEffect(() => {
    // Clear previous timer
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    // Reset countdown state when round changes
    if (currentRound?.roundId) {
      countdownStateRef.current = {
        lastSyncTime: Date.now(),
        lastKnownRemaining: timeRemaining,
      };
    }

    // Start countdown if current round is active
    if (currentRound?.isActive && countdownStateRef.current) {
      const updateCountdown = () => {
        const state = countdownStateRef.current;
        if (!state) return;

        // Every 10 seconds, sync with on-chain time to correct for drift
        const timeSinceLastSync = Date.now() - state.lastSyncTime;
        if (timeSinceLastSync >= 10000 && contractAddress && publicClient) {
          // Sync with chain every 10 seconds
          publicClient.readContract({
            address: contractAddress as Address,
            abi: VotingGameABI,
            functionName: 'getTimeRemaining',
          })
            .then((chainTime) => {
              const remaining = Number(chainTime);
              if (countdownStateRef.current) {
                countdownStateRef.current.lastKnownRemaining = remaining;
                countdownStateRef.current.lastSyncTime = Date.now();
              }
              setTimeRemaining(remaining);
              
              // If time is up, refresh data
              if (remaining <= 0) {
                if (countdownIntervalRef.current) {
                  clearInterval(countdownIntervalRef.current);
                  countdownIntervalRef.current = null;
                }
                setTimeout(() => {
                  if (loadRoundDataRef.current) {
                    loadRoundDataRef.current();
                  }
                }, 1000);
              }
            })
            .catch((err) => {
              console.warn('Failed to sync time from chain:', err);
              // Continue with local countdown if sync fails
              const elapsed = Math.floor((Date.now() - state.lastSyncTime) / 1000);
              const remaining = Math.max(0, state.lastKnownRemaining - elapsed);
              setTimeRemaining(remaining);
              
              // If time is up, refresh data
              if (remaining <= 0) {
                if (countdownIntervalRef.current) {
                  clearInterval(countdownIntervalRef.current);
                  countdownIntervalRef.current = null;
                }
                setTimeout(() => {
                  if (loadRoundDataRef.current) {
                    loadRoundDataRef.current();
                  }
                }, 1000);
              }
            });
        } else {
          // Local countdown: decrement by elapsed time
          const elapsed = Math.floor((Date.now() - state.lastSyncTime) / 1000);
          const remaining = Math.max(0, state.lastKnownRemaining - elapsed);
          setTimeRemaining(remaining);
          
          // If time is up, refresh data
          if (remaining <= 0) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            setTimeout(() => {
              if (loadRoundDataRef.current) {
                loadRoundDataRef.current();
              }
            }, 1000);
          }
        }
      };

      // Update immediately once
      updateCountdown();

      // Update every second
      countdownIntervalRef.current = setInterval(updateCountdown, 1000);
    } else {
      setTimeRemaining(0);
      countdownStateRef.current = null;
    }

    // Cleanup function
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [currentRound?.isActive, currentRound?.roundId, contractAddress, publicClient]);

  // Load round data
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

    // First, check the actual on-chain time remaining
    let timeRemainingOnChain = 0;
    try {
      const timeRemainingResult = await publicClient.readContract({
        address: contract.address,
        abi: contract.abi,
        functionName: 'getTimeRemaining',
      });
      timeRemainingOnChain = Number(timeRemainingResult);
    } catch (readErr) {
      console.warn('Failed to read time remaining from chain:', readErr);
    }

    // If there's still time remaining on-chain, throw error with actual remaining time
    if (timeRemainingOnChain > 0) {
      throw new Error(
        `Round has not ended yet on the blockchain. ${timeRemainingOnChain} seconds remaining. Please wait.`
      );
    }

    // Now try to end the round
    try {
      const { request } = await publicClient.simulateContract({
        address: contract.address,
        abi: contract.abi,
        functionName: 'endRound',
        account: address,
      });

      const hash = await walletClient.writeContract(request);
      
      await publicClient.waitForTransactionReceipt({ hash });
      
      await loadRoundData();
    } catch (err: any) {
      // If simulateContract fails with "Round not ended yet", provide helpful message
      if (err.message && err.message.includes('Round not ended yet')) {
        // Try to get the actual remaining time if we haven't already
        if (timeRemainingOnChain === 0) {
          try {
            const timeRemainingResult = await publicClient.readContract({
              address: contract.address,
              abi: contract.abi,
              functionName: 'getTimeRemaining',
            });
            timeRemainingOnChain = Number(timeRemainingResult);
          } catch (readErr) {
            // Ignore read errors here
          }
        }
        
        if (timeRemainingOnChain > 0) {
          throw new Error(
            `Round has not ended yet on the blockchain. ${timeRemainingOnChain} seconds remaining. Please wait.`
          );
        } else {
          throw new Error('Round has not ended yet on the blockchain. Please wait a few more seconds and try again.');
        }
      }
      // Re-throw other errors
      throw err;
    }
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
    
    // Refresh data to update reward status
    await loadRoundData();
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
    
    // Refresh data to show decrypted results
    await loadRoundData();
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

