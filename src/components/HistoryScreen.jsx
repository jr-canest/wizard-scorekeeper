import { useEffect, useState } from 'react';
import { getAllPlayers, getRecentGames } from '../utils/firebase';

const medalEmojis = ['🥇', '🥈', '🥉'];

const SORT_COLUMNS = [
  { key: 'winRate', label: 'Win%', width: 'w-14' },
  { key: 'wins', label: 'W', width: 'w-10' },
  { key: 'gamesPlayed', label: 'GP', width: 'w-10' },
  { key: 'avg', label: 'Avg', width: 'w-14' },
  { key: 'bestScore', label: 'Best', width: 'w-14' },
];

function getPlayerSortValue(player, key) {
  const gp = player.gamesPlayed || 0;
  switch (key) {
    case 'winRate': return gp > 0 ? (player.wins || 0) / gp : 0;
    case 'wins': return player.wins || 0;
    case 'gamesPlayed': return gp;
    case 'avg': return gp > 0 ? (player.totalScore || 0) / gp : 0;
    case 'bestScore': return player.bestScore ?? -Infinity;
    default: return 0;
  }
}

export default function HistoryScreen({ onClose }) {
  const [tab, setTab] = useState('players'); // 'players' | 'games'
  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('winRate');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([getAllPlayers(), getRecentGames(30)])
      .then(([p, g]) => {
        setPlayers(p);
        setGames(g);
      })
      .catch(err => {
        console.error('Failed to load history:', err);
        setError('Could not load history');
      })
      .finally(() => setLoading(false));
  }, []);

  function handleSort(key) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false); // default descending
    }
  }

  const sortedPlayers = [...players].sort((a, b) => {
    const aVal = getPlayerSortValue(a, sortKey);
    const bVal = getPlayerSortValue(b, sortKey);
    const diff = bVal - aVal;
    return sortAsc ? -diff : diff;
  });

  function formatDate(timestamp) {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div className="fixed inset-0 z-40 overflow-auto"
      style={{ background: 'linear-gradient(180deg, #0e1a38 0%, #091228 50%, #060d1e 100%)' }}>
      <div className="p-4 max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">History</h2>
          <button
            onClick={onClose}
            className="text-navy-200 text-2xl active:text-white px-2"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('players')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'players'
                ? 'btn-gold'
                : 'bg-navy-700/60 text-navy-200 active:bg-navy-600/60'
            }`}
          >
            All-Time Stats
          </button>
          <button
            onClick={() => setTab('games')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'games'
                ? 'btn-gold'
                : 'bg-navy-700/60 text-navy-200 active:bg-navy-600/60'
            }`}
          >
            Past Games
          </button>
        </div>

        {loading && (
          <div className="text-center py-12">
            <p className="text-navy-200 text-sm">Loading history...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* All-Time Player Stats */}
        {!loading && !error && tab === 'players' && (
          <>
            {sortedPlayers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-navy-200 text-sm">No games recorded yet.</p>
                <p className="text-navy-200/50 text-xs mt-1">Finish a game to see stats here!</p>
              </div>
            ) : (
              <div className="card-gold overflow-hidden">
                <div className="px-3 py-2 border-b border-gold-700/40">
                  <div className="flex text-gold-200/70 text-xs font-medium">
                    <span className="w-8"></span>
                    <span className="flex-1">Player</span>
                    {SORT_COLUMNS.map(col => (
                      <button
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={`${col.width} text-center active:text-gold-100 ${
                          col.key === 'bestScore' ? 'text-right' : ''
                        } ${sortKey === col.key ? 'text-gold-200' : ''}`}
                      >
                        {col.label}{sortKey === col.key ? (sortAsc ? ' ↑' : ' ↓') : ''}
                      </button>
                    ))}
                  </div>
                </div>
                {sortedPlayers.map((player, i) => {
                  const gp = player.gamesPlayed || 0;
                  const avg = gp > 0 ? Math.round(player.totalScore / gp) : 0;
                  const winRate = gp > 0 ? Math.round(((player.wins || 0) / gp) * 100) : 0;
                  const medal = i < 3 ? medalEmojis[i] : null;
                  return (
                    <div
                      key={player.id}
                      className={`flex items-center px-3 py-2.5 border-b border-gold-700/20 last:border-0 ${
                        i === 0 ? 'bg-gold-300/8' : ''
                      }`}
                    >
                      <span className={`text-sm font-bold w-8 ${i === 0 ? 'text-gold-200' : 'text-navy-200'}`}>
                        {medal || `${i + 1}.`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-white font-medium text-sm truncate block">{player.name}</span>
                        {(player.totalShamePoints || 0) > 0 && (
                          <span className="text-red-400 text-[10px]">
                            💀 {player.totalShamePoints}
                          </span>
                        )}
                      </div>
                      <span className="w-14 text-center text-gold-100 text-sm font-semibold">{winRate}%</span>
                      <span className="w-10 text-center text-green-400 text-sm font-semibold">{player.wins || 0}</span>
                      <span className="w-10 text-center text-navy-200 text-sm">{gp}</span>
                      <span className={`w-14 text-center text-sm font-medium ${
                        avg > 0 ? 'text-green-400' : avg < 0 ? 'text-red-400' : 'text-navy-200'
                      }`}>
                        {avg}
                      </span>
                      <span className="w-14 text-right text-gold-200 text-sm font-medium">
                        {player.bestScore ?? '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Past Games */}
        {!loading && !error && tab === 'games' && (
          <>
            {games.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-navy-200 text-sm">No games recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {games.map((game) => {
                  const results = [...(game.results || [])].sort((a, b) => a.rank - b.rank);
                  const winner = results[0];
                  return (
                    <div key={game.id} className="card-gold p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gold-200/70 text-xs">
                          {formatDate(game.date)} — {game.roundCount} round{game.roundCount !== 1 ? 's' : ''}
                        </span>
                        <span className="text-navy-200/50 text-xs">{game.playerCount} players</span>
                      </div>
                      <div className="space-y-1">
                        {results.map((r, ri) => {
                          const medal = ri < 3 ? medalEmojis[ri] : null;
                          return (
                            <div key={r.playerId} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold w-6 ${ri === 0 ? 'text-gold-200' : 'text-navy-200'}`}>
                                  {medal || `${r.rank}.`}
                                </span>
                                <span className={`text-sm ${ri === 0 ? 'text-white font-medium' : 'text-gray-300'}`}>
                                  {r.name}
                                </span>
                                {(r.shamePoints || 0) > 0 && (
                                  <span className="text-red-400 text-[10px]">💀{r.shamePoints > 1 ? `×${r.shamePoints}` : ''}</span>
                                )}
                              </div>
                              <span className={`text-sm font-semibold ${
                                r.score > 0 ? 'text-green-400' : r.score < 0 ? 'text-red-400' : 'text-navy-200'
                              }`}>
                                {r.score}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
