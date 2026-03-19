import { useState, useRef } from 'react';
import { SUITS } from '../utils/constants';

export default function PreRoundScreen({
  roundNumber,
  cardsDealt,
  maxRounds,
  isExtraRound,
  players,
  allPlayers,
  dealerId,
  totalScores,
  trumpSuit,
  isLastRound,
  lastRoundTrumpChoice,
  onStartRound,
  onSelectTrump,
  onReorderPlayers,
  onDeclareLastRound,
  onAddPlayer,
  onEndGame,
}) {
  const dealer = players.find(p => p.id === dealerId) || players[0];
  const hasTrump = trumpSuit !== null;
  const suitInfo = trumpSuit && trumpSuit !== 'none' ? SUITS[trumpSuit] : null;
  const forceNoTrump = isLastRound && lastRoundTrumpChoice === 'without';

  const [dragIndex, setDragIndex] = useState(null);
  const listRef = useRef(null);
  const dragState = useRef({ startY: 0 });

  function handleDragStart(e, index) {
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
        // Map active player indices to full players array indices
        const fromFull = allPlayers.indexOf(players[dragIndex]);
        const toFull = allPlayers.indexOf(players[i]);
        if (fromFull >= 0 && toFull >= 0) {
          onReorderPlayers(fromFull, toFull);
        }
        setDragIndex(i);
        break;
      }
    }
  }

  function handleDragEnd() {
    setDragIndex(null);
  }

  // Build trump button label
  let trumpLabel = 'Select Trump';
  if (hasTrump) {
    if (suitInfo) {
      trumpLabel = `Trump: ${suitInfo.symbol} ${suitInfo.name}`;
    } else {
      trumpLabel = 'Trump: No Trump';
    }
  }

  return (
    <div
      className="mb-4 select-none"
      onMouseMove={dragIndex !== null ? handleDragMove : undefined}
      onMouseUp={dragIndex !== null ? handleDragEnd : undefined}
      onTouchMove={dragIndex !== null ? handleDragMove : undefined}
      onTouchEnd={dragIndex !== null ? handleDragEnd : undefined}
    >
      {/* Round info */}
      <div className="card-gold p-4 mb-4 text-center">
        <h2 className="text-xl font-bold text-white">
          Round {roundNumber}
        </h2>
        <p className="text-navy-200 text-sm mt-1">
          {cardsDealt} card{cardsDealt !== 1 ? 's' : ''} each
          {isExtraRound && <span className="text-gold-200 ml-1">(max cards)</span>}
        </p>
      </div>

      {isLastRound && (
        <div className="border border-gold-300/30 bg-gold-300/10 rounded-lg px-3 py-2 mb-4 text-center">
          <span className="text-gold-200 text-sm font-medium">
            Last Round {forceNoTrump ? '(No Trump)' : ''}
          </span>
        </div>
      )}

      {/* Player list in seating order — draggable */}
      <div className="card-gold overflow-hidden mb-4">
        <div className="px-3 py-2 border-b border-gold-700/40 flex items-center justify-between">
          <span className="text-gold-200/70 text-sm font-medium">Players</span>
          <span className="text-navy-200/40 text-xs">Hold to reorder</span>
        </div>
        <div ref={listRef}>
          {players.map((player, i) => {
            const total = totalScores[player.id] || 0;
            const isDealer = player.id === dealer.id;
            return (
              <div
                key={player.id}
                className={`flex items-center px-1.5 py-2.5 border-b border-gold-700/20 last:border-0 transition-all ${
                  isDealer ? 'bg-gold-300/5' : ''
                } ${dragIndex === i ? 'bg-navy-600/50 scale-[1.01]' : ''}`}
                onMouseDown={e => handleDragStart(e, i)}
                onTouchStart={e => handleDragStart(e, i)}
              >
                <div className="text-gold-200/30 cursor-grab active:cursor-grabbing px-1 text-sm touch-none">
                  ⠿
                </div>
                <div className="flex items-center justify-between flex-1 px-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{player.name}</span>
                    {isDealer && (
                      <span className="text-gold-200 text-xs bg-gold-300/15 px-1.5 py-0.5 rounded">♛ Dealer</span>
                    )}
                  </div>
                  <span className={`font-semibold ${
                    total > 0 ? 'text-green-400' : total < 0 ? 'text-red-400' : 'text-navy-200'
                  }`}>
                    {total}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        {/* Main action: Start Round */}
        <button
          onClick={onStartRound}
          className="btn-gold w-full py-3.5 rounded-xl text-lg"
        >
          Start Round
        </button>

        {/* Trump button — shows current selection, always tappable to edit */}
        {!forceNoTrump && (
          <button
            onClick={onSelectTrump}
            className="card-gold w-full py-3 font-medium active:bg-navy-600/60"
          >
            {hasTrump && suitInfo ? (
              <span style={{ color: suitInfo.color }}>{trumpLabel}</span>
            ) : hasTrump ? (
              <span className="text-navy-200">{trumpLabel}</span>
            ) : (
              <span className="text-navy-200">{trumpLabel}</span>
            )}
          </button>
        )}

        {/* Secondary actions */}
        <div className="flex gap-2">
          {!isLastRound && (
            <button
              onClick={onDeclareLastRound}
              className="flex-1 py-2.5 rounded-lg text-sm text-gold-200 border border-gold-700/40 bg-navy-800/40 active:bg-navy-700/60"
            >
              Declare Last Round
            </button>
          )}
          <button
            onClick={onAddPlayer}
            className="flex-1 py-2.5 rounded-lg text-sm text-navy-200 bg-navy-700/40 active:bg-navy-600/60"
          >
            + Add Player
          </button>
        </div>

        {/* End Game — subtle link */}
        <button
          onClick={onEndGame}
          className="w-full py-1.5 text-navy-200/50 text-xs active:text-gray-300"
        >
          End Game
        </button>
      </div>
    </div>
  );
}
