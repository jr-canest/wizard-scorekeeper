// Boxed `♛ DEALER  Name` at the top of a round screen. The dealer is who
// the table looks for first (they deal, then bid last), so the name gets
// its own gold-outlined box instead of blending into the small-print
// metadata row. Same square outline as the seating-list and Next-up
// dealer badges, one step louder: stronger border + a faint gold fill.
export default function DealerBadge({ name }) {
  return (
    <div className="inline-flex items-center gap-2.5 max-w-full border border-gold-300/60 bg-gold-300/10 px-3 py-1.5">
      <span className="shrink-0 flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] leading-none text-gold-text">
        <span className="text-gold-300 text-[12px] leading-none">♛</span> Dealer
      </span>
      <span className="min-w-0 truncate font-display font-semibold text-[17px] leading-none tracking-[0.01em] text-cream-bright">
        {name}
      </span>
    </div>
  );
}
