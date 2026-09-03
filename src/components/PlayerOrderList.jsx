import { useState, useRef, useEffect } from 'react';

// Seating-order list with hold-to-drag reordering and the dealer badge.
// Shared by the pre-round screen (round 1 / back from bidding) and the
// Seating modal opened from the merged round-results screen.
//
// `players` is the list to show (active players in seating order);
// `allPlayers` is the full roster the reorder indices refer to. Window
// listeners track the drag so it keeps working when the pointer leaves
// the list (or a modal's scroll box).
export default function PlayerOrderList({
  players,
  allPlayers,
  dealerId,
  totalScores,
  onReorderPlayers,
}) {
  const [dragIndex, setDragIndex] = useState(null);
  const listRef = useRef(null);
  // Refs so the window listeners always see the latest props/state
  // without re-subscribing on every render.
  const dragIndexRef = useRef(null);
  const propsRef = useRef({ players, allPlayers, onReorderPlayers });
  useEffect(() => {
    propsRef.current = { players, allPlayers, onReorderPlayers };
  });

  function beginDrag(e, index) {
    e.preventDefault();
    dragIndexRef.current = index;
    setDragIndex(index);
  }

  useEffect(() => {
    if (dragIndex === null) return;

    function move(e) {
      const current = dragIndexRef.current;
      if (current === null) return;
      if (e.cancelable) e.preventDefault();
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const listEl = listRef.current;
      if (!listEl) return;
      const { players: list, allPlayers: all, onReorderPlayers: reorder } = propsRef.current;
      const items = listEl.children;
      for (let i = 0; i < items.length; i++) {
        if (i === current) continue;
        const rect = items[i].getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if ((current < i && clientY > midY) || (current > i && clientY < midY)) {
          const fromFull = all.indexOf(list[current]);
          const toFull = all.indexOf(list[i]);
          if (fromFull >= 0 && toFull >= 0) reorder(fromFull, toFull);
          dragIndexRef.current = i;
          setDragIndex(i);
          break;
        }
      }
    }

    function end() {
      dragIndexRef.current = null;
      setDragIndex(null);
    }

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
    };
  }, [dragIndex]);

  return (
    <div ref={listRef} className="select-none">
      {players.map((player, i) => {
        const total = totalScores[player.id] || 0;
        const isDealer = player.id === dealerId;
        return (
          <div
            key={player.id}
            className={`flex items-center h-11 px-1.5 border-b border-gold-300/10 last:border-0 transition-all ${
              isDealer ? 'bg-gold-300/5' : ''
            } ${dragIndex === i ? 'bg-navy-600/50 scale-[1.01]' : ''}`}
            onMouseDown={e => beginDrag(e, i)}
            onTouchStart={e => beginDrag(e, i)}
          >
            <div className="text-gold-200/30 cursor-grab active:cursor-grabbing px-1 text-sm touch-none">
              ⠿
            </div>
            <div className="flex items-center justify-between flex-1 px-1.5">
              <div className="flex items-center gap-2">
                <span className="font-display font-semibold text-[17px] text-cream-bright">{player.name}</span>
                {isDealer && (
                  <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-gold-text border border-gold-300/30 px-1.5 py-[3px]">
                    <span className="text-gold-300 text-[11px] leading-none">♛</span> Dealer
                  </span>
                )}
              </div>
              <span className={`font-bold text-[18px] tabular-nums ${
                total > 0 ? 'text-[#6ee7b7]' : total < 0 ? 'text-[#fda4af]' : 'text-cream'
              }`}>
                {total < 0 ? `−${Math.abs(total)}` : total}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
