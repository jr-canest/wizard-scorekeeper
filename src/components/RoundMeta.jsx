import { SUITS } from '../utils/constants';
import DealerBadge from './DealerBadge';

// Centred metadata under the sticky title block (which owns the ◆
// ornament rule): the boxed dealer on its own line, then
// `Trump ♥ Hearts · 3 cards`. The trump segment is tappable during
// bidding/tricks so trump can be set or changed when a Wizard or Jester
// is flipped mid-round.
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
    <div className="flex flex-col items-center gap-2 pt-1 pb-2.5">
      <DealerBadge name={dealerName} />
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-medium text-navy-200">
        {onSelectTrump ? (
          <button onClick={onSelectTrump} className="active:opacity-70">
            Trump {trumpValue}
          </button>
        ) : (
          hasTrump && <span>Trump {trumpValue}</span>
        )}
        {(onSelectTrump || hasTrump) && <span className="text-steel">·</span>}
        <span>
          {cardsDealt} card{cardsDealt !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
