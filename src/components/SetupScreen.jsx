import { useState, useRef } from 'react';
import { MIN_PLAYERS, MAX_PLAYERS } from '../utils/constants';
import { getMaxRounds } from '../utils/roundCalculations';

export default function SetupScreen({ onStartGame }) {
  const [players, setPlayers] = useState([
    { id: crypto.randomUUID(), name: '' },
    { id: crypto.randomUUID(), name: '' },
  ]);
  const [firstDealerIndex, setFirstDealerIndex] = useState(0);
  const [canadianRules, setCanadianRules] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const listRef = useRef(null);

  const namedPlayers = players.filter(p => p.name.trim());
  const canStart = namedPlayers.length >= MIN_PLAYERS && firstDealerIndex < players.length && players[firstDealerIndex]?.name.trim();

  function addPlayer() {
    if (players.length >= MAX_PLAYERS) return;
    setPlayers([...players, { id: crypto.randomUUID(), name: '' }]);
  }

  function removePlayer(index) {
    if (players.length <= MIN_PLAYERS) return;
    const next = players.filter((_, i) => i !== index);
    setPlayers(next);
    if (firstDealerIndex >= next.length) {
      setFirstDealerIndex(Math.max(0, next.length - 1));
    } else if (firstDealerIndex > index) {
      setFirstDealerIndex(firstDealerIndex - 1);
    }
  }

  function updateName(index, name) {
    const next = [...players];
    next[index] = { ...next[index], name };
    setPlayers(next);
  }

  function reorderPlayers(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const next = [...players];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setPlayers(next);
    if (firstDealerIndex === fromIndex) {
      setFirstDealerIndex(toIndex);
    } else if (fromIndex < firstDealerIndex && toIndex >= firstDealerIndex) {
      setFirstDealerIndex(firstDealerIndex - 1);
    } else if (fromIndex > firstDealerIndex && toIndex <= firstDealerIndex) {
      setFirstDealerIndex(firstDealerIndex + 1);
    }
  }

  const dragState = useRef({ startY: 0 });

  function handleDragStart(e, index) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragState.current = { startY: clientY };
    setDragIndex(index);
  }

  function handleDragMove(e) {
    if (dragIndex === null) return;
    e.preventDefault();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const listEl = listRef.current;
    if (!listEl) return;

    const items = listEl.children;
    for (let i = 0; i < items.length; i++) {
      if (i === dragIndex) continue;
      const rect = items[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (
        (dragIndex < i && clientY > midY) ||
        (dragIndex > i && clientY < midY)
      ) {
        reorderPlayers(dragIndex, i);
        setDragIndex(i);
        break;
      }
    }
  }

  function handleDragEnd() {
    setDragIndex(null);
  }

  function handleStart() {
    const gamePlayers = players
      .filter(p => p.name.trim())
      .map(p => ({ id: p.id, name: p.name.trim(), addedInRound: 1 }));

    const dealerPlayer = players[firstDealerIndex];
    const dealerIdx = gamePlayers.findIndex(p => p.id === dealerPlayer.id);

    onStartGame(gamePlayers, {
      canadianRules,
      roundDirection: 'ascending',
      firstDealerIndex: dealerIdx >= 0 ? dealerIdx : 0,
    });
  }

  const maxRounds = namedPlayers.length >= MIN_PLAYERS ? getMaxRounds(namedPlayers.length) : null;

  return (
    <div
      className="p-4 max-w-md mx-auto select-none"
      onMouseMove={dragIndex !== null ? handleDragMove : undefined}
      onMouseUp={dragIndex !== null ? handleDragEnd : undefined}
      onTouchMove={dragIndex !== null ? handleDragMove : undefined}
      onTouchEnd={dragIndex !== null ? handleDragEnd : undefined}
    >
      <h1 className="text-2xl font-bold text-white text-center mb-6">Wizard Score Keeper</h1>

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">Players</h2>
        <p className="text-gray-500 text-xs mb-3">Hold and drag to reorder. Tap D to set dealer.</p>
        <div className="space-y-2" ref={listRef}>
          {players.map((player, i) => (
            <div
              key={player.id}
              className={`flex items-center gap-2 rounded-lg p-1 transition-all ${
                dragIndex === i ? 'bg-gray-700/50 scale-[1.02] shadow-lg' : ''
              }`}
              onMouseDown={e => handleDragStart(e, i)}
              onTouchStart={e => handleDragStart(e, i)}
            >
              <div className="text-gray-500 cursor-grab active:cursor-grabbing px-1.5 text-lg touch-none">
                ⠿
              </div>
              <input
                type="text"
                value={player.name}
                onChange={e => updateName(i, e.target.value)}
                placeholder={`Player ${i + 1}`}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none select-text"
                maxLength={20}
              />
              <button
                onClick={() => setFirstDealerIndex(i)}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium shrink-0 ${
                  firstDealerIndex === i
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-800 text-gray-400 border border-gray-700'
                }`}
                title="Set as first dealer"
              >
                {firstDealerIndex === i ? 'Dealer' : 'D'}
              </button>
              {players.length > MIN_PLAYERS && (
                <button
                  onClick={() => removePlayer(i)}
                  className="text-red-400 text-lg px-1 active:text-red-300"
                  aria-label="Remove player"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        {players.length < MAX_PLAYERS && (
          <button
            onClick={addPlayer}
            className="mt-3 w-full py-2.5 rounded-lg border border-dashed border-gray-600 text-gray-400 active:bg-gray-800"
          >
            + Add Player
          </button>
        )}
        {maxRounds && (
          <p className="text-gray-400 text-sm mt-2 text-center">
            {namedPlayers.length} players — {maxRounds} rounds max
          </p>
        )}
      </section>

      <section className="mb-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Settings</h2>

        <div className="bg-gray-800 rounded-lg px-4 py-3">
          <label className="flex items-center justify-between">
            <span className="text-gray-200">Canadian Rules</span>
            <div
              onClick={() => setCanadianRules(!canadianRules)}
              className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${
                canadianRules ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                canadianRules ? 'translate-x-5.5' : 'translate-x-0.5'
              }`} />
            </div>
          </label>
          {canadianRules && (
            <p className="text-gray-500 text-xs mt-2">
              Dealer can't bid to make it even (except round 1)
            </p>
          )}
        </div>
      </section>

      <button
        onClick={handleStart}
        disabled={!canStart}
        className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-lg disabled:bg-gray-700 disabled:text-gray-500 active:bg-blue-500"
      >
        Start Game
      </button>
    </div>
  );
}
