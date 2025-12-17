'use client';

import { useState, useEffect } from 'react';
import { formatEther } from 'viem';
import { useVotingGameContract } from '../hooks/useVotingGame';
import { useAutoDecryptRound } from '../hooks/useAutoDecryptRound';

interface UserVote {
  hasVoted: boolean;
  isRed: boolean;
  amount: bigint;
}

interface RoundData {
  roundId: number;
  redCount: number;
  blueCount: number;
  totalRedAmount: bigint;
  totalBlueAmount: bigint;
  isDecrypted: boolean;
  userVote: UserVote;
}

interface PastRoundsProps {
  currentRoundId: bigint;
  userAddress?: string;
  onClaimReward: (roundId: number) => Promise<void>;
  onDecryptRound?: (roundId: number, redCount: number, blueCount: number) => Promise<void>;
}

export function PastRounds({ currentRoundId, userAddress, onClaimReward, onDecryptRound }: PastRoundsProps) {
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [decrypting, setDecrypting] = useState<number | null>(null);
  const [showDecryptModal, setShowDecryptModal] = useState<{roundId: number, redCount: number, blueCount: number} | null>(null);
  const contract = useVotingGameContract();
  const { isSepolia, autoDecryptRound } = useAutoDecryptRound();

  // 加载历史轮次数据
  useEffect(() => {
    // 没有合约、没有地址或还在第一轮时，不加载历史数据
    if (!contract || !userAddress || currentRoundId <= 1n) {
      setRounds([]);
      return;
    }

    let cancelled = false;

    const fetchPastRounds = async () => {
      setLoading(true);
      try {
        const pastRounds: RoundData[] = [];
        const roundsToCheck = Math.min(Number(currentRoundId) - 1, 5); // Show last 5 rounds
        
        for (let i = 1; i <= roundsToCheck; i++) {
          const roundId = Number(currentRoundId) - i;
          
          try {
            const [results, userVote] = await Promise.all([
              contract.read.getRoundResults([BigInt(roundId)]),
              contract.read.getUserVote([BigInt(roundId), userAddress as `0x${string}`])
            ]);

            if (userVote[0]) { // hasVoted
              pastRounds.push({
                roundId,
                redCount: results[0],
                blueCount: results[1],
                totalRedAmount: results[2],
                totalBlueAmount: results[3],
                isDecrypted: results[4],
                userVote: {
                  hasVoted: userVote[0],
                  isRed: userVote[1],
                  amount: userVote[2]
                }
              });
            }
          } catch (error) {
            console.error(`Error loading round ${roundId}:`, error);
          }
        }

        if (!cancelled) {
          setRounds(pastRounds);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error loading past rounds:', error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchPastRounds();

    return () => {
      cancelled = true;
    };
  }, [contract?.address, currentRoundId, userAddress]);

  const handleClaim = async (roundId: number) => {
    try {
      setClaiming(roundId);
      await onClaimReward(roundId);
      alert('Reward claimed successfully!');
      // 领取奖励后，重新加载历史轮次数据
      // 通过改变 currentRoundId 触发上面的 useEffect，或者你也可以在父组件里主动刷新
    } catch (error) {
      console.error('Claim error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error claiming reward: ${errorMessage}`);
    } finally {
      setClaiming(null);
    }
  };

  const handleDecryptRequest = async (round: RoundData) => {
    if (!onDecryptRound) return;

    // Sepolia: use real relayer-based decryption
    if (isSepolia && contract) {
      try {
        setDecrypting(round.roundId);
        const { redCount, blueCount } = await autoDecryptRound({
          roundId: round.roundId,
          contractAddress: contract.address,
        });
        alert(`Round #${round.roundId} decrypted via relayer: Red=${redCount}, Blue=${blueCount}`);
      } catch (error) {
        console.error('Auto decrypt error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        alert(`Error auto decrypting round: ${errorMessage}`);
      } finally {
        setDecrypting(null);
      }
      return;
    }

    // Local hardhat / other networks: keep manual modal-based estimation
    const estimatedRedCount = Math.ceil(Number(formatEther(round.totalRedAmount)) / 0.1);
    const estimatedBlueCount = Math.ceil(Number(formatEther(round.totalBlueAmount)) / 0.1);
    
    setShowDecryptModal({
      roundId: round.roundId,
      redCount: estimatedRedCount,
      blueCount: estimatedBlueCount
    });
  };

  const handleDecryptConfirm = async () => {
    if (!showDecryptModal || !onDecryptRound) return;
    
    try {
      setDecrypting(showDecryptModal.roundId);
          await onDecryptRound(
            showDecryptModal.roundId,
            showDecryptModal.redCount,
            showDecryptModal.blueCount
          );
      alert('Round decrypted successfully!');
      setShowDecryptModal(null);
      // 解密完成后，依赖 currentRoundId 或父组件触发刷新
    } catch (error) {
      console.error('Decrypt error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error decrypting round: ${errorMessage}`);
    } finally {
      setDecrypting(null);
    }
  };

  if (!userAddress || currentRoundId <= 1n) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Past Rounds</h2>
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (rounds.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Past Rounds</h2>
      
      <div className="space-y-4">
        {rounds.map((round) => {
          const totalPool = Number(formatEther(round.totalRedAmount + round.totalBlueAmount));
          const redAmount = Number(formatEther(round.totalRedAmount));
          const blueAmount = Number(formatEther(round.totalBlueAmount));
          const userChoice = round.userVote.isRed ? 'Red' : 'Blue';
          const userWon = round.isDecrypted && 
            ((round.userVote.isRed && round.redCount < round.blueCount) || 
             (!round.userVote.isRed && round.blueCount < round.redCount));
          
          // Calculate potential reward
          let potentialReward = 0;
          if (round.isDecrypted && userWon) {
            const userBet = Number(formatEther(round.userVote.amount));
            const winningPool = round.userVote.isRed ? redAmount : blueAmount;
            if (winningPool > 0) {
              potentialReward = (userBet * totalPool) / winningPool;
            }
          }
          
          // Calculate profit
          const userBet = Number(formatEther(round.userVote.amount));
          const profit = potentialReward - userBet;
          
          return (
            <div 
              key={round.roundId}
              className={`border rounded-lg p-4 ${
                userWon ? 'border-green-500 bg-green-50' : 
                round.isDecrypted ? 'border-gray-300' : 'border-yellow-500 bg-yellow-50'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Round #{round.roundId}</h3>
                  <p className="text-sm text-gray-600">
                    Your vote: <span className={`font-semibold ${userChoice === 'Red' ? 'text-red-600' : 'text-blue-600'}`}>
                      {userChoice}
                    </span> • {formatEther(round.userVote.amount)} ETH
                  </p>
                </div>
                
                {userWon && round.userVote.amount > 0n && (
                  <button
                    onClick={() => handleClaim(round.roundId)}
                    disabled={claiming === round.roundId}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
                  >
                    {claiming === round.roundId ? 'Claiming...' : '🎁 Claim Reward'}
                  </button>
                )}
              </div>

              {round.isDecrypted ? (
                <>
                  {/* Vote Statistics */}
                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div className={`rounded p-3 ${round.userVote.isRed ? 'bg-red-100 border-2 border-red-400' : 'bg-red-50'}`}>
                      <div className="font-semibold text-red-800 mb-1">🔴 Red Team</div>
                      <div className="text-red-700 font-medium">{round.redCount} voters</div>
                      <div className="text-red-600">{redAmount.toFixed(4)} ETH</div>
                      {round.redCount < round.blueCount && (
                        <div className="mt-1 text-xs font-bold text-red-800">👑 WINNER</div>
                      )}
                    </div>
                    
                    <div className={`rounded p-3 ${!round.userVote.isRed ? 'bg-blue-100 border-2 border-blue-400' : 'bg-blue-50'}`}>
                      <div className="font-semibold text-blue-800 mb-1">🔵 Blue Team</div>
                      <div className="text-blue-700 font-medium">{round.blueCount} voters</div>
                      <div className="text-blue-600">{blueAmount.toFixed(4)} ETH</div>
                      {round.blueCount < round.redCount && (
                        <div className="mt-1 text-xs font-bold text-blue-800">👑 WINNER</div>
                      )}
                    </div>
                  </div>

                  {/* Result Summary */}
                  <div className={`mt-3 p-3 rounded-lg ${
                    userWon ? 'bg-green-100 border border-green-400' : 'bg-gray-100 border border-gray-300'
                  }`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className={`font-bold text-lg ${userWon ? 'text-green-700' : 'text-gray-700'}`}>
                        {userWon ? '🎉 Victory!' : '😔 Defeat'}
                      </span>
                      <span className="text-sm text-gray-600">
                        Total Pool: <span className="font-semibold">{totalPool.toFixed(4)} ETH</span>
                      </span>
                    </div>
                    
                    {userWon && (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Your Bet:</span>
                          <span className="font-medium">{userBet.toFixed(4)} ETH</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Potential Reward:</span>
                          <span className="font-bold text-green-600">{potentialReward.toFixed(4)} ETH</span>
                        </div>
                        <div className="flex justify-between border-t pt-1">
                          <span className="text-gray-700 font-medium">Profit:</span>
                          <span className="font-bold text-green-700">+{profit.toFixed(4)} ETH</span>
                        </div>
                        {round.userVote.amount > 0n && (
                          <div className="mt-2 text-xs text-gray-500 text-center">
                            💡 Click &ldquo;Claim Reward&rdquo; button above to receive your reward
                          </div>
                        )}
                      </div>
                    )}
                    
                    {!userWon && (
                      <div className="text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>Your Bet:</span>
                          <span className="font-medium text-gray-800">{userBet.toFixed(4)} ETH</span>
                        </div>
                        <div className="flex justify-between text-red-600 font-medium">
                          <span>Loss:</span>
                          <span>-{userBet.toFixed(4)} ETH</span>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="text-center py-2 text-yellow-700 bg-yellow-100 rounded">
                    ⏳ Results pending decryption
                  </div>
                  
                  {/* 显示投票金额信息 */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-red-50 rounded p-3">
                      <div className="font-semibold text-red-800 mb-1">🔴 Red Team</div>
                      <div className="text-red-600">{redAmount.toFixed(4)} ETH</div>
                      <div className="text-xs text-red-500 mt-1">~ {Math.ceil(Number(formatEther(round.totalRedAmount)) / 0.1)} voters</div>
                    </div>
                    
                    <div className="bg-blue-50 rounded p-3">
                      <div className="font-semibold text-blue-800 mb-1">🔵 Blue Team</div>
                      <div className="text-blue-600">{blueAmount.toFixed(4)} ETH</div>
                      <div className="text-xs text-blue-500 mt-1">~ {Math.ceil(Number(formatEther(round.totalBlueAmount)) / 0.1)} voters</div>
                    </div>
                  </div>
                  
                  {onDecryptRound && (
                    <button
                      onClick={() => handleDecryptRequest(round)}
                      disabled={decrypting === round.roundId}
                      className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                    >
                      {decrypting === round.roundId ? '⏳ Decrypting...' : '🔓 Decrypt Results'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 解密确认模态框 */}
      {showDecryptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              🔓 Decrypt Round #{showDecryptModal.roundId}
            </h3>
            
            <div className="space-y-4 mb-6">
              <p className="text-gray-700">
                This will decrypt the voting results for Round #{showDecryptModal.roundId}.
              </p>
              
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-gray-900 mb-2">Estimated Results:</h4>
                <div className="flex justify-between items-center">
                  <span className="text-red-700">🔴 Red Votes:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={showDecryptModal.redCount}
                      onChange={(e) => setShowDecryptModal({
                        ...showDecryptModal,
                        redCount: parseInt(e.target.value) || 0
                      })}
                      className="w-20 px-2 py-1 border rounded text-center"
                    />
                    <span className="text-sm text-gray-500">voters</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-700">🔵 Blue Votes:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={showDecryptModal.blueCount}
                      onChange={(e) => setShowDecryptModal({
                        ...showDecryptModal,
                        blueCount: parseInt(e.target.value) || 0
                      })}
                      className="w-20 px-2 py-1 border rounded text-center"
                    />
                    <span className="text-sm text-gray-500">voters</span>
                  </div>
                </div>
                
                {showDecryptModal.redCount < showDecryptModal.blueCount && (
                  <div className="mt-3 text-sm font-semibold text-red-700 text-center">
                    👑 Red wins (minority)
                  </div>
                )}
                {showDecryptModal.blueCount < showDecryptModal.redCount && (
                  <div className="mt-3 text-sm font-semibold text-blue-700 text-center">
                    👑 Blue wins (minority)
                  </div>
                )}
                {showDecryptModal.redCount === showDecryptModal.blueCount && showDecryptModal.redCount > 0 && (
                  <div className="mt-3 text-sm font-semibold text-gray-700 text-center">
                    🤝 Tie - No winner
                  </div>
                )}
              </div>
              
              <p className="text-sm text-gray-600">
                💡 <strong>Note:</strong> In a real FHE system, decryption would be done automatically by an oracle. 
                For testing, you can manually set the vote counts.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDecryptModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDecryptConfirm}
                disabled={decrypting !== null}
                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-400 font-bold"
              >
                {decrypting !== null ? 'Processing...' : 'Confirm Decrypt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

