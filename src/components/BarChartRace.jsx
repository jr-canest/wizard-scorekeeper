import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

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

  // Animation loop
  const animate = useCallback((timestamp) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const elapsed = timestamp - startTimeRef.current;
    const newProgress = startProgressRef.current + (elapsed / totalDuration) * totalRounds;

    if (newProgress >= totalRounds) {
      setProgress(totalRounds);
      setIsPlaying(false);
      return;
    }
    setProgress(newProgress);
    animRef.current = requestAnimationFrame(animate);
  }, [totalDuration, totalRounds]);

  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = null;
      startProgressRef.current = progress;
      animRef.current = requestAnimationFrame(animate);
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [isPlaying, animate]);

  // Auto-start after game-over wipe has landed
  useEffect(() => {
    const timer = setTimeout(() => {
      setProgress(0);
      setIsPlaying(true);
    }, 1200);
    return () => clearTimeout(timer);
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
      if (points.length < 2) return { id: p.id, path: '', points };

      let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const cpx = (prev.x + curr.x) / 2;
        d += ` C ${cpx.toFixed(2)} ${prev.y.toFixed(2)}, ${cpx.toFixed(2)} ${curr.y.toFixed(2)}, ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
      }
      return { id: p.id, path: d, points };
    });
  }, [players, scoreData, totalRounds, minScore, maxScore]);

  const pathLengths = useRef({});

  // How much of the path to reveal based on progress (0..1 per player)
  const getPathReveal = (playerId) => {
    const line = playerLines.find((l) => l.id === playerId);
    if (!line || line.points.length < 2) return 0;
    const first = line.points[0].ri;
    const last = line.points[line.points.length - 1].ri;
    const range = last - first;
    if (range === 0) return 1;
    return Math.min(1, Math.max(0, (progress - first) / range));
  };

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

  // Label collision avoidance — sort active labels by Y, push overlapping
  // ones down, and if the whole stack runs past the chart bottom, shift it
  // up so nothing clips. Keeps the dot on the real score line; the label
  // block (name + score) is moved as a unit to avoid text overlap.
  const LABEL_BLOCK_HEIGHT = 22; // name (10px) + score (9px) + a little breathing room
  const labelPositions = useMemo(() => {
    const active = players
      .filter((p) => isActiveAt(p.id, progress))
      .map((p) => {
        const rawScore = getScoreAt(p.id, progress);
        return {
          id: p.id,
          dotY: yForScore(rawScore),
        };
      });

    if (active.length === 0) return {};

    // Sort by actual dot Y (top of chart first)
    active.sort((a, b) => a.dotY - b.dotY);

    // First pass: stack labels downward from each dot's ideal Y
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

    // Second pass: if the stack extends past the chart bottom, shift
    // everyone up. If that pushes the top past the chart top, shift down
    // just enough to bring the top into view (preferring the top stay
    // visible over the bottom).
    const chartTop = 4; // allow labels a touch above topPad since names are small
    const chartBottom = svgHeight - 4;
    const lastLabelBottom = positions[ordered[ordered.length - 1]] + 14;
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
  }, [players, progress, getScoreAt, isActiveAt, minScore, maxScore]);

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
        style={{ height: 'auto', maxHeight: '360px' }}
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

        {/* Lines — revealed portion using dasharray */}
        {playerLines.map((line) => {
          const reveal = getPathReveal(line.id);
          return (
            <path
              key={`fg-${line.id}`}
              d={line.path}
              fill="none"
              stroke={playerColors[line.id]}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              ref={(el) => {
                if (el && !pathLengths.current[line.id]) {
                  pathLengths.current[line.id] = el.getTotalLength();
                }
              }}
              strokeDasharray={pathLengths.current[line.id] || 1000}
              strokeDashoffset={
                (pathLengths.current[line.id] || 1000) * (1 - reveal)
              }
              style={{ opacity: reveal > 0 ? 1 : 0 }}
            />
          );
        })}

        {/* Moving dots + labels at current position */}
        {players.map((p) => {
          if (!isActiveAt(p.id, progress)) return null;
          const rawScore = getScoreAt(p.id, progress);
          const displayScore = Math.round(rawScore);
          const x = xForRound(Math.min(progress, totalRounds));
          const dotY = yForScore(rawScore);
          // Label may be pushed away from the dot to avoid overlap with
          // other labels. If so, draw a faint connector from the dot to the label.
          const labelY = labelPositions[p.id] ?? (dotY - 4);
          const labelCenterY = labelY + 5; // roughly the middle of the two-line block
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
                stroke="#0e1a38" strokeWidth="1.5"
              />
              <text
                x={x + 10} y={labelY}
                fill={playerColors[p.id]}
                fontSize="10" fontWeight="600"
                dominantBaseline="auto"
              >
                {p.name}
              </text>
              <text
                x={x + 10} y={labelY + 14}
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
