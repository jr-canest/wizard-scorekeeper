import { useEffect, useState, useRef, useMemo } from 'react';
import { getGameSummary, buildAISummaryPayload } from '../utils/gameSummary';
import { playSparkleSound } from '../utils/sounds';
import { saveGameResult, fetchAISummary, updateGameSummary, isProduction } from '../utils/firebase';
import { isDemoMode } from '../utils/demoScenarios';
import { isTestMode } from '../utils/testMode';
import BarChartRace from './BarChartRace';

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

export default function GameScoreboard({ players, rounds, totalScores, shamePoints, settings, onClose, isGameOver, onKeepPlaying, onNewGame, onShowHistory }) {
  // Memoize derived arrays so downstream components (BarChartRace is 60fps)
  // don't bust their useMemo caches on every parent render.
  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => (totalScores[b.id] || 0) - (totalScores[a.id] || 0)),
    [players, totalScores]
  );
  const completedRounds = useMemo(
    () => rounds.filter(r => r.scores && Object.keys(r.scores).length > 0),
    [rounds]
  );
  const positions = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];

  const [showSparkles, setShowSparkles] = useState(false);
  const [showWipe, setShowWipe] = useState(false);
  const [contentVisible, setContentVisible] = useState(!isGameOver);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const [showReplay, setShowReplay] = useState(isGameOver && completedRounds.length > 1);
  const hasSaved = useRef(false);
  const gameIdRef = useRef(null);

  useEffect(() => {
    if (isGameOver) {
      // Trigger the game-over wipe + sparkles sequence the moment the
      // component is told the game ended.
      setShowWipe(true);
      setShowSparkles(true);
      playSparkleSound();
      const contentTimer = setTimeout(() => setContentVisible(true), 500);
      const wipeTimer = setTimeout(() => setShowWipe(false), 1100);
      const sparkleEnd = setTimeout(() => setShowSparkles(false), 3000);

      // Save game to Firebase (once). Demo and test modes skip this entirely.
      if (!hasSaved.current && !isDemoMode() && !isTestMode()) {
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
        // Pass completedRounds + players so the saved doc carries the
        // round-by-round data (bids, tricks, scores per name) — the
        // History → game detail modal renders the chart + table from it.
        saveGameResult(playerResults, completedRounds.length, completedRounds, players)
          .then((res) => {
            gameIdRef.current = res?.gameId ?? null;
            setSaveStatus('saved');
          })
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
    // Save / animation kicks off once at game-over. The other deps are
    // game data that's already settled by then — re-running on each
    // mutation would re-save and re-fire the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // True minus sign (U+2212) for negatives, per the 1b kit
  function formatNum(n) {
    return n < 0 ? `−${Math.abs(n)}` : `${n}`;
  }

  function formatDelta(score) {
    return score > 0 ? `+${score}` : formatNum(score);
  }

  function getRoundWinnerIds(r) {
    const scores = Object.entries(r.scores || {});
    if (scores.length === 0) return [];
    const maxScore = Math.max(...scores.map(([, s]) => s));
    return scores.filter(([, s]) => s === maxScore).map(([id]) => id);
  }

  // Fallback summary (computed immediately, shown while AI is loading or if AI fails).
  // Intentionally depends only on `isGameOver` so the summary text doesn't
  // change while we wait for the AI fetch — the snapshot at game-end is final.
  const fallbackSummary = useMemo(() =>
    isGameOver ? getGameSummary(sortedPlayers, totalScores, completedRounds, players) : '',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isGameOver]
  );

  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const aiFetchedRef = useRef(false);

  // Fetch AI summary once when game ends (production only)
  useEffect(() => {
    if (!isGameOver || aiFetchedRef.current) return;
    if (sortedPlayers.length < 2) return;
    // Skip AI on localhost except when running a demo preview.
    if (!isProduction() && !isDemoMode()) return;
    // Test games use the deterministic fallback summary — no Cloud
    // Function call, nothing written anywhere.
    if (isTestMode()) return;
    aiFetchedRef.current = true;

    const payload = buildAISummaryPayload(sortedPlayers, totalScores, completedRounds, players, settings || {});
    // Add shame points into payload
    payload.players = payload.players.map((pl) => {
      const player = players.find(p => p.name === pl.name);
      return { ...pl, shamePoints: (player && shamePoints?.[player.id]) || 0 };
    });

    // Loading flag fires synchronously, then resolves via .then/.finally.
    setAiLoading(true);
    fetchAISummary(payload)
      .then((s) => {
        if (s) {
          setAiSummary(s);
          // Persist the summary onto the game doc so re-opens don't re-call the API.
          // gameIdRef may not be set yet if saveGameResult is slower than the AI call;
          // in that case we retry after a short delay.
          const persist = (retries = 5) => {
            if (gameIdRef.current) {
              updateGameSummary(gameIdRef.current, s);
            } else if (retries > 0) {
              setTimeout(() => persist(retries - 1), 400);
            }
          };
          persist();
        }
      })
      .finally(() => setAiLoading(false));
    // AI fetch fires once at game-over. The payload is built from
    // game data captured at that moment — re-running on those deps
    // would re-fetch the summary every mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGameOver]);

  const summary = aiSummary || fallbackSummary;

  return (
    <div className={`${isGameOver ? '' : 'fixed inset-0 z-40'} overflow-auto ${isGameOver ? 'min-h-svh' : ''}`}
      style={{ background: 'linear-gradient(180deg, #0b1224 0%, #070d1c 55%, #040913 100%)' }}>

      {showWipe && <WhiteWipe />}
      {showSparkles && <Sparkles />}

      <div className={`p-4 max-w-md mx-auto transition-opacity duration-700 ${
        isGameOver && !contentVisible ? 'opacity-0' : 'opacity-100'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display font-semibold text-[28px] leading-none text-cream-bright">
              {isGameOver ? 'Game over' : 'Scoreboard'}
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
              <button onClick={onShowHistory} className="btn-header">
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
          <div className={`card-gold px-4 py-3.5 mb-4 text-center relative ${aiLoading ? 'summary-shimmer' : ''}`}>
            <style>{`
              @keyframes summary-fade-in {
                from { opacity: 0; transform: translateY(4px); }
                to { opacity: 1; transform: translateY(0); }
              }
              @keyframes summary-shimmer-pulse {
                0%, 100% { box-shadow: inset 0 0 0 1px rgba(254, 205, 70, 0.0); }
                50% { box-shadow: inset 0 0 0 1px rgba(254, 205, 70, 0.45); }
              }
              .summary-shimmer {
                animation: summary-shimmer-pulse 1.4s ease-in-out infinite;
              }
              .summary-text {
                animation: summary-fade-in 0.5s ease-out;
              }
            `}</style>
            <p
              key={summary}
              className="summary-text font-display text-cream text-[17px] leading-[1.6]"
              dangerouslySetInnerHTML={{ __html: summary }}
            />
          </div>
        )}

        {/* Bar Chart Race */}
        {isGameOver && showReplay && completedRounds.length > 1 && (
          <BarChartRace
            players={players}
            completedRounds={completedRounds}
            onDone={() => setShowReplay(false)}
          />
        )}

        {/* Replay button when dismissed */}
        {isGameOver && !showReplay && completedRounds.length > 1 && (
          <button
            onClick={() => setShowReplay(true)}
            className="w-full py-2 mb-4 rounded-lg text-xs text-navy-200/60 border border-navy-600/40 active:bg-navy-700/40"
          >
            ▶ Watch Replay
          </button>
        )}

        {/* Standings */}
        <div className="card-gold overflow-hidden mb-4">
          <div className="px-3 h-8 flex items-center border-b border-gold-300/20">
            <span className="section-label">
              {isGameOver ? 'Final standings' : 'Standings'}
            </span>
          </div>
          {sortedPlayers.map((player) => {
            const total = totalScores[player.id] || 0;
            // Shared rank: find first player with same score
            const rank = sortedPlayers.findIndex(p => (totalScores[p.id] || 0) === total);
            const isFirst = rank === 0 && total > 0;
            const medal = rank < 3 ? medalEmojis[rank] : null;
            const shame = shamePoints?.[player.id] || 0;
            return (
              <div
                key={player.id}
                className={`flex items-center justify-between px-3 py-2.5 border-b border-gold-300/10 last:border-0 ${
                  isFirst ? 'bg-gold-300/[.07]' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold w-8 ${isFirst ? 'text-gold-text' : 'text-navy-200'}`}>
                    {medal || positions[rank]}
                  </span>
                  <span className="font-display font-semibold text-[17px] text-cream-bright">{player.name}</span>
                  {shame > 0 && (
                    <span className="shame-chip" title={`${shame} shame point${shame !== 1 ? 's' : ''}`}>
                      shame{shame > 1 ? ` ×${shame}` : ''}
                    </span>
                  )}
                </div>
                <span className={`font-bold text-[22px] leading-none tabular-nums ${
                  total > 0 ? 'text-[#6ee7b7]' : total < 0 ? 'text-[#fda4af]' : 'text-cream'
                }`}>
                  {formatNum(total)}
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
                <tr className="border-b border-gold-300/20">
                  <th className="text-left text-navy-300 py-2 px-2 font-semibold sticky left-0 bg-[#131b32] z-10 text-[10px] uppercase tracking-[0.14em]">Rd</th>
                  {sortedPlayers.map(p => (
                    <th key={p.id} className="text-center py-2 px-2 font-display font-semibold text-[13px] text-cream min-w-[70px]">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {completedRounds.map((round, ri) => {
                  const winnerIds = getRoundWinnerIds(round);
                  return (
                  <tr key={round.roundNumber} className="border-b border-gold-300/10">
                    <td className="py-2 px-2 text-navy-300 sticky left-0 bg-[#131b32] z-10 font-semibold text-[12px] tabular-nums">{round.roundNumber}</td>
                    {sortedPlayers.map(player => {
                      const score = round.scores[player.id];
                      const wasPlaying = player.addedInRound <= round.roundNumber;
                      if (!wasPlaying || score === undefined) {
                        return <td key={player.id} className="py-2 px-2 text-center text-steel">—</td>;
                      }
                      const runningTotal = getRunningTotal(player.id, ri);
                      const isWinner = winnerIds.includes(player.id);
                      return (
                        <td key={player.id} className={`py-2 px-2 text-center ${isWinner ? 'bg-gold-300/[.07]' : ''}`}>
                          <span className={`font-semibold text-[13px] tabular-nums ${isWinner ? 'text-gold-text' : 'text-cream'}`}>{formatNum(runningTotal)}</span>
                          <span className={`ml-0.5 text-[10px] font-semibold ${
                            score > 0 ? 'text-[#6ee7b7]' : 'text-[#fda4af]'
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
          <div className="space-y-2.5">
            <button onClick={onKeepPlaying} className="btn-gold w-full h-12 text-base">
              Keep playing
            </button>
            <button onClick={onNewGame} className="btn-secondary w-full h-12 text-[15px]">
              New game
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
