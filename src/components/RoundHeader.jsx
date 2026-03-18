import { SUITS } from '../utils/constants';

export default function RoundHeader({ roundNumber, cardsDealt, dealerName, trumpSuit }) {
  const suitInfo = trumpSuit && trumpSuit !== 'none' ? SUITS[trumpSuit] : null;

  return (
    <div className="bg-gray-800 rounded-xl p-4 mb-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white">
            Round {roundNumber}
          </h2>
          <p className="text-gray-400 text-sm">
            {cardsDealt} card{cardsDealt !== 1 ? 's' : ''} each
          </p>
        </div>
        <div className="text-right">
          <p className="text-gray-400 text-sm">Dealer</p>
          <p className="text-amber-400 font-semibold">{dealerName}</p>
        </div>
      </div>
      {trumpSuit && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <span className="text-gray-400 text-sm">Trump: </span>
          {suitInfo ? (
            <span className="font-semibold" style={{ color: suitInfo.color }}>
              {suitInfo.symbol} {suitInfo.name}
            </span>
          ) : (
            <span className="text-gray-500 font-semibold">No Trump</span>
          )}
        </div>
      )}
    </div>
  );
}
