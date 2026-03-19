export default function GameScoreboard({ players, rounds, totalScores, onClose, isGameOver, onKeepPlaying, onNewGame }) {
  const sortedPlayers = [...players].sort((a, b) => (totalScores[b.id] || 0) - (totalScores[a.id] || 0));
  const completedRounds = rounds.filter(r => r.scores && Object.keys(r.scores).length > 0);
  const positions = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];

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

  return (
    <div className={`${isGameOver ? '' : 'fixed inset-0 z-40'} bg-gray-900 overflow-auto ${isGameOver ? 'min-h-svh' : ''}`}>
      <div className="p-4 max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            {isGameOver ? 'Game Over!' : 'Scoreboard'}
          </h2>
          {!isGameOver && (
            <button
              onClick={onClose}
              className="text-gray-400 text-2xl active:text-white px-2"
            >
              ✕
            </button>
          )}
        </div>

        {/* Standings */}
        <div className="bg-gray-800 rounded-xl overflow-hidden mb-4">
          <div className="px-3 py-2 border-b border-gray-700">
            <span className="text-gray-400 text-sm font-medium">
              {isGameOver ? 'Final Standings' : 'Standings'}
            </span>
          </div>
          {sortedPlayers.map((player, i) => {
            const total = totalScores[player.id] || 0;
            // Shared rank: find first player with same score
            const rank = sortedPlayers.findIndex(p => (totalScores[p.id] || 0) === total);
            const isFirst = rank === 0 && total > 0;
            return (
              <div
                key={player.id}
                className={`flex items-center justify-between px-3 py-2.5 border-b border-gray-700/50 last:border-0 ${
                  isFirst ? 'bg-amber-900/20' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold w-8 ${isFirst ? 'text-amber-400' : 'text-gray-500'}`}>
                    {positions[rank]}
                  </span>
                  <span className="text-white font-medium">{player.name}</span>
                </div>
                <span className={`font-bold text-lg ${
                  total > 0 ? 'text-green-400' : total < 0 ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {total}
                </span>
              </div>
            );
          })}
        </div>

        {/* Round-by-round table */}
        {completedRounds.length > 0 && (
          <div className="bg-gray-800 rounded-xl overflow-x-auto mb-4">
            <table className="w-full text-xs min-w-max">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-500 py-2 px-2 font-medium sticky left-0 bg-gray-800 z-10">Rd</th>
                  {sortedPlayers.map(p => (
                    <th key={p.id} className="text-center text-gray-400 py-2 px-2 font-medium min-w-[70px]">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {completedRounds.map((round, ri) => {
                  const winnerIds = getRoundWinnerIds(round);
                  return (
                  <tr key={round.roundNumber} className="border-b border-gray-700/30">
                    <td className="py-2 px-2 text-gray-500 sticky left-0 bg-gray-800 z-10">{round.roundNumber}</td>
                    {sortedPlayers.map(player => {
                      const score = round.scores[player.id];
                      const wasPlaying = player.addedInRound <= round.roundNumber;
                      if (!wasPlaying || score === undefined) {
                        return <td key={player.id} className="py-2 px-2 text-center text-gray-600">—</td>;
                      }
                      const runningTotal = getRunningTotal(player.id, ri);
                      const isWinner = winnerIds.includes(player.id);
                      return (
                        <td key={player.id} className={`py-2 px-2 text-center ${isWinner ? 'bg-amber-900/30' : ''}`}>
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
        )}

        {/* Game over actions */}
        {isGameOver && (
          <div className="space-y-3">
            <button
              onClick={onKeepPlaying}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold active:bg-blue-500"
            >
              Keep Playing
            </button>
            <button
              onClick={onNewGame}
              className="w-full py-3 rounded-xl bg-gray-700 text-gray-300 font-medium active:bg-gray-600"
            >
              New Game
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
