import { getBiddingOrder } from '../utils/roundCalculations';

export default function TricksPhase({ players, dealerIndex, cardsDealt, bids, tricks, onTrick, onConfirm, onBack }) {
  const biddingOrder = getBiddingOrder(dealerIndex, players);

  const tricksAssigned = Object.values(tricks).reduce((s, t) => s + t, 0);
  const remaining = cardsDealt - tricksAssigned;
  const allTricksEntered = biddingOrder.every(p => p.id in tricks);
  const totalValid = allTricksEntered && tricksAssigned === cardsDealt;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold">Tricks Won</h3>
        <span className="text-gray-400 text-sm">
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
            <div key={player.id} className="bg-gray-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium">
                  {player.name}
                  <span className="text-gray-500 text-xs ml-1.5">(bid {bid})</span>
                </span>
                {hasTrick && (
                  <span className="text-blue-400 text-sm">
                    Won: {selectedTrick}/{bid}
                  </span>
                )}
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
                          ? 'bg-gray-700 text-gray-600'
                          : isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-white active:bg-blue-600'
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
          className="flex-1 py-3 rounded-xl bg-gray-700 text-gray-300 font-medium active:bg-gray-600"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={!totalValid}
          className={`flex-1 py-3 rounded-xl font-semibold ${
            totalValid
              ? 'bg-blue-600 text-white active:bg-blue-500'
              : 'bg-gray-700 text-gray-500'
          }`}
        >
          Score Round
        </button>
      </div>

      {allTricksEntered && !totalValid && (
        <p className="text-red-400 text-sm text-center mt-2">
          Tricks total ({tricksAssigned}) must equal cards dealt ({cardsDealt})
        </p>
      )}
    </div>
  );
}
