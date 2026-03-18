import { getBiddingOrder, getRestrictedBid } from '../utils/roundCalculations';

export default function BiddingPhase({ players, dealerIndex, cardsDealt, canadianRules, roundNumber, bids, onBid, onConfirm, onBack }) {
  const biddingOrder = getBiddingOrder(dealerIndex, players);

  const allBidsEntered = biddingOrder.every(p => p.id in bids);
  const totalBids = Object.values(bids).reduce((s, b) => s + b, 0);
  const bidsEntered = Object.keys(bids).length;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold">Bidding</h3>
        <span className="text-gray-400 text-sm">
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
            <div key={player.id} className="bg-gray-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium">
                  {player.name}
                  {isDealer && <span className="text-amber-400 text-xs ml-1.5">(Dealer)</span>}
                </span>
                {hasBid && (
                  <span className="text-blue-400 text-sm">Bid: {selectedBid}</span>
                )}
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
                          ? 'bg-gray-700 text-gray-600 line-through'
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

      {/* Always show bid summary when at least one bid is entered */}
      {bidsEntered > 0 && (
        <div className="mt-4">
          <div className={`text-center py-2 rounded-lg mb-3 text-sm font-medium ${
            totalBids === cardsDealt
              ? 'bg-amber-900/50 text-amber-300'
              : totalBids > cardsDealt
                ? 'bg-red-900/50 text-red-300'
                : 'bg-blue-900/50 text-blue-300'
          }`}>
            {totalBids === cardsDealt
              ? `Even — all bids could be met`
              : totalBids > cardsDealt
                ? `Overbid by ${totalBids - cardsDealt}`
                : `Underbid by ${cardsDealt - totalBids}`
            }
          </div>
          {allBidsEntered && (
            <div className="flex gap-3">
              <button
                onClick={onBack}
                className="flex-1 py-3 rounded-xl bg-gray-700 text-gray-300 font-medium active:bg-gray-600"
              >
                Back
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold active:bg-blue-500"
              >
                Confirm Bids
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
