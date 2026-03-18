import { SUITS, SUIT_ORDER, NO_TRUMP } from '../utils/constants';

export default function TrumpSelection({ dealerName, onSelect, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full">
        <h3 className="text-lg font-semibold text-white mb-3 text-center">Select Trump</h3>

        <div className="bg-gray-700/50 rounded-lg p-3 mb-4 text-sm space-y-1">
          <p className="text-gray-300">
            <span className="text-amber-400 font-medium">Wizard</span> — {dealerName} chooses
          </p>
          <p className="text-gray-300">
            <span className="text-blue-400 font-medium">Jester</span> — No trump
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          {SUIT_ORDER.map(suit => {
            const info = SUITS[suit];
            return (
              <button
                key={suit}
                onClick={() => onSelect(suit)}
                className="py-4 rounded-xl bg-gray-700 active:bg-gray-600 flex items-center justify-center gap-2 text-lg font-semibold border border-gray-600"
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
          className="w-full py-4 rounded-xl font-semibold text-lg bg-gray-700 text-gray-400 border border-gray-600 active:bg-gray-600 mb-3"
        >
          No Trump
        </button>
        <button
          onClick={onCancel}
          className="w-full py-2 text-gray-500 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
