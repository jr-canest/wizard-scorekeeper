import { useState, useCallback, useEffect, useRef } from 'react';
import { getBiddingOrder } from '../utils/roundCalculations';
import { playBooSound } from '../utils/sounds';
import { getBooPhrase } from '../utils/booPhrases';
import ConfirmDialog from './ConfirmDialog';
import BooToast from './BooToast';
import PhaseStatusBar from './PhaseStatusBar';
import RoundMeta from './RoundMeta';

export default function TricksPhase({ players, dealerId, cardsDealt, roundNumber, bids, tricks, shamePoints, trumpSuit, dealerName, onSelectTrump, onTrick, onShame, onConfirm, onBack }) {
  const biddingOrder = getBiddingOrder(dealerId, players);
  const [shameTarget, setShameTarget] = useState(null);
  const [booMessage, setBooMessage] = useState(null);
  const cardRefs = useRef({});
  const footerRef = useRef(null);

  // Coming from the bidding phase, start back at the top of the page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // After entering a player's tricks, glide to the next player still
  // missing one (wrapping around). When this entry completes the total
  // (auto-fill zeroes the rest) or everyone is set, glide to the footer.
  function handleTrick(playerId, n) {
    onTrick(playerId, n);
    const after = { ...tricks, [playerId]: n };
    const sum = Object.values(after).reduce((s, t) => s + t, 0);
    const idx = biddingOrder.findIndex(p => p.id === playerId);
    const order = [...biddingOrder.slice(idx + 1), ...biddingOrder.slice(0, idx)];
    const next = sum >= cardsDealt ? null : order.find(p => !(p.id in after));
    requestAnimationFrame(() => {
      const el = next ? cardRefs.current[next.id] : footerRef.current;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  const tricksAssigned = Object.values(tricks).reduce((s, t) => s + t, 0);
  const remaining = cardsDealt - tricksAssigned;

  // Auto-fill remaining players with 0 when all tricks are accounted for
  useEffect(() => {
    if (remaining === 0) {
      const unset = biddingOrder.filter(p => !(p.id in tricks));
      unset.forEach(p => onTrick(p.id, 0));
    }
  }, [remaining, biddingOrder, tricks, onTrick]);
  const allTricksEntered = biddingOrder.every(p => p.id in tricks);
  const totalValid = allTricksEntered && tricksAssigned === cardsDealt;

  // React Compiler check flags this pattern but it's correct under
  // React 18/19 — no behavior change from the manual useCallback.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleShameConfirm = useCallback(() => {
    if (shameTarget) {
      playBooSound();
      onShame(shameTarget.id);
      setBooMessage(getBooPhrase(shameTarget.name));
      setShameTarget(null);
    }
  }, [shameTarget, onShame]);

  // The player whose tricks the table is waiting on — active gold panel.
  const nextUnsetId = biddingOrder.find(p => !(p.id in tricks))?.id ?? null;

  const tone = tricksAssigned > cardsDealt ? 'over' : tricksAssigned === cardsDealt ? 'even' : 'under';
  const statusText = tone === 'even'
    ? 'All in'
    : tone === 'over'
      ? `Over by ${tricksAssigned - cardsDealt}`
      : `${remaining} left`;

  const chipCount = cardsDealt + 1;
  const useChipGrid = chipCount >= 7;

  return (
    <div className="mb-4 phase-enter">
      <PhaseStatusBar
        eyebrow="Tricks"
        roundNumber={roundNumber}
        total={tricksAssigned}
        target={cardsDealt}
        statusText={statusText}
        tone={tone}
      />
      <RoundMeta
        trumpSuit={trumpSuit}
        dealerName={dealerName}
        cardsDealt={cardsDealt}
        onSelectTrump={onSelectTrump}
      />

      <div className="space-y-2.5">
        {biddingOrder.map((player) => {
          const hasTrick = player.id in tricks;
          const bid = bids[player.id];
          const isNext = player.id === nextUnsetId;
          const selectedTrick = hasTrick ? tricks[player.id] : null;
          const shame = shamePoints?.[player.id] || 0;

          // Calculate max tricks this player can claim
          const othersAssigned = biddingOrder
            .filter(p => p.id !== player.id && p.id in tricks)
            .reduce((s, p) => s + tricks[p.id], 0);
          const maxAvailable = cardsDealt - othersAssigned;

          return (
            <div
              key={player.id}
              ref={el => { cardRefs.current[player.id] = el; }}
              className={`card-gold p-3 ${isNext ? 'card-gold-active' : ''}`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="font-display font-semibold text-[17px] leading-none tracking-[0.01em] text-cream-bright flex items-center gap-2">
                  {player.name}
                  <span className="font-sans font-medium text-xs text-navy-200 tracking-normal">(bid {bid})</span>
                  {shame > 0 && (
                    <span className="shame-chip">shame{shame > 1 ? ` ×${shame}` : ''}</span>
                  )}
                </span>
                <div className="flex items-center gap-2.5">
                  {hasTrick ? (
                    <span className={`font-display font-semibold text-[22px] leading-none tabular-nums ${
                      selectedTrick === bid ? 'text-[#6ee7b7]' : 'text-[#fda4af]'
                    }`}>
                      {selectedTrick}<span className="text-steel">/{bid}</span>
                    </span>
                  ) : isNext ? (
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-text">
                      won?
                    </span>
                  ) : null}
                  <button
                    onClick={() => setShameTarget(player)}
                    className="w-7 h-7 flex items-center justify-center rounded-md border border-gold-300/25 text-navy-300 text-xs font-semibold active:bg-navy-700/40"
                    title="Shame point"
                  >
                    !
                  </button>
                </div>
              </div>
              <div className={useChipGrid ? 'grid grid-cols-6 gap-[5px]' : 'flex gap-2'}>
                {Array.from({ length: chipCount }, (_, n) => {
                  const disabled = n > maxAvailable;
                  const isSelected = selectedTrick === n;
                  return (
                    <button
                      key={n}
                      onClick={() => handleTrick(player.id, n)}
                      disabled={disabled}
                      className={`${useChipGrid ? 'h-[38px]' : 'flex-1 h-11'} chip ${
                        disabled ? 'chip-disabled' : isSelected ? 'chip-selected bid-pop' : ''
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Always show Back, only enable Score Round when valid —
          over/under lives in the sticky top bar */}
      <div ref={footerRef} className="flex gap-2.5 mt-4">
        <button onClick={onBack} className="btn-secondary w-[100px] h-12 text-[15px]">
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={!totalValid}
          className="btn-gold flex-1 h-12 text-base"
        >
          Score round
        </button>
      </div>

      {allTricksEntered && !totalValid && (
        <p className="text-[#fda4af] text-sm text-center mt-2">
          Tricks total ({tricksAssigned}) must equal cards dealt ({cardsDealt})
        </p>
      )}

      {shameTarget && (
        <ConfirmDialog
          title="Shame! 💀"
          message={`Give ${shameTarget.name} a shame point? This plays a loud sound!`}
          confirmLabel="BOOO!"
          onConfirm={handleShameConfirm}
          onCancel={() => setShameTarget(null)}
        />
      )}

      <BooToast message={booMessage} onDone={() => setBooMessage(null)} />
    </div>
  );
}
