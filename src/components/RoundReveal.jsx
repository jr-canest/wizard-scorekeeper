import { REVEAL_LINE_MS, useRolledNumber } from '../utils/standingsReveal';

// The pieces of the round-results reveal, twins of the multiplayer app's
// RoundStandings.tsx (keep the two in step): the places-moved badge, the
// rolling total and the commentary lines.

/** Places gained or lost: a small drawn arrow and the count. */
export function MoveBadge({ move }) {
  const up = move > 0;
  return (
    <span
      className={`standing-badge-in shrink-0 inline-flex items-center gap-[2px] font-sans text-[10px] font-bold tabular-nums leading-none ${up ? 'text-[#6ee7b7]' : 'text-[#fda4af]'}`}
      aria-label={`${up ? 'up' : 'down'} ${Math.abs(move)}`}
    >
      <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true">
        <path d={up ? 'M4 1l3.5 6h-7z' : 'M4 7L.5 1h7z'} />
      </svg>
      {Math.abs(move)}
    </span>
  );
}

/** A total that rolls from the old score to the new once `run` is true. */
export function RolledNumber({ from, to, run, format }) {
  return <>{format(useRolledNumber(from, to, run))}</>;
}

/**
 * The cheer and the roast, in a box of their own. They are there from the
 * first frame (popping in on the first showing only): the commentary leads
 * and the table below then acts it out, so the box is never empty.
 */
export function RoundCommentary({ lines, animate }) {
  if (!lines.length) return null;
  return (
    <div
      className="round-quip-box card-gold px-3.5 py-3 mb-4 space-y-1.5"
      aria-live="polite"
    >
      {lines.map((l, i) => (
        <p
          key={i}
          style={{ animationDelay: `${REVEAL_LINE_MS[i] ?? 0}ms` }}
          className={`round-quip min-h-[26px] ${animate ? 'round-quip-in' : ''}`}
        >
          <span className="font-display font-semibold text-[17px] leading-tight text-cream-bright">
            {l.segs.map((s, j) =>
              s.name ? (
                <b key={j} className={`font-sans font-semibold text-[0.82em] ${l.tone === 'down' ? 'text-[#fda4af]' : 'text-[#e2c579]'}`}>{s.t}</b>
              ) : (
                // Numerals are never serif (kit rule): digits go sans.
                <span key={j}>
                  {s.t.split(/([+\u2212]?\d+)/).map((piece, k) =>
                    /\d/.test(piece) ? <span key={k} className="font-sans font-semibold text-[0.8em] tabular-nums">{piece}</span> : piece,
                  )}
                </span>
              ),
            )}
            {/* The emoji closes the sentence (Jorge: part of the line, not a bullet on the left). */}
            <span className="round-quip-emoji font-sans text-[1.05em] ml-1.5" aria-hidden="true">{l.emoji}</span>
          </span>
        </p>
      ))}
    </div>
  );
}
