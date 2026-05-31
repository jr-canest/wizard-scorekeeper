import { useEffect, useState } from 'react';
import {
  getAllPlayers,
  getRecentGames,
  mergePlayerInto,
  setPrimaryName,
  deleteHistoryGame,
  roundBreakdownFromGame,
} from '../utils/firebase';
import BarChartRace from './BarChartRace';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

const medalEmojis = ['🥇', '🥈', '🥉'];

const SORT_COLUMNS = [
  { key: 'winRate', label: 'Win%' },
  { key: 'wins', label: 'W' },
  { key: 'gamesPlayed', label: 'GP' },
  { key: 'avg', label: 'Avg' },
  { key: 'bestScore', label: 'Best' },
];

// Shared CSS grid template for the All-Time Stats header + rows.
// Applying the same template to both eliminates any header/row drift
// — a column-width change here updates both at once.
//   rank | name (truncating) | Win% | W | GP | Avg | Best
const STATS_GRID =
  'grid grid-cols-[24px_minmax(0,1fr)_44px_26px_26px_44px_44px] items-center';

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

function formatDate(timestamp) {
  if (!timestamp) return '—';
  const date = timestamp.toDate
    ? timestamp.toDate()
    : new Date(timestamp.seconds * 1000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateLong(timestamp) {
  if (!timestamp) return '—';
  const date = timestamp.toDate
    ? timestamp.toDate()
    : new Date(timestamp.seconds * 1000);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function HistoryScreen({ onClose }) {
  const [tab, setTab] = useState('players'); // 'players' | 'games'
  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('winRate');
  const [sortAsc, setSortAsc] = useState(false);
  // { mode: 'view' | 'pickMergeTarget' | 'confirmMerge' | 'merging', ... }
  const [playerDetail, setPlayerDetail] = useState(null);
  const [mergeError, setMergeError] = useState(null);
  // { mode: 'view' | 'confirmDelete' | 'deleting', game }
  const [gameDetail, setGameDetail] = useState(null);
  const [gameDeleteError, setGameDeleteError] = useState(null);

  function loadPlayers() {
    return getAllPlayers().then(setPlayers);
  }

  function loadHistory() {
    setLoading(true);
    setError(null);
    // Race the Firebase fetch against a 15s timeout — without this,
    // a hung WebChannel could leave the spinner up forever.
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 15000),
    );
    Promise.race([
      Promise.all([getAllPlayers(), getRecentGames(30)]),
      timeout,
    ])
      .then(([p, g]) => {
        setPlayers(p);
        setGames(g);
      })
      .catch((err) => {
        console.error('Failed to load history:', err);
        setError(
          err?.message === 'timeout'
            ? 'Connection seems slow. Tap Retry.'
            : 'Could not load history',
        );
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // Mount-time data fetch — also exposed as the Retry button handler.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHistory();
  }, []);

  function handleSort(key) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false); // default descending
    }
  }

  const visiblePlayers = players.filter((p) => !p.mergedInto);
  const sortedPlayers = [...visiblePlayers].sort((a, b) => {
    const aVal = getPlayerSortValue(a, sortKey);
    const bVal = getPlayerSortValue(b, sortKey);
    const diff = bVal - aVal;
    return sortAsc ? -diff : diff;
  });

  async function applyMerge(canonical, alias) {
    setMergeError(null);
    setPlayerDetail({ mode: 'merging', alias, canonical });
    try {
      await mergePlayerInto(canonical.id, alias.id);
      await loadPlayers();
      setPlayerDetail(null);
    } catch (err) {
      setMergeError(err?.message || 'Merge failed.');
      setPlayerDetail({ mode: 'confirmMerge', alias, canonical });
    }
  }

  async function applySetPrimary(player, newName) {
    setMergeError(null);
    try {
      await setPrimaryName(player.id, newName);
      const fresh = await getAllPlayers();
      setPlayers(fresh);
      // Re-open the detail on the freshly-renamed doc so the picker reflects
      // the swap immediately.
      const updated = fresh.find((p) => p.id === player.id);
      if (updated) setPlayerDetail({ mode: 'view', player: updated });
    } catch (err) {
      setMergeError(err?.message || 'Could not change display name.');
    }
  }

  async function applyDeleteGame(game) {
    setGameDeleteError(null);
    setGameDetail({ mode: 'deleting', game });
    try {
      await deleteHistoryGame(game.id);
      setGames((prev) => prev.filter((g) => g.id !== game.id));
      await loadPlayers();
      setGameDetail(null);
    } catch (err) {
      setGameDeleteError(err?.message || 'Delete failed.');
      setGameDetail({ mode: 'confirmDelete', game });
    }
  }

  return (
    <div className="fixed inset-0 z-40 overflow-auto"
      style={{ background: 'linear-gradient(180deg, #0e1a38 0%, #091228 50%, #060d1e 100%)' }}>
      <div className="p-4 max-w-md mx-auto">
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
            <button
              type="button"
              onClick={loadHistory}
              className="mt-3 px-4 py-2 rounded-lg text-sm font-medium btn-gold"
            >
              Retry
            </button>
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
                <div
                  className={`${STATS_GRID} px-3 py-2 border-b border-gold-700/40 text-gold-200/70 text-xs font-medium`}
                >
                  <span />
                  <span>Player</span>
                  {SORT_COLUMNS.map(col => (
                    <button
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`active:text-gold-100 ${
                        col.key === 'bestScore' ? 'text-right' : 'text-center'
                      } ${sortKey === col.key ? 'text-gold-200' : ''}`}
                    >
                      {col.label}{sortKey === col.key ? (sortAsc ? ' ↑' : ' ↓') : ''}
                    </button>
                  ))}
                </div>
                {sortedPlayers.map((player, i) => {
                  const gp = player.gamesPlayed || 0;
                  const avg = gp > 0 ? Math.round(player.totalScore / gp) : 0;
                  const winRate = gp > 0 ? Math.round(((player.wins || 0) / gp) * 100) : 0;
                  const medal = i < 3 ? medalEmojis[i] : null;
                  const hasAliases = (player.aliases || []).length > 0;
                  return (
                    <button
                      type="button"
                      key={player.id}
                      onClick={() => {
                        setMergeError(null);
                        setPlayerDetail({ mode: 'view', player });
                      }}
                      className={`w-full text-left ${STATS_GRID} px-3 py-2.5 border-b border-gold-700/20 last:border-0 active:bg-navy-700/40 ${
                        i === 0 ? 'bg-gold-300/8' : ''
                      }`}
                    >
                      <span className={`text-sm font-bold ${i === 0 ? 'text-gold-200' : 'text-navy-200'}`}>
                        {medal || `${i + 1}.`}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-white font-medium text-sm truncate min-w-0">
                            {player.name}
                          </span>
                          {hasAliases && (
                            <span
                              title={`Also: ${player.aliases.join(', ')}`}
                              className="shrink-0 text-[9px] leading-none px-1 py-0.5 rounded-full bg-navy-700/80 border border-gold-700/40 text-gold-200 font-normal tabular-nums"
                            >
                              ⓘ {player.aliases.length}
                            </span>
                          )}
                        </div>
                        {(player.totalShamePoints || 0) > 0 && (
                          <span className="text-red-400 text-[10px] block">
                            💀 {player.totalShamePoints}
                          </span>
                        )}
                      </div>
                      <span className="text-center text-gold-100 text-sm font-semibold tabular-nums">{winRate}%</span>
                      <span className="text-center text-green-400 text-sm font-semibold tabular-nums">{player.wins || 0}</span>
                      <span className="text-center text-navy-200 text-sm tabular-nums">{gp}</span>
                      <span className={`text-center text-sm font-medium tabular-nums ${
                        avg > 0 ? 'text-green-400' : avg < 0 ? 'text-red-400' : 'text-navy-200'
                      }`}>
                        {avg}
                      </span>
                      <span className="text-right text-gold-200 text-sm font-medium tabular-nums">
                        {player.bestScore ?? '—'}
                      </span>
                    </button>
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
                  return (
                    <button
                      type="button"
                      key={game.id}
                      onClick={() => {
                        setGameDeleteError(null);
                        setGameDetail({ mode: 'view', game });
                      }}
                      className="w-full text-left card-gold p-3 active:bg-navy-700/30 transition-colors"
                    >
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
                            <div key={`${r.playerId || r.name}-${ri}`} className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`text-xs font-bold w-6 ${ri === 0 ? 'text-gold-200' : 'text-navy-200'}`}>
                                  {medal || `${r.rank}.`}
                                </span>
                                <span className={`text-sm truncate ${ri === 0 ? 'text-white font-medium' : 'text-gray-300'}`}>
                                  {r.name}
                                </span>
                                {(r.shamePoints || 0) > 0 && (
                                  <span className="text-red-400 text-[10px]">💀{r.shamePoints > 1 ? `×${r.shamePoints}` : ''}</span>
                                )}
                              </div>
                              <span className={`text-sm font-semibold tabular-nums ${
                                r.score > 0 ? 'text-green-400' : r.score < 0 ? 'text-red-400' : 'text-navy-200'
                              }`}>
                                {r.score}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {playerDetail && (
        <PlayerDetailOverlay
          state={playerDetail}
          visiblePlayers={visiblePlayers}
          mergeError={mergeError}
          onClose={() => {
            setPlayerDetail(null);
            setMergeError(null);
          }}
          onStartMerge={() => {
            if (playerDetail.mode === 'view') {
              setPlayerDetail({ mode: 'pickMergeTarget', player: playerDetail.player });
            }
          }}
          onSetPrimary={(newName) => {
            if (playerDetail.mode === 'view') {
              applySetPrimary(playerDetail.player, newName);
            }
          }}
          onPickTarget={(target) => {
            if (playerDetail.mode === 'pickMergeTarget') {
              setPlayerDetail({ mode: 'confirmMerge', alias: playerDetail.player, canonical: target });
            }
          }}
          onConfirmMerge={() => {
            if (playerDetail.mode === 'confirmMerge') {
              applyMerge(playerDetail.canonical, playerDetail.alias);
            }
          }}
          onBackToView={() => {
            if (playerDetail.mode === 'pickMergeTarget') {
              setPlayerDetail({ mode: 'view', player: playerDetail.player });
            } else if (playerDetail.mode === 'confirmMerge') {
              setPlayerDetail({ mode: 'pickMergeTarget', player: playerDetail.alias });
            }
          }}
        />
      )}

      {gameDetail && (
        <GameDetailOverlay
          state={gameDetail}
          deleteError={gameDeleteError}
          onClose={() => {
            setGameDetail(null);
            setGameDeleteError(null);
          }}
          onStartDelete={() => {
            if (gameDetail.mode === 'view') {
              setGameDeleteError(null);
              setGameDetail({ mode: 'confirmDelete', game: gameDetail.game });
            }
          }}
          onCancelDelete={() => {
            if (gameDetail.mode === 'confirmDelete') {
              setGameDetail({ mode: 'view', game: gameDetail.game });
            }
          }}
          onConfirmDelete={() => {
            if (gameDetail.mode === 'confirmDelete') {
              applyDeleteGame(gameDetail.game);
            }
          }}
        />
      )}
    </div>
  );
}

// ─── Player detail / merge overlay ─────────────────────

function PlayerDetailOverlay({
  state,
  visiblePlayers,
  mergeError,
  onClose,
  onStartMerge,
  onSetPrimary,
  onPickTarget,
  onConfirmMerge,
  onBackToView,
}) {
  useBodyScrollLock();
  const isMerging = state.mode === 'merging';
  return (
    <div
      className="fixed inset-0 z-50 bg-navy-900/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
      onClick={isMerging ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md card-gold p-4 space-y-3 overflow-y-auto"
        style={{ maxHeight: 'calc(85vh / var(--ui-zoom, 1))' }}
      >
        {(state.mode === 'view' || state.mode === 'pickMergeTarget') && (
          <DetailHeader
            title={state.player.name}
            subtitle={state.mode === 'pickMergeTarget' ? 'Pick the player to merge this INTO' : null}
            onBack={state.mode === 'pickMergeTarget' ? onBackToView : null}
            onClose={onClose}
          />
        )}
        {(state.mode === 'confirmMerge' || isMerging) && (
          <DetailHeader
            title={state.alias.name}
            subtitle="Confirm merge"
            onBack={isMerging ? null : onBackToView}
            onClose={isMerging ? null : onClose}
          />
        )}

        {state.mode === 'view' && (
          <PlayerViewBody
            player={state.player}
            onStartMerge={onStartMerge}
            onSetPrimary={onSetPrimary}
          />
        )}
        {mergeError && state.mode === 'view' && (
          <p className="text-red-400 text-xs text-center">{mergeError}</p>
        )}
        {state.mode === 'pickMergeTarget' && (
          <PlayerPickBody
            self={state.player}
            visiblePlayers={visiblePlayers}
            onPick={onPickTarget}
          />
        )}
        {(state.mode === 'confirmMerge' || isMerging) && (
          <MergeConfirmBody
            alias={state.alias}
            canonical={state.canonical}
            mergeError={mergeError}
            isMerging={isMerging}
            onConfirm={onConfirmMerge}
            onCancel={onBackToView}
          />
        )}
      </div>
    </div>
  );
}

function DetailHeader({ title, subtitle, onBack, onClose }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-gold-200 text-base font-bold truncate">{title}</p>
        {subtitle && (
          <p className="text-navy-200 text-xs uppercase tracking-wider mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-navy-200 text-xs underline underline-offset-2"
          >
            ← back
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-navy-200 text-sm px-2 py-0.5 rounded hover:bg-navy-700/60"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function PlayerViewBody({ player, onStartMerge, onSetPrimary }) {
  const gp = player.gamesPlayed || 0;
  const aliases = player.aliases || [];
  return (
    <>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="GP" value={gp} />
        <Stat label="Wins" value={player.wins || 0} />
        <Stat label="Win%" value={gp > 0 ? `${Math.round(((player.wins || 0) / gp) * 100)}%` : '—'} />
        <Stat label="Total" value={(player.totalScore || 0).toString()} />
        <Stat label="Best" value={player.bestScore ?? '—'} />
        <Stat label="Avg" value={gp > 0 ? Math.round((player.totalScore || 0) / gp) : '—'} />
      </div>
      <div className="rounded-md bg-navy-900/50 border border-gold-700/30 p-2.5">
        <p className="text-xs uppercase tracking-wider text-navy-200 mb-1">Display name</p>
        {aliases.length === 0 ? (
          <p className="text-navy-300 text-xs italic">
            No aliases. Tap "Merge into…" if this player is the same as another listed name.
          </p>
        ) : (
          <>
            <p className="text-[11px] text-navy-300 mb-1.5">
              Tap a name to show it on the leaderboard. The others stay as aliases.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[player.name, ...aliases].map((n) => {
                const isCurrent = n === player.name;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => onSetPrimary?.(n)}
                    className={`text-sm px-2.5 py-1 rounded-full border tabular-nums transition ${
                      isCurrent
                        ? 'bg-gold-300/15 border-gold-400 text-gold-100 font-semibold'
                        : 'bg-navy-800 border-gold-700/50 text-navy-100 active:scale-[0.97]'
                    }`}
                  >
                    {n}{isCurrent ? ' ✓' : ''}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onStartMerge}
        className="w-full rounded-lg py-2.5 text-sm font-semibold bg-navy-800 border border-gold-700/60 text-gold-200 active:scale-[0.99]"
      >
        Merge {player.name} into another player…
      </button>
    </>
  );
}

function PlayerPickBody({ self, visiblePlayers, onPick }) {
  const [filter, setFilter] = useState('');
  const f = filter.trim().toLowerCase();
  const choices = visiblePlayers
    .filter((p) => p.id !== self.id)
    .filter((p) => !f || (p.name || '').toLowerCase().includes(f))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return (
    <>
      <p className="text-xs text-navy-200">
        Stats from <span className="text-gold-100">{self.name}</span> will be folded into the player you pick, and{' '}
        <span className="text-gold-100">{self.name}</span> will be hidden from this list.
      </p>
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search players…"
        className="w-full rounded-md bg-navy-800 border border-gold-700/60 px-2.5 py-1.5 text-sm text-navy-50 placeholder:text-navy-300 focus:outline-none focus:border-gold-400"
      />
      <div
        className="overflow-y-auto rounded-md border border-gold-700/30 divide-y divide-gold-700/20"
        style={{ maxHeight: 'calc(40vh / var(--ui-zoom, 1))' }}
      >
        {choices.length === 0 ? (
          <p className="text-navy-300 text-xs italic p-3 text-center">No matching players.</p>
        ) : (
          choices.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p)}
              className="w-full text-left px-3 py-2 active:bg-navy-700/60 flex items-center justify-between gap-2"
            >
              <span className="text-sm text-navy-50 truncate">{p.name}</span>
              <span className="text-[11px] text-navy-300 tabular-nums shrink-0">{p.gamesPlayed || 0} GP</span>
            </button>
          ))
        )}
      </div>
    </>
  );
}

function MergeConfirmBody({ alias, canonical, mergeError, isMerging, onConfirm, onCancel }) {
  return (
    <>
      <div className="rounded-md bg-navy-900/50 border border-gold-700/30 p-3 space-y-2 text-sm">
        <p className="text-navy-50">
          Merge <span className="text-gold-100 font-bold">{alias.name}</span> INTO{' '}
          <span className="text-gold-100 font-bold">{canonical.name}</span>?
        </p>
        <ul className="text-xs text-navy-200 space-y-1">
          <li>• Stats from both rows are summed onto {canonical.name}.</li>
          <li>• {alias.name} will be hidden from the All-Time Stats list.</li>
          <li>• Past games keep the original names.</li>
        </ul>
      </div>
      {mergeError && <p className="text-red-400 text-sm text-center">{mergeError}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isMerging}
          className="flex-1 rounded-lg py-2.5 text-sm font-semibold bg-navy-800 border border-gold-700/60 text-navy-100 active:scale-[0.99] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isMerging}
          className="flex-1 rounded-lg py-2.5 text-sm font-semibold btn-gold border border-gold-400 active:scale-[0.99] disabled:opacity-50"
        >
          {isMerging ? 'Merging…' : `Merge into ${canonical.name}`}
        </button>
      </div>
    </>
  );
}

function Stat({ label, value }) {
  // Square-ish tiles: a min-height + centered stack keeps them from
  // rendering as wide, stretched-looking bars (most noticeable on the
  // larger iPad/desktop zoom, where the same proportions get scaled up).
  return (
    <div className="rounded-md bg-navy-900/50 border border-gold-700/30 px-2 py-2.5 min-h-[3.25rem] flex flex-col items-center justify-center gap-1">
      <p className="text-[10px] uppercase tracking-wider text-navy-300 leading-none">{label}</p>
      <p className="text-base font-bold text-gold-100 tabular-nums leading-none">{value}</p>
    </div>
  );
}

// ─── Game detail overlay ───────────────────────────────

function GameDetailOverlay({
  state,
  deleteError,
  onClose,
  onStartDelete,
  onCancelDelete,
  onConfirmDelete,
}) {
  useBodyScrollLock();
  const isDeleting = state.mode === 'deleting';
  const game = state.game;
  const sortedResults = [...(game.results || [])].sort((a, b) => a.rank - b.rank);
  const breakdown = roundBreakdownFromGame(game);
  const hasGraph = breakdown.length > 0;

  // BarChartRace expects {id, name, addedInRound, startingPoints}.
  // For a game-doc replay we don't know seat order — derive it from
  // the first appearance of each player in the log, falling back to
  // results order. The id is the player NAME because the log's
  // roundScore.scores is keyed by name.
  const playerOrder = (() => {
    if (!Array.isArray(game.log)) {
      return sortedResults.map((r) => r.name);
    }
    const seen = new Set();
    const order = [];
    for (const e of game.log) {
      if (e?.t === 'bid' && !seen.has(e.player)) {
        seen.add(e.player);
        order.push(e.player);
      }
      if (order.length === game.playerCount) break;
    }
    return order.length === game.playerCount
      ? order
      : sortedResults.map((r) => r.name);
  })();

  const racePlayers = playerOrder.map((name) => ({
    id: name,
    name,
    addedInRound: 1,
    startingPoints: 0,
  }));
  const completedRounds = breakdown.map((r) => ({
    roundNumber: r.round,
    scores: r.deltas,
  }));

  return (
    <div
      className="fixed inset-0 z-[60] bg-navy-900/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
      onClick={isDeleting ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md card-gold p-4 space-y-3 overflow-y-auto"
        style={{ maxHeight: 'calc(85vh / var(--ui-zoom, 1))' }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-gold-200 text-base font-bold leading-tight">
              {formatDateLong(game.date)}
            </p>
            <p className="text-navy-200 text-xs mt-0.5">
              {game.roundCount} round{game.roundCount !== 1 ? 's' : ''} ·{' '}
              {game.playerCount} player{game.playerCount !== 1 ? 's' : ''}
            </p>
          </div>
          {!isDeleting && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-navy-200 text-sm px-2 py-0.5 rounded hover:bg-navy-700/60"
            >
              ✕
            </button>
          )}
        </div>

        {hasGraph && (
          <BarChartRace players={racePlayers} completedRounds={completedRounds} />
        )}

        <div className="rounded-md bg-navy-900/50 border border-gold-700/30 p-2.5">
          <p className="text-xs uppercase tracking-wider text-navy-200 mb-1.5">Final standings</p>
          <div className="space-y-1">
            {sortedResults.map((r, ri) => {
              const medal = ri < 3 ? medalEmojis[ri] : null;
              return (
                <div key={`${r.playerId || r.name}-${ri}`} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-bold w-6 ${ri === 0 ? 'text-gold-200' : 'text-navy-200'}`}>
                      {medal || `${r.rank}.`}
                    </span>
                    <span className={`truncate ${ri === 0 ? 'text-white font-medium' : 'text-gray-300'}`}>
                      {r.name}
                    </span>
                  </div>
                  <span className={`font-semibold tabular-nums ${
                    r.score > 0 ? 'text-green-400' : r.score < 0 ? 'text-red-400' : 'text-navy-200'
                  }`}>
                    {r.score}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {hasGraph && (
          <RoundBreakdownTable breakdown={breakdown} playerOrder={playerOrder} />
        )}
        {!hasGraph && (
          <p className="text-navy-300 text-xs italic text-center">
            No round-by-round data was stored for this game.
          </p>
        )}

        <div className="pt-1 border-t border-gold-700/30">
          {state.mode === 'view' && (
            <button
              type="button"
              onClick={onStartDelete}
              className="w-full rounded-lg py-2.5 text-sm font-semibold bg-navy-900 border border-red-700/60 text-red-300 active:scale-[0.99]"
            >
              Delete this game…
            </button>
          )}

          {(state.mode === 'confirmDelete' || isDeleting) && (
            <div className="space-y-2">
              <p className="text-sm text-red-100">Delete this game permanently?</p>
              <ul className="text-xs text-navy-200 space-y-0.5">
                <li>• The game disappears from Past Games.</li>
                <li>
                  • Each player's GP, wins, total score, and shame points roll
                  back by this game's contribution.
                </li>
                <li>
                  • Best / worst scores are recomputed from remaining games —
                  only for players whose best or worst was set by this game.
                </li>
              </ul>
              {deleteError && (
                <p className="text-red-400 text-sm text-center">{deleteError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onCancelDelete}
                  disabled={isDeleting}
                  className="flex-1 rounded-lg py-2.5 text-sm font-semibold bg-navy-800 border border-gold-700/60 text-navy-100 active:scale-[0.99] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirmDelete}
                  disabled={isDeleting}
                  className="flex-1 rounded-lg py-2.5 text-sm font-semibold bg-red-700/60 border border-red-500/70 text-white active:scale-[0.99] disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RoundBreakdownTable({ breakdown, playerOrder }) {
  const cumulative = {};
  for (const n of playerOrder) cumulative[n] = 0;
  return (
    <div className="rounded-md bg-navy-900/50 border border-gold-700/30 p-2.5">
      <p className="text-xs uppercase tracking-wider text-navy-200 mb-1.5">Round-by-round</p>
      <div className="overflow-x-auto -mx-0.5">
        <table className="w-full text-[11px] tabular-nums">
          <thead>
            <tr className="text-navy-300">
              <th className="text-left font-normal pr-1 sticky left-0 bg-navy-900/50 z-10">R</th>
              {playerOrder.map((n) => (
                <th
                  key={n}
                  className="font-normal px-1 text-right truncate max-w-[60px]"
                  title={n}
                >
                  {n.length > 6 ? `${n.slice(0, 5)}…` : n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {breakdown.map((r) => {
              for (const n of playerOrder) {
                cumulative[n] = (cumulative[n] || 0) + (r.deltas[n] || 0);
              }
              return (
                <tr key={r.round} className="border-t border-gold-700/15 align-top">
                  <td className="pr-1 text-gold-200 sticky left-0 bg-navy-900/50 z-10 py-1">{r.round}</td>
                  {playerOrder.map((n) => {
                    const bid = r.bids[n];
                    const won = r.tricks[n] || 0;
                    const delta = r.deltas[n] || 0;
                    const total = cumulative[n] || 0;
                    const hit = bid !== undefined && bid === won;
                    return (
                      <td key={n} className="px-1 text-right py-1 leading-tight">
                        <div className={`text-[11px] ${hit ? 'text-green-400' : 'text-navy-100'}`}>
                          {bid !== undefined ? `${won}/${bid}` : '—'}
                        </div>
                        <div className={`text-[10px] ${
                          delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-navy-300'
                        }`}>
                          {delta > 0 ? '+' : ''}{delta}
                        </div>
                        <div className="text-[10px] text-gold-200">{total}</div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-navy-300 mt-1.5">
        Each cell: won/bid · Δ · running total
      </p>
    </div>
  );
}
