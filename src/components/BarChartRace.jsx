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

export default function BarChartRace({ players, completedRounds, onDone }) {
  const [progress, setProgress] = useState(0); // 0 to totalRounds, fractional during animation
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const animRef = useRef(null);
  const startTimeRef = useRef(null);
  const startProgressRef = useRef(0);

  const totalRounds = completedRounds.length;
  const SECONDS_PER_ROUND = 1.2;
  const totalDuration = totalRounds * SECONDS_PER_ROUND * 1000;

  // Assign stable colors per player
  const playerColors = useMemo(() => {
    const colors = {};
    players.forEach((p, i) => {
      colors[p.id] = LINE_COLORS[i % LINE_COLORS.length];
    });
    return colors;
  }, [players]);

  // Pre-compute rank at each round (0-indexed rank, 0 = best)
  const rankData = useMemo(() => {
    const data = []; // data[roundIndex] = { playerId: rank }
    const totals = {};
    players.forEach(p => { totals[p.id] = p.startingPoints || 0; });

    for (let ri = 0; ri < completedRounds.length; ri++) {
      const round = completedRounds[ri];
      const active = players.filter(p => p.addedInRound <= round.roundNumber);

      active.forEach(p => {
        if (round.scores?.[p.id] !== undefined) {
          totals[p.id] = (totals[p.id] || 0) + round.scores[p.id];
        }
      });

      // Sort by score desc, assign ranks
      const sorted = active
        .map(p => ({ id: p.id, score: totals[p.id] || 0 }))
        .sort((a, b) => b.score - a.score);

      const ranks = {};
      sorted.forEach((p, i) => { ranks[p.id] = i; });

      data.push({
        ranks,
        scores: { ...totals },
        activePlayers: active.map(p => p.id),
        roundNumber: round.roundNumber,
      });
    }
    return data;
  }, [players, completedRounds]);

  // Get interpolated rank for a player at fractional progress
  const getRankAt = useCallback((playerId, t) => {
    if (t <= 0) {
      // Before round 1 — use round 0 order
      const r0 = rankData[0];
      return r0?.ranks[playerId] ?? -1;
    }
    const ri = Math.floor(t);
    const frac = t - ri;

    if (ri >= rankData.length - 1) {
      const last = rankData[rankData.length - 1];
      return last.ranks[playerId] ?? -1;
    }

    const curr = rankData[ri];
    const next = rankData[ri + 1];
    const currRank = curr.ranks[playerId];
    const nextRank = next.ranks[playerId];

    if (currRank === undefined) return nextRank ?? -1;
    if (nextRank === undefined) return currRank;

    // Smooth cubic interpolation
    const ease = frac * frac * (3 - 2 * frac);
    return currRank + (nextRank - currRank) * ease;
  }, [rankData]);

  // Get interpolated score at fractional progress
  const getScoreAt = useCallback((playerId, t) => {
    if (t <= 0) {
      return rankData[0]?.scores[playerId] ?? 0;
    }
    const ri = Math.floor(t);
    const frac = t - ri;

    if (ri >= rankData.length - 1) {
      return rankData[rankData.length - 1]?.scores[playerId] ?? 0;
    }

    const currScore = rankData[ri]?.scores[playerId] ?? 0;
    const nextScore = rankData[ri + 1]?.scores[playerId] ?? 0;
    const ease = frac * frac * (3 - 2 * frac);
    return Math.round(currScore + (nextScore - currScore) * ease);
  }, [rankData]);

  // Animation loop
  const animate = useCallback((timestamp) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const elapsed = timestamp - startTimeRef.current;
    const newProgress = startProgressRef.current + (elapsed / totalDuration) * totalRounds;

    if (newProgress >= totalRounds - 1) {
      setProgress(totalRounds - 1);
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
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, animate]);

  function handleStart() {
    setHasStarted(true);
    setProgress(0);
    setIsPlaying(true);
  }

  const maxPlayers = useMemo(() =>
    Math.max(...rankData.map(r => r.activePlayers.length)),
    [rankData]
  );

  // Current round label
  const currentRoundIndex = Math.min(Math.round(progress), totalRounds - 1);
  const currentRoundNumber = rankData[currentRoundIndex]?.roundNumber ?? 1;
  const isFinished = progress >= totalRounds - 1;

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
    setProgress(totalRounds - 1);
    setIsPlaying(false);
  }

  // SVG dimensions
  const svgWidth = 320;
  const svgHeight = Math.max(180, maxPlayers * 36);
  const leftPad = 0;
  const rightPad = 45; // space for name + score labels
  const topPad = 24;
  const bottomPad = 18;
  const chartWidth = svgWidth - leftPad - rightPad;
  const chartHeight = svgHeight - topPad - bottomPad;

  // Map round index to x position
  const xForRound = (ri) => leftPad + (ri / Math.max(1, totalRounds - 1)) * chartWidth;
  // Map rank to y position
  const yForRank = (rank) => topPad + (rank / Math.max(1, maxPlayers - 1)) * chartHeight;

  // Build paths and current positions
  const playerLines = useMemo(() => {
    return players.map(p => {
      // Build full path points
      const points = [];
      for (let ri = 0; ri < rankData.length; ri++) {
        const rank = rankData[ri].ranks[p.id];
        if (rank !== undefined) {
          points.push({ x: xForRound(ri), y: yForRank(rank), ri });
        }
      }

      // Build SVG path
      if (points.length < 2) return { id: p.id, path: '', points };

      let d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const cpx = (prev.x + curr.x) / 2;
        d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
      }

      return { id: p.id, path: d, points };
    });
  }, [players, rankData, maxPlayers, totalRounds]);

  const pathLengths = useRef({});

  // How much of the path to show based on progress
  const getPathReveal = (playerId) => {
    const line = playerLines.find(l => l.id === playerId);
    if (!line || line.points.length < 2) return 0;
    const firstRound = line.points[0].ri;
    const lastRound = line.points[line.points.length - 1].ri;
    const range = lastRound - firstRound;
    if (range === 0) return 1;
    return Math.min(1, Math.max(0, (progress - firstRound) / range));
  };

  if (!hasStarted) {
    return (
      <div className="card-gold p-3 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-gold-200 text-sm font-medium">Game Replay</h3>
            <p className="text-navy-200/60 text-xs">{totalRounds} rounds</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleStart}
              className="px-4 py-2 rounded-lg btn-gold text-sm font-medium"
            >
              ▶ Play Replay
            </button>
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
      </div>
    );
  }

  return (
    <div className="card-gold p-3 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-gold-200 text-sm font-medium">Game Replay</h3>
          <p className="text-navy-200/60 text-xs">
            Round {currentRoundNumber} of {totalRounds}
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
        {/* Faint horizontal gridlines */}
        {Array.from({ length: maxPlayers }, (_, i) => (
          <line
            key={i}
            x1={leftPad} x2={leftPad + chartWidth}
            y1={yForRank(i)} y2={yForRank(i)}
            stroke="#8a7a40" strokeOpacity="0.15" strokeWidth="0.5"
          />
        ))}

        {/* Lines — revealed portion using dasharray */}
        {playerLines.map(line => {
          const reveal = getPathReveal(line.id);
          return (
            <path
              key={`fg-${line.id}`}
              d={line.path}
              fill="none"
              stroke={playerColors[line.id]}
              strokeWidth="3"
              strokeLinecap="round"
              ref={el => {
                if (el && !pathLengths.current[line.id]) {
                  pathLengths.current[line.id] = el.getTotalLength();
                }
              }}
              strokeDasharray={pathLengths.current[line.id] || 1000}
              strokeDashoffset={
                (pathLengths.current[line.id] || 1000) * (1 - reveal)
              }
            />
          );
        })}

        {/* Moving dots + labels at current position */}
        {players.map(p => {
          const rank = getRankAt(p.id, progress);
          if (rank < 0) return null;

          const firstAppearance = rankData.findIndex(r => r.ranks[p.id] !== undefined);
          if (firstAppearance < 0 || progress < firstAppearance) return null;

          const x = xForRound(Math.min(progress, totalRounds - 1));
          const y = yForRank(rank);
          const score = getScoreAt(p.id, progress);

          return (
            <g key={p.id}>
              {/* Dot */}
              <circle
                cx={x} cy={y} r="5"
                fill={playerColors[p.id]}
                stroke="#0e1a38" strokeWidth="1.5"
              />
              {/* Name + score label */}
              <text
                x={x + 10} y={y - 4}
                fill={playerColors[p.id]}
                fontSize="10" fontWeight="600"
                dominantBaseline="auto"
              >
                {p.name}
              </text>
              <text
                x={x + 10} y={y + 10}
                fill="#b0b8c8"
                fontSize="9" fontWeight="500"
                dominantBaseline="auto"
              >
                {score}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
