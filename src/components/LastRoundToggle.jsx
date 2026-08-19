// The Last Round switch, shared by the pre-round screen and the
// bidding phase footer. 44×24 pill per the 1b kit: gold gradient +
// white knob when on, navy + dim knob when off.
export default function LastRoundToggle({ isLastRound, onDeclare, onUndeclare }) {
  return (
    <button
      onClick={() => (isLastRound ? onUndeclare() : onDeclare())}
      className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors shrink-0 border ${
        isLastRound
          ? 'border-gold-text'
          : 'bg-[#141c33] border-gold-300/25'
      }`}
      style={isLastRound ? { background: 'linear-gradient(180deg,#f0dda0 0%,#c9a141 45%,#9c7a26 100%)' } : undefined}
    >
      <span
        className={`inline-block w-[18px] h-[18px] rounded-full shadow transition-transform ${
          isLastRound ? 'bg-white' : 'bg-navy-300'
        }`}
        style={{ transform: isLastRound ? 'translateX(23px)' : 'translateX(2px)' }}
      />
    </button>
  );
}
