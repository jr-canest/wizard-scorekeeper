import { useState, useCallback, useEffect } from 'react';
import { getBiddingOrder } from '../utils/roundCalculations';
import { playBooSound } from '../utils/sounds';
import ConfirmDialog from './ConfirmDialog';

export default function TricksPhase({ players, dealerId, cardsDealt, bids, tricks, onTrick, onShame, onConfirm, onBack }) {
  const biddingOrder = getBiddingOrder(dealerId, players);
  const [shameTarget, setShameTarget] = useState(null);

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

  const handleShameConfirm = useCallback(() => {
    if (shameTarget) {
      playBooSound();
      onShame(shameTarget.id);
      setShameTarget(null);
    }
  }, [shameTarget, onShame]);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold">Tricks Won</h3>
        <span className="text-navy-200 text-sm">
          Remaining: {remaining}
        </span>
      </div>

      <div className="space-y-3">
        {biddingOrder.map((player) => {
          const hasTrick = player.id in tricks;
          const bid = bids[player.id];
          const selectedTrick = hasTrick ? tricks[player.id] : null;

          // Calculate max tricks this player can claim
          const othersAssigned = biddingOrder
            .filter(p => p.id !== player.id && p.id in tricks)
            .reduce((s, p) => s + tricks[p.id], 0);
          const maxAvailable = cardsDealt - othersAssigned;

          return (
            <div key={player.id} className="card-gold p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium">
                  {player.name}
                  <span className="text-navy-200 text-xs ml-1.5">(bid {bid})</span>
                </span>
                <div className="flex items-center gap-2">
                  {hasTrick && (
                    <span className={`text-sm font-medium ${
                      selectedTrick === bid ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {selectedTrick}/{bid}
                    </span>
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
                  const disabled = n > maxAvailable;
                  const isSelected = selectedTrick === n;
                  return (
                    <button
                      key={n}
                      onClick={() => onTrick(player.id, n)}
                      disabled={disabled}
                      className={`min-w-[44px] h-11 rounded-lg font-semibold text-sm ${
                        disabled
                          ? 'bg-navy-700/60 text-navy-400'
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

      {/* Always show Back, only enable Score Round when valid */}
      <div className="flex gap-3 mt-4">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl bg-navy-600 text-gray-300 font-medium active:bg-navy-500"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={!totalValid}
          className={`btn-gold flex-1 py-3 rounded-xl`}
        >
          Score Round
        </button>
      </div>

      {allTricksEntered && !totalValid && (
        <p className="text-red-400 text-sm text-center mt-2">
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
    </div>
  );
}
