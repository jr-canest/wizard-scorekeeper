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
      {/* Logo header */}
      <div className="text-center mb-5 pt-2">
        <img
          src={`${import.meta.env.BASE_URL}wizard-logo.svg`}
          alt="Wizard"
          className="h-12 mx-auto mb-1"
        />
        <p className="text-gold-100/60 text-xs tracking-widest uppercase">Score Keeper</p>
      </div>

      <section className="mb-4">
        <h2 className="text-lg font-semibold text-gold-100 mb-0.5">Players</h2>
        <p className="text-navy-200 text-xs mb-2">Hold and drag to reorder. Tap D to set dealer.</p>
        <div className="space-y-1.5" ref={listRef}>
          {players.map((player, i) => (
            <div
              key={player.id}
              className={`flex items-center gap-1.5 p-1 transition-all ${
                dragIndex === i ? 'scale-[1.02] shadow-lg' : ''
              }`}
              onMouseDown={e => handleDragStart(e, i)}
              onTouchStart={e => handleDragStart(e, i)}
            >
              <div className="text-gold-200/50 cursor-grab active:cursor-grabbing px-1 text-lg touch-none">
                ⠿
              </div>
              <input
                type="text"
                value={player.name}
                onChange={e => updateName(i, e.target.value)}
                placeholder={`Player ${i + 1}`}
                className="flex-1 bg-navy-800/60 border border-gold-700/60 rounded-lg px-3 py-2.5 text-white placeholder-navy-200/50 focus:border-gold-300 focus:outline-none select-text"
                maxLength={20}
              />
              <button
                onClick={() => setFirstDealerIndex(i)}
                className={`px-2 py-1 rounded-lg text-sm font-medium shrink-0 flex flex-col items-center min-w-[52px] ${
                  firstDealerIndex === i
                    ? 'text-gold-200'
                    : 'text-navy-200/60 border border-gold-700/30 bg-navy-800/40'
                }`}
                title="Set as first dealer"
              >
                {firstDealerIndex === i ? (
                  <>
                    <span className="text-lg leading-none">♛</span>
                    <span className="text-xs">Dealer</span>
                  </>
                ) : (
                  <span>D</span>
                )}
              </button>
              {players.length > MIN_PLAYERS && (
                <button
                  onClick={() => removePlayer(i)}
                  className="text-red-400/80 text-lg px-1 active:text-red-300"
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
            className="mt-2 w-full py-2 rounded-xl text-sm font-medium text-gold-200 border border-dashed border-gold-700/60 active:bg-gold-300/10"
          >
            + Add Player
          </button>
        )}
        {maxRounds && (
          <p className="text-navy-100 text-sm mt-2 text-center">
            {namedPlayers.length} players — {maxRounds} rounds max
          </p>
        )}
      </section>

      <section className="mb-4 space-y-3">
        <h2 className="text-lg font-semibold text-gold-100">Settings</h2>

        <div className="card-gold px-3 py-2.5">
          <label className="flex items-center justify-between">
            <span className="text-gray-200">Canadian Rules</span>
            <div
              onClick={() => setCanadianRules(!canadianRules)}
              className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${
                canadianRules ? 'bg-gold-300' : 'bg-navy-500'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                canadianRules ? 'translate-x-5.5' : 'translate-x-0.5'
              }`} />
            </div>
          </label>
          {canadianRules && (
            <p className="text-navy-200 text-xs mt-2">
              Dealer can't bid to make it even (except round 1)
            </p>
          )}
        </div>
      </section>

      <button
        onClick={handleStart}
        disabled={!canStart}
        className="btn-gold w-full py-3 rounded-xl text-lg"
      >
        Start Game
      </button>
    </div>
  );
}
