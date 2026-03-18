export default function RoundScoreboard({ players, round, allRounds, totalScores, isLastRound, isFinalRound, onNextRound, onEndGame, onEditRound }) {
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
      <div className="bg-gray-800 rounded-xl overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-gray-400 py-2.5 px-3 font-medium">Player</th>
              <th className="text-center text-gray-400 py-2.5 px-3 font-medium">Bid</th>
              <th className="text-center text-gray-400 py-2.5 px-3 font-medium">Won</th>
              <th className="text-right text-gray-400 py-2.5 px-3 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {activePlayers.map((player) => {
              const score = round.scores[player.id] || 0;
              const bid = round.bids[player.id];
              const tricks = round.tricks[player.id];
              const total = totalScores[player.id] || 0;

              return (
                <tr key={player.id} className="border-b border-gray-700/50 last:border-0">
                  <td className="py-2.5 px-3 text-white font-medium">{player.name}</td>
                  <td className="py-2.5 px-3 text-center text-gray-300">{bid}</td>
                  <td className="py-2.5 px-3 text-center text-gray-300">{tricks}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={`font-bold ${
                      total > 0 ? 'text-green-300' : total < 0 ? 'text-red-300' : 'text-gray-300'
                    }`}>
                      {total}
                    </span>
                    <span className={`ml-1 text-xs ${
                      score > 0 ? 'text-green-400' : score < 0 ? 'text-red-400' : 'text-gray-500'
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
          <h4 className="text-gray-400 text-sm font-medium mb-2">All Rounds</h4>
          <div className="bg-gray-800 rounded-xl overflow-x-auto">
            <table className="w-full text-xs min-w-max">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-500 py-2 px-2 font-medium">Rd</th>
                  {activePlayers.map(p => (
                    <th key={p.id} className="text-center text-gray-400 py-2 px-2 font-medium min-w-[70px]">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {completedRounds.map((r, ri) => {
                  const winnerIds = getRoundWinnerIds(r);
                  return (
                  <tr key={r.roundNumber} className={`border-b border-gray-700/30 ${
                    r.roundNumber === round.roundNumber ? 'bg-blue-900/20' : ''
                  }`}>
                    <td className="py-1.5 px-2 text-gray-500">{r.roundNumber}</td>
                    {activePlayers.map(player => {
                      const score = r.scores[player.id];
                      if (score === undefined) {
                        return <td key={player.id} className="py-1.5 px-2 text-center text-gray-600">—</td>;
                      }
                      const runningTotal = getRunningTotal(player.id, ri);
                      const isWinner = winnerIds.includes(player.id);
                      return (
                        <td key={player.id} className={`py-1.5 px-2 text-center ${isWinner ? 'bg-amber-900/30' : ''}`}>
                          <span className={`font-medium ${isWinner ? 'text-amber-200' : 'text-gray-200'}`}>{runningTotal}</span>
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

      <div className="flex gap-3">
        <button
          onClick={onEditRound}
          className="py-3 px-4 rounded-xl bg-gray-700 text-gray-300 font-medium active:bg-gray-600 text-sm"
        >
          Edit Round
        </button>
        {isLastRound || isFinalRound ? (
          <button
            onClick={onEndGame}
            className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold active:bg-green-500"
          >
            End Game
          </button>
        ) : (
          <button
            onClick={onNextRound}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold active:bg-blue-500"
          >
            Next Round
          </button>
        )}
      </div>
    </div>
  );
}
