import { SUITS } from '../utils/constants';
import LastRoundToggle from './LastRoundToggle';

// Round results + next-round setup on ONE screen (merged the old
// "Scored" and "Pre-round" screens, 2026-09-02). Top to bottom:
//   1. title block for the round just scored
//   2. results panel (bid / won / total + delta), sorted by total
//   3. "Next up" panel: next round number, cards, dealer, Start round,
//      trump / last-round toggle, seating + add player
//   4. Edit round · End game
//   5. every-round running-total table
// When the scored round was declared the last one, the Next-up panel is
// replaced by an End-game panel.
export default function RoundScoreboard({
  players,
  round,
  allRounds,
  totalScores,
  shamePoints,
  isLastRound,
  dealerName,
  next,
  onStartNextRound,
  onSelectTrump,
  onDeclareNextLastRound,
  onUndeclareNextLastRound,
  onChangeDealer,
  onSeating,
  onAddPlayer,
  onEndGame,
  onEditRound,
}) {
  // Sort by total score descending for results
  const activePlayers = players
    .filter(p => p.id in round.scores)
    .sort((a, b) => (totalScores[b.id] || 0) - (totalScores[a.id] || 0));

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

  // True minus sign (U+2212) for negatives, per the 1b kit
  function formatNum(n) {
    return n < 0 ? `−${Math.abs(n)}` : `${n}`;
  }

  function formatDelta(score) {
    return score > 0 ? `+${score}` : formatNum(score);
  }

  function getRoundWinnerIds(r) {
    const scores = Object.entries(r.scores || {});
    if (scores.length === 0) return [];
    const maxScore = Math.max(...scores.map(([, s]) => s));
    return scores.filter(([, s]) => s === maxScore).map(([id]) => id);
  }

  // Next-round trump button label (mirrors the pre-round screen)
  const nextSuit = next?.trumpSuit && next.trumpSuit !== 'none' ? SUITS[next.trumpSuit] : null;
  const nextHasTrump = next?.trumpSuit !== null && next?.trumpSuit !== undefined;
  const trumpLabel = !nextHasTrump
    ? 'Select Trump'
    : nextSuit
      ? `Trump: ${nextSuit.symbol} ${nextSuit.name}`
      : 'Trump: No Trump';

  return (
    <div className="mb-4 phase-enter">
      {/* Centred title block */}
      <div className="text-center pt-3 mb-4">
        <div className="eyebrow mb-[7px]">Round results</div>
        <div className="font-display font-semibold text-[34px] leading-none tracking-[0.01em] text-cream-bright mb-3.5">
          Round {round.roundNumber}
        </div>
        <div className="ornament">
          <span className="diamond" />
        </div>
        <div className="flex items-center justify-center gap-x-3 mt-3.5 text-xs font-medium text-navy-200">
          <span>
            Dealer <span className="text-cream">{dealerName}</span>
          </span>
          <span className="text-steel">·</span>
          <span>{round.cardsDealt} card{round.cardsDealt !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Current round detail — grid panel */}
      <div className="card-gold overflow-hidden mb-4">
        <div className="grid grid-cols-[1fr_38px_38px_80px] items-center px-3 h-8 border-b border-gold-300/20">
          <span className="section-label">Player</span>
          <span className="section-label text-center">Bid</span>
          <span className="section-label text-center">Won</span>
          <span className="section-label text-right">Total</span>
        </div>
        {activePlayers.map((player) => {
          const score = round.scores[player.id] || 0;
          const bid = round.bids[player.id];
          const tricks = round.tricks[player.id];
          const total = totalScores[player.id] || 0;
          const shame = shamePoints?.[player.id] || 0;
          const hit = tricks === bid;

          return (
            <div
              key={player.id}
              className="grid grid-cols-[1fr_38px_38px_80px] items-center px-3 py-[11px] border-b border-gold-300/10 last:border-0"
            >
              <span className="font-display font-semibold text-[17px] leading-none text-cream-bright flex items-center gap-2 min-w-0">
                <span className="truncate">{player.name}</span>
                {shame > 0 && (
                  <span className="shame-chip shrink-0">shame{shame > 1 ? ` ×${shame}` : ''}</span>
                )}
              </span>
              <span className="font-semibold text-sm text-cream text-center tabular-nums">{bid}</span>
              <span className={`font-semibold text-sm text-center tabular-nums ${
                hit ? 'text-[#6ee7b7]' : 'text-[#fda4af]'
              }`}>
                {tricks}
              </span>
              <span className="text-right">
                <span className="block font-bold text-[18px] leading-none tabular-nums text-gold-text">
                  {formatNum(total)}
                </span>
                <span className={`block mt-1 text-[10px] font-semibold leading-none ${
                  score > 0 ? 'text-[#6ee7b7]' : score < 0 ? 'text-[#fda4af]' : 'text-navy-200'
                }`}>
                  {formatDelta(score)}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {isLastRound ? (
        /* The round just scored was declared the last one. */
        <div className="card-gold p-3.5 mb-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="section-label">Last round played</span>
            <span className="text-[11px] text-navy-300">{completedRounds.length} rounds</span>
          </div>
          <button onClick={onEndGame} className="btn-gold w-full h-12 text-base">
            End game · final scores
          </button>
          <button onClick={onEditRound} className="btn-secondary w-full h-10 text-sm">
            Edit round {round.roundNumber}
          </button>
        </div>
      ) : (
        /* Next-round setup — what the pre-round screen used to hold. */
        <div className="card-gold p-3.5 mb-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="section-label">Next up</span>
            <span className="text-[11px] text-navy-300">
              {next.roundsLeft > 0
                ? `${next.roundsLeft} round${next.roundsLeft !== 1 ? 's' : ''} left`
                : 'final ascending round'}
            </span>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="font-display font-semibold text-[26px] leading-none tracking-[0.01em] text-cream-bright">
                Round {next.roundNumber}
              </div>
              <div className="mt-1.5 text-xs font-medium text-navy-200">
                {next.cardsDealt} card{next.cardsDealt !== 1 ? 's' : ''}
                {next.isExtraRound && <span className="text-gold-text ml-1">(max)</span>}
              </div>
            </div>
            {/* Tappable dealer badge → dealer picker */}
            <button
              onClick={onChangeDealer}
              className="shrink-0 text-right border border-gold-300/30 px-2.5 py-1.5 active:bg-gold-300/10"
            >
              <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-gold-text leading-none">
                <span className="text-gold-300 text-[11px]">♛</span> Dealer
              </span>
              <span className="block font-display font-semibold text-[17px] leading-none text-cream-bright mt-1.5 max-w-[150px] truncate">
                {next.dealerName}
              </span>
            </button>
          </div>

          <button onClick={onStartNextRound} className="btn-gold w-full h-12 text-base">
            Start round {next.roundNumber}
          </button>

          {/* Trump + Last Round toggle in same row */}
          <div className="flex gap-2 items-stretch">
            <button onClick={onSelectTrump} className="btn-secondary flex-1 h-11 text-sm">
              {nextHasTrump && nextSuit ? (
                <span style={{ color: nextSuit.color }}>{trumpLabel}</span>
              ) : (
                <span>{trumpLabel}</span>
              )}
            </button>
            <div className="flex items-center gap-2 px-3 card-gold-subtle">
              <span className="text-navy-200 text-sm whitespace-nowrap">Last Round</span>
              <LastRoundToggle
                isLastRound={next.isLastRound}
                onDeclare={onDeclareNextLastRound}
                onUndeclare={onUndeclareNextLastRound}
              />
            </div>
          </div>

          {/* Seating + Add player — rare actions, quieter row */}
          <div className="flex gap-2">
            <button onClick={onSeating} className="btn-secondary flex-1 h-10 text-sm">
              ⠿ Seating
            </button>
            <button onClick={onAddPlayer} className="btn-secondary flex-1 h-10 text-sm">
              + Add player
            </button>
          </div>
        </div>
      )}

      {/* Round + game level actions */}
      {!isLastRound && (
        <div className="flex gap-2.5 mb-4">
          <button onClick={onEditRound} className="btn-secondary flex-1 h-10 text-sm">
            Edit round {round.roundNumber}
          </button>
          <button onClick={onEndGame} className="btn-danger flex-1 h-10 text-sm">
            End game
          </button>
        </div>
      )}

      {/* All rounds history table */}
      {completedRounds.length > 1 && (
        <div>
          <h4 className="section-label mb-2">Every round</h4>
          <div className="card-gold overflow-x-auto">
            <table className="w-full text-xs min-w-max">
              <thead>
                <tr className="border-b border-gold-300/20">
                  <th className="text-left text-navy-300 py-2 px-2 font-semibold sticky left-0 bg-[#131b32] z-10 text-[10px] uppercase tracking-[0.14em]">Rd</th>
                  {activePlayers.map(p => (
                    <th key={p.id} className="text-center py-2 px-2 font-display font-semibold text-[13px] text-cream min-w-[70px]">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {completedRounds.map((r, ri) => {
                  const winnerIds = getRoundWinnerIds(r);
                  return (
                  <tr key={r.roundNumber} className={`border-b border-gold-300/10 ${
                    r.roundNumber === round.roundNumber ? 'bg-gold-300/5' : ''
                  }`}>
                    <td className="py-1.5 px-2 text-navy-300 sticky left-0 bg-[#131b32] z-10 font-semibold text-[12px] tabular-nums">{r.roundNumber}</td>
                    {activePlayers.map(player => {
                      const score = r.scores[player.id];
                      if (score === undefined) {
                        return <td key={player.id} className="py-1.5 px-2 text-center text-steel">—</td>;
                      }
                      const runningTotal = getRunningTotal(player.id, ri);
                      const isWinner = winnerIds.includes(player.id);
                      return (
                        <td key={player.id} className={`py-1.5 px-2 text-center ${isWinner ? 'bg-gold-300/[.07]' : ''}`}>
                          <span className={`font-semibold text-[13px] tabular-nums ${isWinner ? 'text-gold-text' : 'text-cream'}`}>
                            {runningTotal < 0 ? `−${Math.abs(runningTotal)}` : runningTotal}
                          </span>
                          <span className={`ml-0.5 text-[10px] font-semibold ${
                            score > 0 ? 'text-[#6ee7b7]' : 'text-[#fda4af]'
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
    </div>
  );
}
