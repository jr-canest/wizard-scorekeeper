import PlayerOrderList from './PlayerOrderList';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

// Seating order for the next round, opened from the merged round-results
// screen. Same hold-to-drag list as the pre-round screen; the dealer
// badge shows who deals next (change it with the Dealer picker).
export default function SeatingModal({ players, allPlayers, dealerId, totalScores, onReorderPlayers, onClose }) {
  useBodyScrollLock();
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="card-gold bg-[#0d1426] p-5 max-w-sm w-full pop-in">
        <div className="flex items-baseline justify-between mb-1">
          <h3 className="font-display font-semibold text-[22px] leading-none text-cream-bright">Seating</h3>
          <span className="text-navy-300 text-[10px]">Hold to reorder</span>
        </div>
        <p className="text-navy-200 text-xs mb-3">Order around the table, starting anywhere. Bidding goes left of the dealer.</p>
        <div
          className="card-gold-subtle overflow-y-auto"
          style={{ maxHeight: 'calc(60vh / var(--ui-zoom, 1))' }}
        >
          <PlayerOrderList
            players={players}
            allPlayers={allPlayers}
            dealerId={dealerId}
            totalScores={totalScores}
            onReorderPlayers={onReorderPlayers}
          />
        </div>
        <button onClick={onClose} className="btn-gold w-full mt-3 h-11 text-[15px]">
          Done
        </button>
      </div>
    </div>
  );
}
