import { useState, useRef, useCallback } from 'react';
import { MIN_PLAYERS, MAX_PLAYERS } from '../utils/constants';
import { getMaxRounds } from '../utils/roundCalculations';
import { searchPlayers, isProduction } from '../utils/firebase';
import { getDemoNames } from '../utils/demoScenarios';
import { isTestMode } from '../utils/testMode';

// Test mode preloads throwaway players so a test game is one tap away.
// Nothing is saved in test mode, so these names never reach Firestore.
const TEST_PLAYERS = ['Merlin', 'Gandalf', 'Morgana', 'Radagast'];

export default function SetupScreen({ onStartGame, onShowHistory }) {
  const [players, setPlayers] = useState(() =>
    isTestMode()
      ? TEST_PLAYERS.map(name => ({ id: crypto.randomUUID(), name }))
      : [
          { id: crypto.randomUUID(), name: '' },
          { id: crypto.randomUUID(), name: '' },
        ]
  );
  const [firstDealerIndex, setFirstDealerIndex] = useState(0);
  const [canadianRules, setCanadianRules] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const listRef = useRef(null);

  const [suggestions, setSuggestions] = useState([]);
  const [activeInputIndex, setActiveInputIndex] = useState(null);
  const debounceRef = useRef(null);
  // Refs are the authority for "which input owns the dropdown" and
  // "which fetch is current" — the blur timer and async searches used
  // to check stale closure state, which made moving focus from one
  // player field to the next silently kill the new field's dropdown.
  const activeIndexRef = useRef(null);
  const searchSeqRef = useRef(0);
  const blurTimerRef = useRef(null);

  const handleNameSearch = useCallback((index, value) => {
    // Taking (or keeping) focus cancels any pending close from a blur.
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    activeIndexRef.current = index;
    setActiveInputIndex(index);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const seq = ++searchSeqRef.current;
    if (!value || value.trim().length < 1) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchPlayers(value, 5);
        // A newer keystroke/focus/blur supersedes this fetch — drop it
        // instead of clobbering the fresher list (or a closed dropdown).
        if (seq !== searchSeqRef.current || activeIndexRef.current !== index) return;
        // Filter out names already used by other players
        const usedNames = new Set(players.filter((_, i) => i !== index).map(p => p.name.trim().toLowerCase()));
        const filtered = results.filter(r => !usedNames.has(r.nameLower));
        setSuggestions(filtered);
      } catch {
        /* network hiccup — leave whatever is showing */
      }
    }, 200);
  }, [players]);

  const closeSuggestions = useCallback((index) => {
    // Deferred so a tap landing on a suggestion wins; only closes if
    // this input still owns the dropdown when the timer fires (focusing
    // another field re-arms everything via handleNameSearch).
    blurTimerRef.current = setTimeout(() => {
      if (activeIndexRef.current === index) {
        activeIndexRef.current = null;
        searchSeqRef.current++;
        setSuggestions([]);
        setActiveInputIndex(null);
      }
    }, 200);
  }, []);

  const selectSuggestion = useCallback((index, name) => {
    setPlayers(prev => {
      const next = [...prev];
      next[index] = { ...next[index], name };
      return next;
    });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    searchSeqRef.current++;
    activeIndexRef.current = null;
    setSuggestions([]);
    setActiveInputIndex(null);
  }, []);

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
    if (e.target.closest && e.target.closest('input, button')) return;
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
      className="px-3.5 py-4 max-w-md mx-auto select-none"
      onMouseMove={dragIndex !== null ? handleDragMove : undefined}
      onMouseUp={dragIndex !== null ? handleDragEnd : undefined}
      onTouchMove={dragIndex !== null ? handleDragMove : undefined}
      onTouchEnd={dragIndex !== null ? handleDragEnd : undefined}
    >
      {/* Logo header */}
      <div className="text-center mb-6 pt-3">
        <div className="flex items-center justify-center gap-2.5 mb-2">
          <span className="diamond" />
          <img
            src={`${import.meta.env.BASE_URL}wizard-logo.svg`}
            alt="Wizard"
            className="h-11"
          />
          <span className="diamond" />
        </div>
        <p className="eyebrow">Score Keeper</p>
      </div>

      <section className="mb-4">
        <h2 className="font-display font-semibold text-[22px] leading-none text-cream-bright mb-1.5">Players</h2>
        <p className="text-navy-200 text-xs mb-2.5">Hold and drag to reorder. Tap D to set dealer.</p>
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
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={player.name}
                  onChange={e => {
                    updateName(i, e.target.value);
                    handleNameSearch(i, e.target.value);
                  }}
                  onFocus={() => handleNameSearch(i, player.name)}
                  onBlur={() => closeSuggestions(i)}
                  placeholder={`Player ${i + 1}`}
                  className="w-full h-11 bg-[rgba(20,26,44,.8)] border border-gold-300/25 rounded-lg px-3 text-cream placeholder-navy-300 focus:border-gold-300 focus:outline-none select-text"
                  maxLength={20}
                  autoComplete="off"
                />
                {activeInputIndex === i && suggestions.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#111a33] border border-gold-300/25 rounded-lg overflow-hidden shadow-lg">
                    {suggestions.map(s => (
                      <button
                        key={s.id}
                        // pointerdown fires the moment the finger lands —
                        // before the input's blur — and preventDefault stops
                        // the focus change, so the close-on-blur timer can't
                        // unmount the row mid-tap (onMouseDown arrived too
                        // late on iOS, or never, if the finger moved a hair).
                        onPointerDown={(e) => {
                          e.preventDefault();
                          selectSuggestion(i, s.name);
                        }}
                        onClick={() => selectSuggestion(i, s.name)}
                        className="w-full px-3 py-2 text-left text-sm text-cream hover:bg-navy-700/60 active:bg-navy-600/60 flex items-center justify-between"
                      >
                        <span className="font-display font-semibold text-[15px]">
                          {s.name}
                          {s.matchedAlias && (
                            <span className="text-navy-200 font-medium"> ({s.matchedAlias})</span>
                          )}
                        </span>
                        <span className="text-navy-300 text-xs">{s.gamesPlayed} game{s.gamesPlayed !== 1 ? 's' : ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setFirstDealerIndex(i)}
                className={`px-2 py-1 rounded-lg text-sm font-medium shrink-0 flex flex-col items-center min-w-[52px] ${
                  firstDealerIndex === i
                    ? 'text-gold-text'
                    : 'text-navy-300 border border-gold-300/20 bg-[rgba(20,26,44,.6)]'
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
        <h2 className="font-display font-semibold text-[22px] leading-none text-cream-bright">Settings</h2>

        <div className="card-gold px-3 py-2.5">
          <label className="flex items-center justify-between">
            <span className="text-cream text-sm font-medium">Canadian Rules</span>
            <div
              onClick={() => setCanadianRules(!canadianRules)}
              className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors border ${
                canadianRules ? 'border-gold-text' : 'bg-[#141c33] border-gold-300/25'
              }`}
              style={canadianRules ? { background: 'linear-gradient(180deg,#f0dda0 0%,#c9a141 45%,#9c7a26 100%)' } : undefined}
            >
              <div className={`absolute top-[2px] w-[18px] h-[18px] rounded-full transition-transform ${
                canadianRules ? 'bg-white translate-x-[23px]' : 'bg-navy-300 translate-x-[2px]'
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
        className="btn-gold w-full h-12 text-base"
      >
        Start game
      </button>

      {onShowHistory && (
        <button
          onClick={onShowHistory}
          className="btn-secondary w-full mt-2.5 h-11 text-sm"
        >
          📜 Player history
        </button>
      )}

      <a
        href="https://wizard-multiplayer.web.app/"
        className="btn-secondary flex items-center justify-center w-full mt-2.5 h-11 text-sm no-underline"
      >
        ↗ Play multiplayer
      </a>

      {/* Hidden test-mode link — barely visible, enters/exits a throwaway
          game that never saves to history and uses its own storage slot. */}
      <div className="text-center mt-6">
        {isTestMode() ? (
          <a href="./" className="text-purple-300/70 text-[11px] no-underline active:text-purple-200">
            exit test mode
          </a>
        ) : (
          <a href="?test" className="text-navy-200/25 text-[11px] no-underline active:text-navy-200/60">
            test game
          </a>
        )}
      </div>

      {/* Dev-only demo panel — localhost only, never shows in production */}
      {!isProduction() && (
        <div className="mt-6 p-3 rounded-xl border border-dashed border-pink-400/40 bg-pink-500/5">
          <p className="text-pink-300/80 text-xs font-semibold mb-2">🧪 Demo scenarios (dev only)</p>
          <p className="text-pink-300/50 text-[11px] mb-2">
            Jumps to game-over screen with mock data. Does NOT save to history.
            AI summary runs so you can preview it.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {getDemoNames().map((name) => (
              <a
                key={name}
                href={`?demo=${name}`}
                className="px-2.5 py-1 rounded-md text-xs font-medium text-pink-200 bg-pink-500/20 border border-pink-400/30 active:bg-pink-500/40"
              >
                {name}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
