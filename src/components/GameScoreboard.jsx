import { useEffect, useState, useRef } from 'react';
import { getGameSummary } from '../utils/gameSummary';
import { playSparkleSound } from '../utils/sounds';
import { saveGameResult } from '../utils/firebase';

const medalEmojis = ['🥇', '🥈', '🥉'];

function WhiteWipe() {
  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      <style>{`
        @keyframes wipe-in {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        .white-wipe {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg,
            transparent 0%,
            rgba(255,255,255,0.3) 10%,
            rgba(255,255,255,0.95) 30%,
            white 50%,
            rgba(255,255,255,0.95) 70%,
            rgba(255,255,255,0.3) 90%,
            transparent 100%
          );
          animation: wipe-in 1s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
        }
      `}</style>
      <div className="white-wipe" />
    </div>
  );
}

const sparkleEmojis = ['🪄', '⭐', '✨'];

function Sparkles() {
  const [sparkles] = useState(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: 5 + Math.random() * 90,
      top: 5 + Math.random() * 85,
      delay: Math.random() * 2,
      duration: 0.6 + Math.random() * 0.8,
      size: 20 + Math.random() * 24,
      emoji: sparkleEmojis[i % sparkleEmojis.length],
    }))
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <style>{`
        @keyframes sparkle-pop {
          0% { transform: scale(0); opacity: 0; }
          20% { transform: scale(1.3); opacity: 1; }
          50% { transform: scale(0.9); opacity: 0.9; }
          70% { transform: scale(1.1); opacity: 0.7; }
          100% { transform: scale(0); opacity: 0; }
        }
        .sparkle {
          position: absolute;
          animation: sparkle-pop var(--dur) ease-in-out var(--delay) both;
          animation-iteration-count: 2;
          line-height: 1;
        }
      `}</style>
      {sparkles.map(s => (
        <div
          key={s.id}
          className="sparkle"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            fontSize: s.size,
            '--delay': `${s.delay}s`,
            '--dur': `${s.duration}s`,
          }}
        >
          {s.emoji}
        </div>
      ))}
    </div>
  );
}

