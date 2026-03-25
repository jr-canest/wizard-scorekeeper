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
  onUndeclareLastRound,
  onAddPlayer,
  onEndGame,
  onChangeDealer,
}) {
  const dealer = players.find(p => p.id === dealerId) || players[0];
  const hasTrump = trumpSuit !== null;
  const suitInfo = trumpSuit && trumpSuit !== 'none' ? SUITS[trumpSuit] : null;

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

  // Rounds left calculation (ascending rounds remaining after this one)
  const roundsLeft = Math.max(0, maxRounds - roundNumber);

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
          {dealer.name} deals {cardsDealt} card{cardsDealt !== 1 ? 's' : ''} each
          {isExtraRound && <span className="text-gold-200 ml-1">(max cards)</span>}
        </p>
        <p className="text-navy-200/50 text-xs mt-0.5">
          {roundsLeft > 0
            ? `${roundsLeft} round${roundsLeft !== 1 ? 's' : ''} left`
            : 'Final ascending round'
          }
        </p>
      </div>

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

        {/* Trump + Last Round toggle in same row */}
        <div className="flex gap-2 items-center">
          <button
            onClick={onSelectTrump}
            className="card-gold flex-1 py-2.5 font-medium active:bg-navy-600/60 text-sm"
          >
            {hasTrump && suitInfo ? (
              <span style={{ color: suitInfo.color }}>{trumpLabel}</span>
            ) : (
              <span className="text-navy-200">{trumpLabel}</span>
            )}
          </button>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gold-700/40 bg-navy-800/40">
            <span className="text-navy-200 text-sm whitespace-nowrap">Last Round</span>
            <button
              onClick={() => isLastRound ? onUndeclareLastRound() : onDeclareLastRound()}
              className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors shrink-0 ${
                isLastRound ? 'bg-gold-300' : 'bg-navy-600'
              }`}
            >
              <span
                className="inline-block w-4 h-4 rounded-full bg-white shadow transition-transform"
                style={{ transform: isLastRound ? 'translateX(22px)' : 'translateX(3px)' }}
              />
            </button>
          </div>
        </div>

        {/* Change Dealer + Add Player — muted bottom row */}
        <div className="flex gap-2">
          <button
            onClick={onChangeDealer}
            className="flex-1 py-2 rounded-lg text-xs text-navy-200/50 bg-navy-700/20 active:bg-navy-600/40"
          >
            Change Dealer
          </button>
          <button
            onClick={onAddPlayer}
            className="flex-1 py-2 rounded-lg text-xs text-navy-200/50 bg-navy-700/20 active:bg-navy-600/40"
          >
            + Add Player
          </button>
        </div>

        {/* End Game — very subtle */}
        <button
          onClick={onEndGame}
          className="w-full py-1 text-navy-200/30 text-[10px] active:text-navy-200/60"
        >
          End Game
        </button>
      </div>
    </div>
  );
}
