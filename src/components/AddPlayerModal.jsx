import { useState } from 'react';

export default function AddPlayerModal({ onAdd, onCancel }) {
  const [name, setName] = useState('');
  const [points, setPoints] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  if (!confirmed) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="card-gold bg-[#0d1426] p-6 max-w-sm w-full pop-in">
          <h3 className="font-display font-semibold text-[22px] leading-none text-cream-bright mb-2.5">Add player mid-game</h3>
          <p className="text-navy-200 text-sm mb-6">
            Adding a player mid-game is not recommended. They will join this round. Continue?
          </p>
          <div className="flex gap-2.5">
            <button onClick={onCancel} className="btn-secondary flex-1 h-12 text-[15px]">
              Cancel
            </button>
            <button onClick={() => setConfirmed(true)} className="btn-gold flex-1 h-12 text-base">
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="card-gold bg-[#0d1426] p-6 max-w-sm w-full pop-in">
        <h3 className="font-display font-semibold text-[22px] leading-none text-cream-bright mb-4">New player</h3>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Player name"
          className="w-full h-11 bg-[rgba(20,26,44,.8)] border border-gold-300/25 rounded-lg px-3 text-cream placeholder-navy-300 focus:border-gold-300 focus:outline-none mb-3"
          maxLength={20}
          autoFocus
        />
        <div className="mb-4">
          <label className="section-label mb-1.5 block">Starting points (optional)</label>
          <input
            type="number"
            value={points}
            onChange={e => setPoints(e.target.value)}
            placeholder="0"
            className="w-full h-11 bg-[rgba(20,26,44,.8)] border border-gold-300/25 rounded-lg px-3 text-cream tabular-nums placeholder-navy-300 focus:border-gold-300 focus:outline-none"
          />
        </div>
        <div className="flex gap-2.5">
          <button onClick={onCancel} className="btn-secondary flex-1 h-12 text-[15px]">
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onAdd(name.trim(), parseInt(points) || 0)}
            disabled={!name.trim()}
            className="btn-gold flex-1 h-12 text-base"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
