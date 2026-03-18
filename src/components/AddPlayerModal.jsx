import { useState } from 'react';

export default function AddPlayerModal({ onAdd, onCancel }) {
  const [name, setName] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  if (!confirmed) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full">
          <h3 className="text-lg font-semibold text-white mb-2">Add Player Mid-Game</h3>
          <p className="text-gray-300 text-sm mb-6">
            Adding a player mid-game is not recommended. They will start with 0 points and no scores for previous rounds. Continue?
          </p>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 py-3 rounded-lg bg-gray-700 text-gray-300 font-medium">
              Cancel
            </button>
            <button onClick={() => setConfirmed(true)} className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-medium">
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full">
        <h3 className="text-lg font-semibold text-white mb-4">New Player Name</h3>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Enter name"
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none mb-4"
          maxLength={20}
          autoFocus
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-lg bg-gray-700 text-gray-300 font-medium">
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onAdd(name.trim())}
            disabled={!name.trim()}
            className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-medium disabled:bg-gray-700 disabled:text-gray-500"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
