import { SUITS } from '../utils/constants';
import LastRoundToggle from './LastRoundToggle';
import PlayerOrderList from './PlayerOrderList';

// Pre-round screen. Since the merged round-results screen carries the
// next-round setup, this is only reached for round 1 and when backing
// out of bidding.
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
    <div className="mb-4 select-none phase-enter">
      {/* Title block: eyebrow + serif round + ornament + metadata */}
      <div className="text-center pt-3 mb-4">
        <div className="eyebrow mb-[7px]">Next round</div>
        <div className="font-display font-semibold text-[34px] leading-none tracking-[0.01em] text-cream-bright mb-3.5">
          Round {roundNumber}
        </div>
        <div className="ornament">
          <span className="diamond" />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-3.5 text-xs font-medium text-navy-200">
          <span>
            Dealer <span className="text-cream">{dealer.name}</span>
          </span>
          <span className="text-steel">·</span>
          <span>
            {cardsDealt} card{cardsDealt !== 1 ? 's' : ''}
            {isExtraRound && <span className="text-gold-text ml-1">(max)</span>}
          </span>
          <span className="text-steel">·</span>
          <span className="text-navy-300">
            {roundsLeft > 0
              ? `${roundsLeft} round${roundsLeft !== 1 ? 's' : ''} left`
              : 'final ascending round'}
          </span>
        </div>
      </div>

      {/* Player list in seating order — draggable */}
      <div className="card-gold overflow-hidden mb-4">
        <div className="px-3 h-9 flex items-center justify-between border-b border-gold-300/20">
          <span className="section-label">Players</span>
          <span className="text-navy-300 text-[10px]">Hold to reorder</span>
        </div>
        <PlayerOrderList
          players={players}
          allPlayers={allPlayers}
          dealerId={dealer.id}
          totalScores={totalScores}
          onReorderPlayers={onReorderPlayers}
        />
      </div>

      {/* Action buttons */}
      <div className="space-y-2.5">
        {/* Main action: Start Round */}
        <button onClick={onStartRound} className="btn-gold w-full h-12 text-base">
          Start round
        </button>

        {/* Trump + Last Round toggle in same row */}
        <div className="flex gap-2 items-stretch">
          <button
            onClick={onSelectTrump}
            className="btn-secondary flex-1 h-11 text-sm"
          >
            {hasTrump && suitInfo ? (
              <span style={{ color: suitInfo.color }}>{trumpLabel}</span>
            ) : (
              <span>{trumpLabel}</span>
            )}
          </button>
          <div className="flex items-center gap-2 px-3 card-gold-subtle">
            <span className="text-navy-200 text-sm whitespace-nowrap">Last Round</span>
            <LastRoundToggle
              isLastRound={isLastRound}
              onDeclare={onDeclareLastRound}
              onUndeclare={onUndeclareLastRound}
            />
          </div>
        </div>

        {/* Change Dealer + Add Player — secondary row, visible but quieter
            than the trump/last-round row above */}
        <div className="flex gap-2">
          <button onClick={onChangeDealer} className="btn-secondary flex-1 h-10 text-sm">
            ♛ Change dealer
          </button>
          <button onClick={onAddPlayer} className="btn-secondary flex-1 h-10 text-sm">
            + Add player
          </button>
        </div>

        {/* End Game — clearly a button, but calmer than the primary */}
        <button onClick={onEndGame} className="btn-danger w-full h-10 text-sm">
          End game
        </button>
      </div>
    </div>
  );
}
