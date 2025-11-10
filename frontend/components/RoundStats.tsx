'use client';

import { formatEther } from 'viem';

interface Round {
  roundId: bigint;
  isActive: boolean;
  totalRedAmount: bigint;
  totalBlueAmount: bigint;
  participantCount: bigint;
}

interface RoundStatsProps {
  round: Round;
  timeRemaining: number;
}

export function RoundStats({ round, timeRemaining }: RoundStatsProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalPool = Number(formatEther(round.totalRedAmount + round.totalBlueAmount));
  const redAmount = Number(formatEther(round.totalRedAmount));
  const blueAmount = Number(formatEther(round.totalBlueAmount));

  return (
    <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-xl p-6 text-white">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Round Info */}
        <div className="text-center">
          <h3 className="text-sm font-semibold opacity-80 mb-1">Round</h3>
          <p className="text-3xl font-bold">#{round.roundId.toString()}</p>
        </div>

        {/* Time Remaining */}
        <div className="text-center">
          <h3 className="text-sm font-semibold opacity-80 mb-1">Time Left</h3>
          <p className="text-3xl font-bold font-mono">
            {round.isActive ? formatTime(timeRemaining) : 'Ended'}
          </p>
        </div>

        {/* Total Pool */}
        <div className="text-center">
          <h3 className="text-sm font-semibold opacity-80 mb-1">Total Pool</h3>
          <p className="text-3xl font-bold">{totalPool.toFixed(3)} ETH</p>
        </div>

        {/* Participants */}
        <div className="text-center">
          <h3 className="text-sm font-semibold opacity-80 mb-1">Participants</h3>
          <p className="text-3xl font-bold">{round.participantCount.toString()}</p>
        </div>
      </div>

      {/* Pool Distribution - Hidden during active round */}
      {round.isActive ? (
        <div className="mt-6 bg-white/10 rounded-lg p-6 text-center">
          <div className="text-2xl mb-2">🔒</div>
          <div className="font-semibold text-lg mb-2">Votes are Encrypted</div>
          <p className="text-sm opacity-90">
            Results will be revealed after the round ends. All votes are confidential until then.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>🔴 Red Pool</span>
              <span className="font-semibold">{redAmount.toFixed(3)} ETH</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3">
              <div 
                className="bg-red-500 h-3 rounded-full transition-all duration-500"
                style={{ width: totalPool > 0 ? `${(redAmount / totalPool) * 100}%` : '0%' }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>🔵 Blue Pool</span>
              <span className="font-semibold">{blueAmount.toFixed(3)} ETH</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3">
              <div 
                className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                style={{ width: totalPool > 0 ? `${(blueAmount / totalPool) * 100}%` : '0%' }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="mt-4 bg-white/10 rounded-lg p-3 text-sm text-center">
        <strong>🏆 Minority Wins!</strong> The side with fewer votes splits the entire pool proportionally.
      </div>
    </div>
  );
}

