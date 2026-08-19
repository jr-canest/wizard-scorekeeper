import { SUITS, SUIT_ORDER, NO_TRUMP } from '../utils/constants';

export default function TrumpSelection({ dealerName, onSelect }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="card-gold bg-[#0d1426] p-5 max-w-sm w-full pop-in">
        <h3 className="font-display font-semibold text-[24px] leading-none text-cream-bright mb-3.5 text-center">Select Trump</h3>

        <div className="card-gold-subtle p-3 mb-4 text-sm space-y-1">
          <p className="text-navy-200">
            <span className="text-gold-text font-medium">Wizard</span> — {dealerName} chooses
          </p>
          <p className="text-navy-200">
            <span className="text-[#7dd3fc] font-medium">Jester</span> — No trump
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
          {SUIT_ORDER.map(suit => {
            const info = SUITS[suit];
            return (
              <button
                key={suit}
                onClick={() => onSelect(suit)}
                className="chip h-14 flex items-center justify-center gap-2 !text-lg"
                style={{ color: info.color }}
              >
                <span className="text-2xl">{info.symbol}</span>
                {info.name}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => onSelect(NO_TRUMP)}
          className="chip w-full h-14 text-lg mb-2.5"
        >
          No Trump
        </button>
        <button
          onClick={() => onSelect(null)}
          className="btn-secondary w-full h-10 text-sm"
        >
          N/A — Clear selection
        </button>
      </div>
    </div>
  );
}
