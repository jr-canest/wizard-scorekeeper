// Sticky title block for the bidding/tricks phases: eyebrow + serif round
// title on the left, the big total/target numeral + tone label on the
// right. Always visible while scrolling the player list.
const TONES = {
  over: 'text-[#fda4af]',
  even: 'text-[#fcd34d]',
  under: 'text-[#7dd3fc]',
};

export default function PhaseStatusBar({ eyebrow, roundNumber, total, target, statusText, tone }) {
  const toneText = TONES[tone] || 'text-cream';
  return (
    <div className="sticky top-0 z-20 -mx-3.5 px-3.5 pt-3 pb-3 bg-[#0b1224]/95 border-b border-gold-300/15 flex items-end justify-between">
      <div>
        <div className="eyebrow mb-[7px]">{eyebrow}</div>
        <div className="font-display font-semibold text-[34px] leading-none tracking-[0.01em] text-cream-bright">
          Round {roundNumber}
        </div>
      </div>
      <div className="text-right">
        <div className={`font-display font-semibold text-[30px] leading-none tabular-nums ${toneText}`}>
          {total}
          <span className="text-steel">/{target}</span>
        </div>
        <div className="mt-1.5 h-[10px]">
          {statusText && tone && (
            // Keyed by text so the label re-pops whenever the status changes
            <div
              key={statusText}
              className={`pop-in text-[10px] font-bold uppercase tracking-[0.14em] leading-none ${toneText}`}
            >
              {statusText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