export default function GameScoreboard({ players, rounds, totalScores, shamePoints, onClose, isGameOver, onKeepPlaying, onNewGame, onShowHistory }) {
  const sortedPlayers = [...players].sort((a, b) => (totalScores[b.id] || 0) - (totalScores[a.id] || 0));
  const completedRounds = rounds.filter(r => r.scores && Object.keys(r.scores).length > 0);
  const positions = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];

  const [showSparkles, setShowSparkles] = useState(false);
  const [showWipe, setShowWipe] = useState(false);
  const [contentVisible, setContentVisible] = useState(!isGameOver);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const hasSaved = useRef(false);

  useEffect(() => {
    if (isGameOver) {
      setShowWipe(true);
      setShowSparkles(true);
      playSparkleSound();
      const contentTimer = setTimeout(() => setContentVisible(true), 500);
      const wipeTimer = setTimeout(() => setShowWipe(false), 1100);
      const sparkleEnd = setTimeout(() => setShowSparkles(false), 3000);

      // Save game to Firebase (once)
      if (!hasSaved.current) {
        hasSaved.current = true;
        setSaveStatus('saving');
        const playerResults = sortedPlayers.map((player) => {
          const total = totalScores[player.id] || 0;
          const rank = sortedPlayers.findIndex(p => (totalScores[p.id] || 0) === total);
          return {
            name: player.name,
            score: total,
            rank: rank + 1,
            shamePoints: shamePoints?.[player.id] || 0,
          };
        });
        saveGameResult(playerResults, completedRounds.length)
          .then(() => setSaveStatus('saved'))
          .catch((err) => {
            console.error('Failed to save game:', err);
            setSaveStatus('error');
          });
      }

      return () => {
        clearTimeout(contentTimer);
        clearTimeout(wipeTimer);
        clearTimeout(sparkleEnd);
      };
    }
  }, [isGameOver]);

  function getRunningTotal(playerId, upToIndex) {
    let total = players.find(p => p.id === playerId)?.startingPoints || 0;
    for (let i = 0; i <= upToIndex; i++) {
      const r = completedRounds[i];
      if (r && r.scores && r.scores[playerId] !== undefined) {
        total += r.scores[playerId];
      }
    }
    return total;
  }

  function formatDelta(score) {
    return score > 0 ? `+${score}` : `${score}`;
  }

  function getRoundWinnerIds(r) {
    const scores = Object.entries(r.scores || {});
    if (scores.length === 0) return [];
    const maxScore = Math.max(...scores.map(([, s]) => s));
    return scores.filter(([, s]) => s === maxScore).map(([id]) => id);
  }

  const summary = isGameOver ? getGameSummary(sortedPlayers, totalScores, completedRounds, players) : '';

  return (
    <div className={`${isGameOver ? '' : 'fixed inset-0 z-40'} overflow-auto ${isGameOver ? 'min-h-svh' : ''}`}
      style={{ background: 'linear-gradient(180deg, #0e1a38 0%, #091228 50%, #060d1e 100%)' }}>

      {showWipe && <WhiteWipe />}
      {showSparkles && <Sparkles />}

      <div className={`p-4 max-w-lg mx-auto transition-opacity duration-700 ${
        isGameOver && !contentVisible ? 'opacity-0' : 'opacity-100'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">
              {isGameOver ? 'Game Over!' : 'Scoreboard'}
            </h2>
            {isGameOver && saveStatus && (
              <p className={`text-xs mt-0.5 ${
                saveStatus === 'saving' ? 'text-navy-200/50' :
                saveStatus === 'saved' ? 'text-green-400/60' :
                'text-red-400/60'
              }`}>
                {saveStatus === 'saving' ? 'Saving to history...' :
                 saveStatus === 'saved' ? '✓ Saved to history' :
                 '✗ Could not save'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onShowHistory && (
              <button
                onClick={onShowHistory}
                className="text-gold-200 text-sm font-medium px-3 py-1.5 rounded-lg border border-gold-700/50 bg-navy-800/40 active:bg-navy-700/60"
              >
                History
              </button>
            )}
            {!isGameOver && (
              <button
                onClick={onClose}
                className="text-navy-200 text-2xl active:text-white px-2"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Game summary */}
        {isGameOver && summary && (
          <div className="bg-navy-700/60 border border-gold-700/30 rounded-xl px-4 py-3 mb-4 text-center">
            <p className="text-gold-100 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: summary }} />
          </div>
        )}

        {/* Standings */}
        <div className="card-gold overflow-hidden mb-4">
          <div className="px-3 py-2 border-b border-gold-700/40">
            <span className="text-gold-200/70 text-sm font-medium">
              {isGameOver ? 'Final Standings' : 'Standings'}
            </span>
          </div>
          {sortedPlayers.map((player) => {
            const total = totalScores[player.id] || 0;
            // Shared rank: find first player with same score
            const rank = sortedPlayers.findIndex(p => (totalScores[p.id] || 0) === total);
            const isFirst = rank === 0 && total > 0;
            const medal = rank < 3 ? medalEmojis[rank] : null;
            return (
              <div
                key={player.id}
                className={`flex items-center justify-between px-3 py-2.5 border-b border-gold-700/20 last:border-0 ${
                  isFirst ? 'bg-gold-300/8' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold w-8 ${isFirst ? 'text-gold-200' : 'text-navy-200'}`}>
                    {medal || positions[rank]}
                  </span>
                  <span className="text-white font-medium">{player.name}</span>
                  {(shamePoints?.[player.id] || 0) > 0 && (
                    <span className="text-red-400 text-xs font-bold" title={`${shamePoints[player.id]} shame point${shamePoints[player.id] !== 1 ? 's' : ''}`}>
                      💀{shamePoints[player.id] > 1 ? `×${shamePoints[player.id]}` : ''}
                    </span>
                  )}
                </div>
                <span className={`font-bold text-lg ${
                  total > 0 ? 'text-green-400' : total < 0 ? 'text-red-400' : 'text-navy-200'
                }`}>
                  {total}
                </span>
              </div>
            );
          })}
        </div>

        {/* Round-by-round table */}
        {completedRounds.length > 0 && (
          <div className="card-gold overflow-x-auto mb-4">
            <table className="w-full text-xs min-w-max">
              <thead>
                <tr className="border-b border-gold-700/40">
                  <th className="text-left text-navy-200 py-2 px-2 font-medium sticky left-0 bg-navy-800/80 z-10">Rd</th>
                  {sortedPlayers.map(p => (
                    <th key={p.id} className="text-center text-gold-200/70 py-2 px-2 font-medium min-w-[70px]">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {completedRounds.map((round, ri) => {
                  const winnerIds = getRoundWinnerIds(round);
                  return (
                  <tr key={round.roundNumber} className="border-b border-gold-700/15">
                    <td className="py-2 px-2 text-navy-200 sticky left-0 bg-navy-800/80 z-10">{round.roundNumber}</td>
                    {sortedPlayers.map(player => {
                      const score = round.scores[player.id];
                      const wasPlaying = player.addedInRound <= round.roundNumber;
                      if (!wasPlaying || score === undefined) {
                        return <td key={player.id} className="py-2 px-2 text-center text-navy-400">—</td>;
                      }
                      const runningTotal = getRunningTotal(player.id, ri);
                      const isWinner = winnerIds.includes(player.id);
                      return (
                        <td key={player.id} className={`py-2 px-2 text-center ${isWinner ? 'bg-gold-300/10' : ''}`}>
                          <span className={`font-medium ${isWinner ? 'text-gold-100' : 'text-gray-200'}`}>{runningTotal}</span>
                          <span className={`ml-0.5 text-[10px] ${
                            score > 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            ({formatDelta(score)})
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Game over actions */}
        {isGameOver && (
          <div className="space-y-3">
            <button
              onClick={onKeepPlaying}
              className="btn-gold w-full py-3 rounded-xl"
            >
              Keep Playing
            </button>
            <button
              onClick={onNewGame}
              className="w-full py-3 rounded-xl bg-navy-600 text-gray-300 font-medium active:bg-navy-500"
            >
              New Game
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
