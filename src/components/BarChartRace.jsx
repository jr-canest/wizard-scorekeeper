import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { isProduction } from '../utils/firebase';

const LINE_COLORS = [
  '#e6cc80', // gold
  '#7dd3fc', // sky
  '#86efac', // green
  '#fca5a5', // red
  '#c4b5fd', // purple
  '#fdba74', // orange
  '#f9a8d4', // pink
  '#67e8f9', // cyan
  '#fde047', // yellow
  '#a5b4fc', // indigo
];

// Easing (smoothstep)
const easeInOut = (t) => t * t * (3 - 2 * t);

// Dev-only: `?chartAt=2.5` opens the replay paused at that progress so a
// mid-animation frame can be inspected (screenshots, DOM checks). Ignored
// in production.
function devChartAt() {
  if (isProduction()) return null;
  const raw = new URLSearchParams(window.location.search).get('chartAt');
  if (raw === null) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/*
 * Each line segment is a cubic with horizontal tangents at both data
 * points (control points at the segment's mid-x). For that curve:
 *   x(t) = x0 + (x1 − x0) · (1.5t(1−t) + t³)   (monotonic in t)
 *   y(t) = y0 + (y1 − y0) · t²(3 − 2t)
 * The replay's x moves linearly with progress, so the tip of the line at
 * a given progress is the curve point whose x matches — found by solving
 * the first equation for t. Everything at the tip (the visible end of the
 * line, the dot, the label, the score) is then read from that one point.
 * Previously the line was trimmed by stroke-dasharray, i.e. as a fraction
 * of ARC LENGTH, while the dot moved linearly in x with an eased score —
 * steep segments are longer, so the dot ran ahead of or behind the tip
 * by up to ~7 units (of 320) and sat slightly off the curve.
 */
function solveCurveT(u) {
  // Invert x-fraction u ∈ [0,1] → t (bisection; g is strictly increasing).
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2;
    const g = 1.5 * mid * (1 - mid) + mid * mid * mid;
    if (g < u) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
const fmt = (n) => n.toFixed(2);
function segmentString(x0, y0, x1, y1) {
  const m = (x0 + x1) / 2;
  return ` C ${fmt(m)} ${fmt(y0)}, ${fmt(m)} ${fmt(y1)}, ${fmt(x1)} ${fmt(y1)}`;
}
// De Casteljau split of the segment at t: returns the partial curve's
// command string and its end point (the tip).
function partialSegment(x0, y0, x1, y1, t) {
  const m = (x0 + x1) / 2;
  const P = [[x0, y0], [m, y0], [m, y1], [x1, y1]];
  const L = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const A = L(P[0], P[1]);
  const B = L(P[1], P[2]);
  const C = L(P[2], P[3]);
  const AB = L(A, B);
  const BC = L(B, C);
  const tip = L(AB, BC);
  return {
    cmd: ` C ${fmt(A[0])} ${fmt(A[1])}, ${fmt(AB[0])} ${fmt(AB[1])}, ${fmt(tip[0])} ${fmt(tip[1])}`,
    x: tip[0],
    y: tip[1],
  };
}

export default function BarChartRace({ players, completedRounds, onDone }) {
  const [progress, setProgress] = useState(0); // 0 = starting totals, totalRounds = final scores
  const [isPlaying, setIsPlaying] = useState(false);
  const animRef = useRef(null);
  const startTimeRef = useRef(null);
  const startProgressRef = useRef(0);

  const totalRounds = completedRounds.length;
  const SECONDS_PER_ROUND = 1.2;
  const totalDuration = totalRounds * SECONDS_PER_ROUND * 1000;

  // Stable colors per player
  const playerColors = useMemo(() => {
    const colors = {};
    players.forEach((p, i) => {
      colors[p.id] = LINE_COLORS[i % LINE_COLORS.length];
    });
    return colors;
  }, [players]);

  /*
   * scoreData[0] = before round 1 starts (all active players at their startingPoints, usually 0)
   * scoreData[i] = after round i is scored, for i from 1..totalRounds
   * Each entry: { scores: { playerId: number }, activePlayers: [ids] }
   */
  const scoreData = useMemo(() => {
    const data = [];
    const totals = {};
    players.forEach((p) => { totals[p.id] = p.startingPoints || 0; });

    // Round 0 — starting state. A player is "active" if they played in round 1.
    const initialActive = players.filter((p) => p.addedInRound <= 1);
    data.push({
      scores: { ...totals },
      activePlayers: initialActive.map((p) => p.id),
    });

    for (let ri = 0; ri < completedRounds.length; ri++) {
      const round = completedRounds[ri];
      const active = players.filter((p) => p.addedInRound <= round.roundNumber);
      active.forEach((p) => {
        if (round.scores?.[p.id] !== undefined) {
          totals[p.id] = (totals[p.id] || 0) + round.scores[p.id];
        }
      });
      data.push({
        scores: { ...totals },
        activePlayers: active.map((p) => p.id),
      });
    }
    return data;
  }, [players, completedRounds]);

  // Global min/max for the Y-axis — include 0 as a baseline (everyone starts at 0).
  const { minScore, maxScore } = useMemo(() => {
    let min = 0;
    let max = 0;
    for (const entry of scoreData) {
      for (const id of entry.activePlayers) {
        const s = entry.scores[id];
        if (s !== undefined) {
          if (s < min) min = s;
          if (s > max) max = s;
        }
      }
    }
    // Tiny padding so top/bottom values don't sit on the edge
    const pad = Math.max(10, Math.ceil((max - min) * 0.08));
    return { minScore: min - pad, maxScore: max + pad };
  }, [scoreData]);

  // Interpolate score for a player at fractional progress (0 = start, totalRounds = end)
  const getScoreAt = useCallback((playerId, t) => {
    if (scoreData.length === 0) return 0;
    if (t <= 0) return scoreData[0].scores[playerId] ?? 0;
    if (t >= scoreData.length - 1) return scoreData[scoreData.length - 1].scores[playerId] ?? 0;

    const i = Math.floor(t);
    const frac = t - i;
    const curr = scoreData[i].scores[playerId];
    const next = scoreData[i + 1].scores[playerId];

    if (curr === undefined && next === undefined) return 0;
    if (curr === undefined) return next;
    if (next === undefined) return curr;

    const e = easeInOut(frac);
    return curr + (next - curr) * e;
  }, [scoreData]);

  // Is this player participating yet at fractional progress t?
  const isActiveAt = useCallback((playerId, t) => {
    const i = Math.min(scoreData.length - 1, Math.max(0, Math.floor(t)));
    return scoreData[i]?.activePlayers.includes(playerId);
  }, [scoreData]);

  // Animation loop. Named function expression so the rAF callback can
  // re-schedule itself without referencing the outer `animate` binding
  // (which the lint sees as a TDZ reference inside its own initializer).
  const animate = useCallback(function tick(timestamp) {
    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const elapsed = timestamp - startTimeRef.current;
    const newProgress = startProgressRef.current + (elapsed / totalDuration) * totalRounds;

    if (newProgress >= totalRounds) {
      setProgress(totalRounds);
      setIsPlaying(false);
      return;
    }
    setProgress(newProgress);
    animRef.current = requestAnimationFrame(tick);
  }, [totalDuration, totalRounds]);

  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = null;
      startProgressRef.current = progress;
      animRef.current = requestAnimationFrame(animate);
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    // progress is read once at start via the ref — including it in deps
    // would restart the rAF on every progress tick (infinite loop).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, animate]);

  // Auto-start after game-over wipe has landed
  useEffect(() => {
    const at = devChartAt();
    if (at !== null) {
      setProgress(Math.max(0, Math.min(totalRounds, at)));
      return undefined;
    }
    const timer = setTimeout(() => {
      setProgress(0);
      setIsPlaying(true);
    }, 1200);
    return () => clearTimeout(timer);
    // totalRounds is fixed for the life of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentRoundLabel = Math.min(totalRounds, Math.max(0, Math.round(progress)));
  const isFinished = progress >= totalRounds;

  function handlePlayPause() {
    if (isFinished) {
      setProgress(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  }

  function handleSkip() {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setProgress(totalRounds);
    setIsPlaying(false);
  }

  // SVG dimensions
  const svgWidth = 320;
  const svgHeight = 220;
  const leftPad = 0;
  const rightPad = 45; // space for name + score labels
  const topPad = 24;
  const bottomPad = 18;
  const chartWidth = svgWidth - leftPad - rightPad;
  const chartHeight = svgHeight - topPad - bottomPad;

  // X: round index (0..totalRounds) → pixel
  const xForRound = (ri) => leftPad + (ri / Math.max(1, totalRounds)) * chartWidth;
  // Y: score → pixel (higher score = smaller y)
  const scoreRange = Math.max(1, maxScore - minScore);
  const yForScore = (score) => topPad + ((maxScore - score) / scoreRange) * chartHeight;

  // Pre-build the full path for each player (no animation, used for reveal via dasharray)
  const playerLines = useMemo(() => {
    return players.map((p) => {
      const points = [];
      for (let ri = 0; ri < scoreData.length; ri++) {
        const entry = scoreData[ri];
        if (!entry.activePlayers.includes(p.id)) continue;
        const score = entry.scores[p.id];
        if (score === undefined) continue;
        points.push({ x: xForRound(ri), y: yForScore(score), ri, score });
      }
      if (points.length < 2) return { id: p.id, points, segs: [] };
      // One cubic command per segment; the revealed path is a prefix of
      // these plus a split of the segment the tip is on.
      const segs = [];
      for (let i = 1; i < points.length; i++) {
        segs.push(segmentString(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y));
      }
      return { id: p.id, points, segs };
    });
    // xForRound + yForScore close over totalRounds/min/max already
    // in the dep list — adding the functions themselves would force a
    // re-memo every render (they're re-created on each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, scoreData, totalRounds, minScore, maxScore]);

  // The tip of every line at the current progress: the revealed path
  // (cut exactly there), the point itself, and the score at that point.
  const tips = useMemo(() => {
    const out = {};
    for (const line of playerLines) {
      const { points, segs } = line;
      if (points.length < 2) continue;
      const first = points[0];
      const last = points[points.length - 1];
      const head = `M ${fmt(first.x)} ${fmt(first.y)}`;
      if (progress <= first.ri) {
        out[line.id] = { path: head, x: first.x, y: first.y, score: first.score };
        continue;
      }
      if (progress >= last.ri) {
        out[line.id] = { path: head + segs.join(''), x: last.x, y: last.y, score: last.score };
        continue;
      }
      let i = 1;
      while (i < points.length - 1 && points[i].ri <= progress) i++;
      const a = points[i - 1];
      const b = points[i];
      const u = (progress - a.ri) / (b.ri - a.ri);
      const t = solveCurveT(u);
      const part = partialSegment(a.x, a.y, b.x, b.y, t);
      out[line.id] = {
        path: head + segs.slice(0, i - 1).join('') + part.cmd,
        x: part.x,
        y: part.y,
        score: a.score + (b.score - a.score) * easeInOut(t),
      };
    }
    return out;
  }, [playerLines, progress]);

  // Gridlines at "nice" score intervals
  const gridLines = useMemo(() => {
    const step = pickStep(scoreRange);
    const lines = [];
    const start = Math.ceil(minScore / step) * step;
    for (let v = start; v <= maxScore; v += step) {
      lines.push(v);
    }
    return lines;
  }, [minScore, maxScore, scoreRange]);

  // Label collision avoidance — compute TARGET positions for each player:
  // sort by Y, stack 22px apart, then clamp stack inside chart bounds.
  const LABEL_BLOCK_HEIGHT = 22;
  const targetLabelPositions = useMemo(() => {
    const active = players
      .filter((p) => isActiveAt(p.id, progress))
      .map((p) => {
        const tip = tips[p.id];
        const dotY = tip ? tip.y : yForScore(getScoreAt(p.id, progress));
        return { id: p.id, dotY };
      });

    if (active.length === 0) return {};

    active.sort((a, b) => a.dotY - b.dotY);

    const positions = {};
    const ordered = [];
    let prevLabelY = -Infinity;
    for (const p of active) {
      let labelY = p.dotY - 4;
      if (labelY < prevLabelY + LABEL_BLOCK_HEIGHT) {
        labelY = prevLabelY + LABEL_BLOCK_HEIGHT;
      }
      positions[p.id] = labelY;
      ordered.push(p.id);
      prevLabelY = labelY;
    }

    const chartTop = 4;
    const chartBottom = svgHeight - 4;
    const lastLabelBottom = positions[ordered[ordered.length - 1]] + 10;
    if (lastLabelBottom > chartBottom) {
      const overflow = lastLabelBottom - chartBottom;
      for (const id of ordered) positions[id] -= overflow;
    }
    const firstLabelTop = positions[ordered[0]];
    if (firstLabelTop < chartTop) {
      const underflow = chartTop - firstLabelTop;
      for (const id of ordered) positions[id] += underflow;
    }

    return positions;
    // yForScore is re-created each render but only reads minScore/maxScore
    // (already in deps), so it'd just churn the memo without changing the
    // output.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, progress, tips, getScoreAt, isActiveAt, minScore, maxScore]);

  // Displayed label positions smoothly approach the targets via exponential
  // smoothing. This handles rank-swap jumps gracefully (label slides to its
  // new position over ~8 frames) without the browser-side CSS-transition
  // desync that happens when the target moves every frame. Stored in a ref
  // so we can read AND update it during render without triggering extra
  // re-renders; `progress` drives the render cadence.
  const displayedLabelYRef = useRef({});
  // Fraction of the remaining distance closed each frame. 0.22 → ~8 frames
  // (~130ms) to cover a big jump, but barely perceptible lag during normal
  // smooth tracking of a moving dot.
  const LABEL_SMOOTHING = 0.22;
  const labelPositions = {};
  for (const p of players) {
    const target = targetLabelPositions[p.id];
    if (target === undefined) {
      delete displayedLabelYRef.current[p.id];
      continue;
    }
    const curr = displayedLabelYRef.current[p.id];
    let next;
    if (curr === undefined) {
      next = target; // first frame — snap to target
    } else {
      next = curr + (target - curr) * LABEL_SMOOTHING;
      // Snap when close enough to prevent jitter from accumulated rounding.
      if (Math.abs(next - target) < 0.3) next = target;
    }
    displayedLabelYRef.current[p.id] = next;
    labelPositions[p.id] = next;
  }

  return (
    <div className="card-gold p-3 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-gold-200 text-sm font-medium">Game Replay</h3>
          <p className="text-navy-200/60 text-xs">
            {currentRoundLabel === 0
              ? `Start of game • ${totalRounds} rounds`
              : `Round ${currentRoundLabel} of ${totalRounds}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayPause}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-navy-600/60 text-white active:bg-navy-500/60 text-sm"
          >
            {isFinished ? '↺' : isPlaying ? '⏸' : '▶'}
          </button>
          {!isFinished && (
            <button
              onClick={handleSkip}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-navy-600/60 text-white active:bg-navy-500/60 text-sm"
            >
              ⏭
            </button>
          )}
          {onDone && (
            <button
              onClick={onDone}
              className="text-navy-200/40 text-xs active:text-white px-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Chart */}
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full"
        style={{ height: 'auto', maxHeight: '360px', overflow: 'visible' }}
      >
        {/* Gridlines at nice intervals */}
        {gridLines.map((v) => (
          <g key={v}>
            <line
              x1={leftPad} x2={leftPad + chartWidth}
              y1={yForScore(v)} y2={yForScore(v)}
              stroke={v === 0 ? '#e6cc80' : '#8a7a40'}
              strokeOpacity={v === 0 ? 0.35 : 0.15}
              strokeWidth={v === 0 ? 0.8 : 0.5}
              strokeDasharray={v === 0 ? '' : '2 3'}
            />
            <text
              x={leftPad + 2} y={yForScore(v) - 2}
              fill="#8a8a8a" fontSize="8" fontWeight="500"
              opacity="0.7"
            >
              {v}
            </text>
          </g>
        ))}

        {/* Lines — each cut exactly at its tip for the current progress */}
        {playerLines.map((line) => {
          const tip = tips[line.id];
          if (!tip) return null;
          return (
            <path
              key={`fg-${line.id}`}
              d={tip.path}
              fill="none"
              stroke={playerColors[line.id]}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {/* Moving dots + labels at current position */}
        {players.map((p) => {
          if (!isActiveAt(p.id, progress)) return null;
          const tip = tips[p.id];
          // Single-point lines (a player added on the final round) have no
          // curve to sit on — fall back to the interpolated position.
          const rawScore = tip ? tip.score : getScoreAt(p.id, progress);
          const displayScore = Math.round(rawScore);
          const x = tip ? tip.x : xForRound(Math.min(progress, totalRounds));
          const dotY = tip ? tip.y : yForScore(rawScore);
          const labelY = labelPositions[p.id] ?? (dotY - 4);
          const labelCenterY = labelY + 5;
          const dotToLabelOffset = Math.abs(labelCenterY - dotY);
          const needsConnector = dotToLabelOffset > 7;

          return (
            <g key={p.id}>
              {needsConnector && (
                <line
                  x1={x + 5} y1={dotY}
                  x2={x + 10} y2={labelCenterY}
                  stroke={playerColors[p.id]}
                  strokeOpacity="0.35"
                  strokeWidth="1"
                />
              )}
              <circle
                cx={x} cy={dotY} r="5"
                fill={playerColors[p.id]}
                stroke="#0b1224" strokeWidth="1.5"
              />
              {/*
                Labels position via `y` attribute only — the Y value is already
                smoothed per-frame against the target (see displayedLabelYRef
                above), so rank swaps slide smoothly without CSS transitions.
              */}
              <text
                x={x + 10} y={labelY}
                fill={playerColors[p.id]}
                fontSize="10" fontWeight="600"
                dominantBaseline="auto"
              >
                {p.name}
              </text>
              <text
                x={x + 10} y={labelY + 10}
                fill="#b0b8c8"
                fontSize="9" fontWeight="500"
                dominantBaseline="auto"
              >
                {displayScore}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Choose a round-number step (10/20/25/50/100...) that gives ~3-5 gridlines
function pickStep(range) {
  const target = range / 4;
  const candidates = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  for (const c of candidates) {
    if (c >= target) return c;
  }
  return candidates[candidates.length - 1];
}
