import { useState, useCallback, useEffect, useRef } from 'react';
import { getBiddingOrder, getRestrictedBid } from '../utils/roundCalculations';
import ConfirmDialog from './ConfirmDialog';
import BooToast from './BooToast';
import PhaseStatusBar from './PhaseStatusBar';
import RoundMeta from './RoundMeta';
import LastRoundToggle from './LastRoundToggle';
import { playBooSound } from '../utils/sounds';
import { getBooPhrase } from '../utils/booPhrases';

export default function BiddingPhase({ players, dealerId, cardsDealt, canadianRules, roundNumber, bids, shamePoints, trumpSuit, dealerName, onSelectTrump, isLastRound, onDeclareLastRound, onUndeclareLastRound, onBid, onShame, onConfirm, onBack }) {
  const biddingOrder = getBiddingOrder(dealerId, players);
  const [shameTarget, setShameTarget] = useState(null);
  const [booMessage, setBooMessage] = useState(null);
  const cardRefs = useRef({});
  const footerRef = useRef(null);

  // Entering the phase always starts at the top of the page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // After a bid is entered, glide to the next player still missing one
  // (wrapping around); when everyone has bid, glide to the footer.
  function handleBid(playerId, n) {
    onBid(playerId, n);
    const after = { ...bids, [playerId]: n };
    const idx = biddingOrder.findIndex(p => p.id === playerId);
    const order = [...biddingOrder.slice(idx + 1), ...biddingOrder.slice(0, idx)];
    const next = order.find(p => !(p.id in after));
    requestAnimationFrame(() => {
      const el = next ? cardRefs.current[next.id] : footerRef.current;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  const allBidsEntered = biddingOrder.every(p => p.id in bids);
  const totalBids = Object.values(bids).reduce((s, b) => s + b, 0);
  const bidsEntered = Object.keys(bids).length;

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

  // The player whose bid the table is waiting on (first in order
  // without one) — their panel gets the active gold treatment.
  const nextUnsetId = biddingOrder.find(p => !(p.id in bids))?.id ?? null;

  const tone = totalBids > cardsDealt ? 'over' : totalBids === cardsDealt ? 'even' : 'under';
  const statusText = bidsEntered === 0
    ? null
    : tone === 'even'
      ? 'Exact'
      : tone === 'over'
        ? `Over ${totalBids - cardsDealt}`
        : `Under ${cardsDealt - totalBids}`;

  // ≤6 values: one row of flex chips. 7+ values: 6-column grid so
  // 0–10 wraps into even rows (density frame 2c).
  const chipCount = cardsDealt + 1;
  const useChipGrid = chipCount >= 7;

  return (
    <div className="mb-4 phase-enter">
      <PhaseStatusBar
        eyebrow="Bidding"
        roundNumber={roundNumber}
        total={totalBids}
        target={cardsDealt}
        statusText={statusText}
        tone={bidsEntered > 0 ? tone : null}
      />
      <RoundMeta
        trumpSuit={trumpSuit}
        dealerName={dealerName}
        cardsDealt={cardsDealt}
        onSelectTrump={onSelectTrump}
      />

      <div className="space-y-2.5">
        {biddingOrder.map((player, idx) => {
          const hasBid = player.id in bids;
          const isDealer = idx === biddingOrder.length - 1;
          const isNext = player.id === nextUnsetId;
          const selectedBid = hasBid ? bids[player.id] : null;
          const shame = shamePoints?.[player.id] || 0;

          const previousBids = biddingOrder
            .slice(0, idx)
            .filter(p => p.id in bids)
            .map(p => bids[p.id]);
          const restrictedBid = isDealer
            ? getRestrictedBid(cardsDealt, previousBids, canadianRules, true, roundNumber)
            : null;

          return (
            <div
              key={player.id}
              ref={el => { cardRefs.current[player.id] = el; }}
              className={`card-gold p-3 ${isNext ? 'card-gold-active' : ''}`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="font-display font-semibold text-[17px] leading-none tracking-[0.01em] text-cream-bright flex items-center gap-2">
                  {player.name}
                  {isDealer && <span className="text-gold-300 text-[13px]">♛</span>}
                  {shame > 0 && (
                    <span className="shame-chip">shame{shame > 1 ? ` ×${shame}` : ''}</span>
                  )}
                </span>
                <div className="flex items-center gap-2.5">
                  {hasBid ? (
                    <span className="font-bold text-[18px] leading-none tabular-nums text-gold-text">
                      {selectedBid}
                    </span>
                  ) : isNext ? (
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-text">
                      to bid
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
                  const isRestricted = restrictedBid === n;
                  const isSelected = selectedBid === n;
                  return (
                    <button
                      key={n}
                      onClick={() => handleBid(player.id, n)}
                      disabled={isRestricted}
                      className={`${useChipGrid ? 'h-[38px]' : 'flex-1 h-11'} chip ${
                        isRestricted ? 'chip-locked' : isSelected ? 'chip-selected bid-pop' : ''
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

      {/* Buttons always visible — over/under lives in the sticky top bar */}
      <div ref={footerRef} className="mt-4">
        <div className="flex gap-2.5">
          <button onClick={onBack} className="btn-secondary w-[100px] h-12 text-[15px]">
            Back
          </button>
          <button
            onClick={onConfirm}
            disabled={!allBidsEntered}
            className="btn-gold flex-1 h-12 text-base"
          >
            Confirm bids
          </button>
        </div>

        {/* Declare Last Round without leaving the bidding screen */}
        <div className="card-gold-subtle flex items-center justify-center gap-2.5 mt-2.5 h-10">
          <span className="text-navy-200 text-sm">Last Round</span>
          <LastRoundToggle
            isLastRound={isLastRound}
            onDeclare={onDeclareLastRound}
            onUndeclare={onUndeclareLastRound}
          />
        </div>
      </div>

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
