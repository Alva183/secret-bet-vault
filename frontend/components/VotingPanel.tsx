'use client';

import { useState } from 'react';

interface Round {
  isActive: boolean;
  userHasVoted: boolean;
}

interface VotingPanelProps {
  round: Round;
  userAddress?: string;
  onVote: (isRed: boolean, amount: string) => Promise<void>;
  onEndRound: () => Promise<void>;
  timeRemaining: number;
}

export function VotingPanel({ round, userAddress, onVote, onEndRound, timeRemaining }: VotingPanelProps) {
  const [amount, setAmount] = useState('0.1');
  const [voting, setVoting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [lastVoteResult, setLastVoteResult] = useState<string | null>(null);
  
  const hasVoted = round.userHasVoted;
  const canEndRound = timeRemaining === 0 && round.isActive;

  // Validate amount input
  const isValidAmount = () => {
    const numAmount = parseFloat(amount);
    return !isNaN(numAmount) && numAmount >= 0.1 && numAmount <= 10;
  };

  const handleVote = async (isRed: boolean) => {
    if (!userAddress || hasVoted || voting) return;

    try {
      setVoting(true);
      await onVote(isRed, amount);

      // Show success message and update status
      const teamName = isRed ? 'Red' : 'Blue';
      const successMessage = `Successfully voted for ${teamName} team with ${amount} ETH!`;
      alert(successMessage);
      setLastVoteResult(successMessage);

      // Trigger UI refresh to update voting state
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Vote error:', error);
      let errorMessage = 'Unknown error occurred';

      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          errorMessage = 'Transaction was cancelled by user';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for transaction';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error - please check your connection';
        } else {
          errorMessage = error.message;
        }
      }

      alert(`Error voting: ${errorMessage}`);
      setLastVoteResult(`Failed: ${errorMessage}`);
    } finally {
      setVoting(false);
    }
  };

  const handleEndRound = async () => {
    try {
      setEnding(true);
      await onEndRound();
      alert('Round ended successfully!');
    } catch (error) {
      console.error('End round error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error ending round: ${errorMessage}`);
    } finally {
      setEnding(false);
    }
  };

  if (!round.isActive) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 text-center">
        <p className="text-xl text-gray-600">Round has ended. Waiting for results...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6 border-t-4 border-blue-500">
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">🗳️ Cast Your Vote</h2>
      
      {hasVoted ? (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-center">
          <strong className="font-bold">✓ You have already voted in this round!</strong>
          <p className="text-sm mt-1">Wait for the round to end to see results</p>
        </div>
      ) : (
        <>
          {/* Amount Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Bet Amount (ETH)
            </label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Minimum 0.1 ETH"
            />
            <p className="text-xs text-gray-500">Minimum bet: 0.1 ETH</p>
          </div>

          {/* Vote Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleVote(true)}
              disabled={voting || hasVoted || !isValidAmount()}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg transition-colors shadow-lg transform hover:scale-105 active:scale-95"
            >
              {voting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Voting...
                </span>
              ) : (
                <>
                  🔴 Vote RED
                </>
              )}
            </button>
            
            <button
              onClick={() => handleVote(false)}
              disabled={voting || hasVoted || !isValidAmount()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg transition-colors shadow-lg transform hover:scale-105 active:scale-95"
            >
              {voting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Voting...
                </span>
              ) : (
                <>
                  🔵 Vote BLUE
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* End Round Button */}
      {canEndRound && (
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={handleEndRound}
            disabled={ending}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            {ending ? 'Ending Round...' : 'End Round & Start New'}
          </button>
        </div>
      )}
    </div>
  );
}


