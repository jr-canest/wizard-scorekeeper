export default function RoundScoreboard({ players, round, allRounds, totalScores, shamePoints, isLastRound, onNextRound, onEndGame, onEditRound }) {
  // Keep player order, don't sort
  const activePlayers = players.filter(p => p.id in round.scores);

  // All completed rounds for the history table
  const completedRounds = allRounds.filter(r => r.scores && Object.keys(r.scores).length > 0);

  // Compute running totals per round
  function getRunningTotal(playerId, upToRoundIndex) {
    let total = 0;
    for (let i = 0; i <= upToRoundIndex; i++) {
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

  return (
    <div className="mb-4">
      <h3 className="text-white font-semibold mb-3 text-center">Round {round.roundNumber} Results</h3>

      {/* Current round detail */}
      <div className="card-gold overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gold-700/40">
              <th className="text-left text-gold-200/70 py-2.5 px-3 font-medium">Player</th>
              <th className="text-center text-gold-200/70 py-2.5 px-3 font-medium">Bid</th>
              <th className="text-center text-gold-200/70 py-2.5 px-3 font-medium">Won</th>
              <th className="text-right text-gold-200/70 py-2.5 px-3 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {activePlayers.map((player) => {
              const score = round.scores[player.id] || 0;
              const bid = round.bids[player.id];
              const tricks = round.tricks[player.id];
              const total = totalScores[player.id] || 0;

              return (
                <tr key={player.id} className="border-b border-gold-700/20 last:border-0">
                  <td className="py-2.5 px-3 text-white font-medium">
                    {player.name}
                    {(shamePoints?.[player.id] || 0) > 0 && (
                      <span className="text-red-400 text-xs font-bold ml-1.5" title={`${shamePoints[player.id]} shame point${shamePoints[player.id] !== 1 ? 's' : ''}`}>
                        {'💀'.repeat(Math.min(shamePoints[player.id], 5))}{shamePoints[player.id] > 5 ? `×${shamePoints[player.id]}` : ''}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center text-gray-300">{bid}</td>
                  <td className="py-2.5 px-3 text-center text-gray-300">{tricks}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={`font-bold ${
                      total > 0 ? 'text-green-300' : total < 0 ? 'text-red-300' : 'text-gray-300'
                    }`}>
                      {total}
                    </span>
                    <span className={`ml-1 text-xs ${
                      score > 0 ? 'text-green-400' : score < 0 ? 'text-red-400' : 'text-navy-200'
                    }`}>
                      ({formatDelta(score)})
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* All rounds history table */}
      {completedRounds.length > 1 && (
        <div className="mb-4">
          <h4 className="text-gold-200/70 text-sm font-medium mb-2">All Rounds</h4>
          <div className="card-gold overflow-x-auto">
            <table className="w-full text-xs min-w-max">
              <thead>
                <tr className="border-b border-gold-700/40">
                  <th className="text-left text-navy-200 py-2 px-2 font-medium sticky left-0 bg-navy-800/80 z-10">Rd</th>
                  {activePlayers.map(p => (
                    <th key={p.id} className="text-center text-gold-200/70 py-2 px-2 font-medium min-w-[70px]">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {completedRounds.map((r, ri) => {
                  const winnerIds = getRoundWinnerIds(r);
                  return (
                  <tr key={r.roundNumber} className={`border-b border-gold-700/15 ${
                    r.roundNumber === round.roundNumber ? 'bg-gold-300/5' : ''
                  }`}>
                    <td className="py-1.5 px-2 text-navy-200 sticky left-0 bg-navy-800/80 z-10">{r.roundNumber}</td>
                    {activePlayers.map(player => {
                      const score = r.scores[player.id];
                      if (score === undefined) {
                        return <td key={player.id} className="py-1.5 px-2 text-center text-navy-400">—</td>;
                      }
                      const runningTotal = getRunningTotal(player.id, ri);
                      const isWinner = winnerIds.includes(player.id);
                      return (
                        <td key={player.id} className={`py-1.5 px-2 text-center ${isWinner ? 'bg-gold-300/10' : ''}`}>
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
        </div>
      )}

      <div className="space-y-2">
        {isLastRound ? (
          <div className="flex gap-3">
            <button
              onClick={onEditRound}
              className="py-3 px-4 rounded-xl bg-navy-600 text-gray-300 font-medium active:bg-navy-500 text-sm"
            >
              Edit Round
            </button>
            <button
              onClick={onEndGame}
              className="btn-gold flex-1 py-3 rounded-xl"
            >
              End Game
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-3">
              <button
                onClick={onEditRound}
                className="py-3 px-4 rounded-xl bg-navy-600 text-gray-300 font-medium active:bg-navy-500 text-sm"
              >
                Edit Round
              </button>
              <button
                onClick={onNextRound}
                className="btn-gold flex-1 py-3 rounded-xl"
              >
                Next Round
              </button>
            </div>
            <button
              onClick={onEndGame}
              className="w-full py-1.5 text-navy-200/50 text-xs active:text-gray-300"
            >
              End Game
            </button>
          </>
        )}
      </div>
    </div>
  );
}
