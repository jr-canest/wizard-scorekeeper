import { useState, useCallback } from 'react';
import { getBiddingOrder, getRestrictedBid } from '../utils/roundCalculations';
import ConfirmDialog from './ConfirmDialog';
import BooToast from './BooToast';
import { playBooSound } from '../utils/sounds';
import { getBooPhrase } from '../utils/booPhrases';

export default function BiddingPhase({ players, dealerId, cardsDealt, canadianRules, roundNumber, bids, shamePoints, onBid, onShame, onConfirm, onBack }) {
  const biddingOrder = getBiddingOrder(dealerId, players);
  const [shameTarget, setShameTarget] = useState(null);
  const [booMessage, setBooMessage] = useState(null);

  const allBidsEntered = biddingOrder.every(p => p.id in bids);
  const totalBids = Object.values(bids).reduce((s, b) => s + b, 0);
  const bidsEntered = Object.keys(bids).length;

  const handleShameConfirm = useCallback(() => {
    if (shameTarget) {
      playBooSound();
      onShame(shameTarget.id);
      setBooMessage(getBooPhrase(shameTarget.name));
      setShameTarget(null);
    }
  }, [shameTarget, onShame]);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold">Bidding</h3>
        <span className={`text-sm font-medium ${
          totalBids > cardsDealt ? 'text-red-400' : totalBids === cardsDealt ? 'text-yellow-400' : 'text-blue-400'
        }`}>
          Total: {totalBids} / {cardsDealt}
        </span>
      </div>

      <div className="space-y-3">
        {biddingOrder.map((player, idx) => {
          const hasBid = player.id in bids;
          const isDealer = idx === biddingOrder.length - 1;
          const selectedBid = hasBid ? bids[player.id] : null;

          const previousBids = biddingOrder
            .slice(0, idx)
            .filter(p => p.id in bids)
            .map(p => bids[p.id]);
          const restrictedBid = isDealer
            ? getRestrictedBid(cardsDealt, previousBids, canadianRules, true, roundNumber)
            : null;

          return (
            <div key={player.id} className="card-gold p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium">
                  {player.name}
                  {isDealer && <span className="text-gold-200 text-xs ml-1.5">(Dealer)</span>}
                  {(shamePoints?.[player.id] || 0) > 0 && (
                    <span className="text-red-400 text-xs ml-1.5">
                      💀{shamePoints[player.id] > 1 ? `×${shamePoints[player.id]}` : ''}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {hasBid && (
                    <span className="text-gold-200 text-sm">Bid: {selectedBid}</span>
                  )}
                  <button
                    onClick={() => setShameTarget(player)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-900/40 border border-red-700/40 text-red-400 active:bg-red-800/60 text-sm"
                    title="Shame point"
                  >
                    ⚠️
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: cardsDealt + 1 }, (_, n) => {
                  const isRestricted = restrictedBid === n;
                  const isSelected = selectedBid === n;
                  return (
                    <button
                      key={n}
                      onClick={() => onBid(player.id, n)}
                      disabled={isRestricted}
                      className={`min-w-[44px] h-11 rounded-lg font-semibold text-sm ${
                        isRestricted
                          ? 'bg-navy-700/60 text-navy-400 line-through'
                          : isSelected
                            ? 'btn-gold'
                            : 'bg-navy-600/60 text-white border border-navy-400/20 active:bg-gold-300/20'
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

      {/* Bid summary - always visible when any bids entered */}
      {bidsEntered > 0 && (
        <div className={`text-center py-2 rounded-lg mt-4 mb-3 text-sm font-medium ${
          totalBids === cardsDealt
            ? 'bg-gold-300/15 text-gold-200 border border-gold-300/20'
            : totalBids > cardsDealt
              ? 'bg-red-900/40 text-red-300 border border-red-700/30'
              : 'bg-blue-900/40 text-blue-300 border border-blue-700/30'
        }`}>
          {totalBids === cardsDealt
            ? `Even — all bids could be met`
            : totalBids > cardsDealt
              ? `Overbid by ${totalBids - cardsDealt}`
              : `Underbid by ${cardsDealt - totalBids}`
          }
        </div>
      )}

      {/* Buttons always visible */}
      <div className="flex gap-3 mt-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl bg-navy-600 text-gray-300 font-medium active:bg-navy-500"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={!allBidsEntered}
          className={`btn-gold flex-1 py-3 rounded-xl`}
        >
          Confirm Bids
        </button>
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
