import { SUITS } from '../utils/constants';

// Ornament rule + centred metadata row shown under the sticky title
// block: `Trump ♥ Hearts · Dealer Marcus · 3 cards`. The trump segment
// is tappable during bidding/tricks so trump can be set or changed when
// a Wizard or Jester is flipped mid-round.
export default function RoundMeta({ trumpSuit, dealerName, cardsDealt, onSelectTrump }) {
  const suitInfo = trumpSuit && trumpSuit !== 'none' ? SUITS[trumpSuit] : null;
  const hasTrump = trumpSuit !== null && trumpSuit !== undefined;

  const trumpValue = hasTrump ? (
    suitInfo ? (
      <span className="font-bold" style={{ color: suitInfo.color }}>
        {suitInfo.symbol} {suitInfo.name}
      </span>
    ) : (
      <span className="text-cream font-bold">No Trump</span>
    )
  ) : (
    <span className="text-navy-300 italic">tap to set</span>
  );

  return (
    <div className="pt-3.5 pb-2">
      <div className="ornament">
        <span className="diamond" />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-3.5 text-xs font-medium text-navy-200">
        {onSelectTrump ? (
          <button onClick={onSelectTrump} className="active:opacity-70">
            Trump {trumpValue}
          </button>
        ) : (
          hasTrump && <span>Trump {trumpValue}</span>
        )}
        {(onSelectTrump || hasTrump) && <span className="text-steel">·</span>}
        <span>
          Dealer <span className="text-cream">{dealerName}</span>
        </span>
        <span className="text-steel">·</span>
        <span>
          {cardsDealt} card{cardsDealt !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
