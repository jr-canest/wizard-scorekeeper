import { SUITS } from '../utils/constants';

export default function RoundHeader({ roundNumber, cardsDealt, dealerName, trumpSuit, onSelectTrump }) {
  const suitInfo = trumpSuit && trumpSuit !== 'none' ? SUITS[trumpSuit] : null;
  const hasTrump = trumpSuit !== null && trumpSuit !== undefined;

  return (
    <div className="card-gold p-4 mb-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white">
            Round {roundNumber}
          </h2>
          <p className="text-navy-200 text-sm">
            {cardsDealt} card{cardsDealt !== 1 ? 's' : ''} each
          </p>
        </div>
        <div className="text-right">
          <p className="text-navy-200 text-sm">Dealer</p>
          <p className="text-gold-200 font-semibold">{dealerName}</p>
        </div>
      </div>
      {/* Trump row — tappable during a round so it can be set/changed
          mid-bidding when a Wizard or Jester is flipped. */}
      {onSelectTrump ? (
        <button
          onClick={onSelectTrump}
          className="mt-2 pt-2 border-t border-gold-700/30 w-full flex items-center justify-between text-left active:opacity-70"
        >
          <span className="text-sm">
            <span className="text-navy-200">Trump: </span>
            {hasTrump ? (
              suitInfo ? (
                <span className="font-semibold" style={{ color: suitInfo.color }}>
                  {suitInfo.symbol} {suitInfo.name}
                </span>
              ) : (
                <span className="text-navy-200 font-semibold">No Trump</span>
              )
            ) : (
              <span className="text-navy-200/60 italic">not set</span>
            )}
          </span>
          <span className="text-gold-200/80 text-xs px-2 py-1 rounded-lg border border-gold-700/50 bg-navy-800/40">
            {hasTrump ? 'Change' : 'Set Trump'}
          </span>
        </button>
      ) : (
        hasTrump && (
          <div className="mt-2 pt-2 border-t border-gold-700/30">
            <span className="text-navy-200 text-sm">Trump: </span>
            {suitInfo ? (
              <span className="font-semibold" style={{ color: suitInfo.color }}>
                {suitInfo.symbol} {suitInfo.name}
              </span>
            ) : (
              <span className="text-navy-200 font-semibold">No Trump</span>
            )}
          </div>
        )
      )}
    </div>
  );
}
