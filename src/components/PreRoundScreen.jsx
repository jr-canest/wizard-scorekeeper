import { SUITS } from '../utils/constants';

export default function PreRoundScreen({
  roundNumber,
  cardsDealt,
  maxRounds,
  isExtraRound,
  players,
  dealerIndex,
  totalScores,
  trumpSuit,
  isLastRound,
  lastRoundTrumpChoice,
  onStartRound,
  onSelectTrump,
  onDeclareLastRound,
  onAddPlayer,
}) {
  const dealer = players[dealerIndex];
  // Keep seating order, don't sort by score
  const hasTrump = trumpSuit !== null;
  const suitInfo = trumpSuit && trumpSuit !== 'none' ? SUITS[trumpSuit] : null;
  const forceNoTrump = isLastRound && lastRoundTrumpChoice === 'without';

  return (
    <div className="mb-4">
      {/* Round info */}
      <div className="bg-gray-800 rounded-xl p-4 mb-4 text-center">
        <h2 className="text-xl font-bold text-white">
          Round {roundNumber}
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          {cardsDealt} card{cardsDealt !== 1 ? 's' : ''} each
          {isExtraRound && <span className="text-amber-400 ml-1">(max cards)</span>}
        </p>
        {hasTrump && (
          <div className="mt-2">
            {suitInfo ? (
              <span className="font-semibold" style={{ color: suitInfo.color }}>
                Trump: {suitInfo.symbol} {suitInfo.name}
              </span>
            ) : (
              <span className="text-gray-500 font-semibold">No Trump</span>
            )}
          </div>
        )}
      </div>

      {isLastRound && (
        <div className="bg-amber-900/30 rounded-lg px-3 py-2 mb-4 text-center">
          <span className="text-amber-400 text-sm font-medium">
            Last Round {forceNoTrump ? '(No Trump)' : ''}
          </span>
        </div>
      )}

      {/* Player list in seating order */}
      <div className="bg-gray-800 rounded-xl overflow-hidden mb-4">
        <div className="px-3 py-2 border-b border-gray-700">
          <span className="text-gray-400 text-sm font-medium">Players</span>
        </div>
        {players.map((player) => {
          const total = totalScores[player.id] || 0;
          const isDealer = player.id === dealer.id;
          return (
            <div
              key={player.id}
              className={`flex items-center justify-between px-3 py-2.5 border-b border-gray-700/50 last:border-0 ${
                isDealer ? 'bg-amber-900/20' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{player.name}</span>
                {isDealer && (
                  <span className="text-amber-400 text-xs bg-amber-900/40 px-1.5 py-0.5 rounded">Dealer</span>
                )}
              </div>
              <span className={`font-semibold ${
                total > 0 ? 'text-green-400' : total < 0 ? 'text-red-400' : 'text-gray-400'
              }`}>
                {total}
              </span>
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        {/* Main action: Start Round */}
        <button
          onClick={onStartRound}
          className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-lg active:bg-blue-500"
        >
          Start Round
        </button>

        {/* Select Trump - only when needed (wizard/jester flipped) */}
        {!forceNoTrump && (
          <button
            onClick={onSelectTrump}
            className={`w-full py-3 rounded-xl font-medium border ${
              hasTrump
                ? 'bg-gray-800 text-gray-300 border-gray-700'
                : 'bg-gray-800 text-gray-300 border-gray-700'
            } active:bg-gray-700`}
          >
            {hasTrump ? 'Change Trump' : 'Select Trump'}
          </button>
        )}

        {/* Secondary actions */}
        <div className="flex gap-2">
          {!isLastRound && (
            <button
              onClick={onDeclareLastRound}
              className="flex-1 py-2.5 rounded-lg text-sm text-amber-400 bg-amber-900/30 active:bg-amber-900/50"
            >
              Declare Last Round
            </button>
          )}
          <button
            onClick={onAddPlayer}
            className="flex-1 py-2.5 rounded-lg text-sm text-gray-400 bg-gray-800 active:bg-gray-700"
          >
            + Add Player
          </button>
        </div>
      </div>
    </div>
  );
}
