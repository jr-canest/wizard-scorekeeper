// Mock game-over scenarios for preview/testing. Not persisted anywhere —
// reached via ?demo=<name> URL param. Does NOT write to Firebase.
//
// Each scenario returns the full set of props GameScoreboard expects:
//   { players, rounds, totalScores, shamePoints, settings }

const PLAYER_NAMES = ['Jorge', 'Avi', 'Mona', 'Stefan', 'Manuel', 'Kate'];

function buildPlayers(count) {
  return PLAYER_NAMES.slice(0, count).map((name, i) => ({
    id: `demo-p${i + 1}`,
    name,
    addedInRound: 1,
    startingPoints: 0,
  }));
}

// Build fake rounds that sum to the per-player finalScores array.
// Spreads each player's total across `roundCount` rounds with a believable
// mix of wins, losses, and a couple of big swings. If a midpointRank is
// supplied, the winner is in that position at the midpoint.
function buildRounds(players, roundCount, finalScores, opts = {}) {
  const { winnerStartsBehind = false } = opts;
  const rounds = [];

  // Generate a "rate" per player for each half of the game. Winner (index 0)
  // may have a slower first half if winnerStartsBehind is true.
  const midRound = Math.floor(roundCount / 2);
  const players_n = players.length;

  // Allocate per-round deltas so they sum to the finals
  const deltas = players.map((p, pi) => {
    const total = finalScores[pi];
    const arr = new Array(roundCount).fill(0);

    if (winnerStartsBehind && pi === 0) {
      // Put 30% of total in first half, 70% in second
      const firstHalf = Math.round(total * 0.25);
      const secondHalf = total - firstHalf;
      distributeInto(arr, 0, midRound, firstHalf);
      distributeInto(arr, midRound, roundCount, secondHalf);
    } else {
      // Even distribution with some variance
      distributeInto(arr, 0, roundCount, total);
    }
    return arr;
  });

  for (let ri = 0; ri < roundCount; ri++) {
    const cardsDealt = Math.min(ri + 1, Math.floor(60 / players_n));
    const scores = {};
    players.forEach((p, pi) => {
      scores[p.id] = deltas[pi][ri];
    });
    rounds.push({
      roundNumber: ri + 1,
      cardsDealt,
      dealerIndex: ri % players_n,
      trumpSuit: ['spades', 'hearts', 'diamonds', 'clubs', null][ri % 5],
      bids: {}, // not used by chart or summary
      tricks: {},
      scores,
    });
  }
  return rounds;
}

// Split `total` across arr[from..to] with plausible per-round values
// (each delta is a multiple of 10, mixing ±10/20/30 with some exact bids at 20+10k).
function distributeInto(arr, from, to, total) {
  const len = to - from;
  if (len === 0) return;

  // Start with roughly-even allocation in multiples of 10
  const baseEach = Math.round(total / len / 10) * 10;
  for (let i = from; i < to; i++) arr[i] = baseEach;
  let diff = total - baseEach * len;

  // Spread the remainder across rounds in +10 chunks
  let i = from;
  while (diff !== 0) {
    const step = diff > 0 ? 10 : -10;
    arr[i] += step;
    diff -= step;
    i++;
    if (i >= to) i = from;
  }

  // Add some variance — swap ±20 between adjacent rounds a few times
  for (let k = 0; k < Math.min(4, len - 1); k++) {
    const a = from + Math.floor((k * 1.7) % len);
    const b = from + Math.floor((k * 1.7 + 1) % len);
    if (a !== b && a < to && b < to) {
      arr[a] -= 20;
      arr[b] += 20;
    }
  }
}

// Build rounds from an explicit 2D array of per-round deltas: deltas[roundIndex][playerIndex].
function buildRoundsFromDeltas(players, deltas) {
  const rounds = [];
  for (let ri = 0; ri < deltas.length; ri++) {
    const cardsDealt = Math.min(ri + 1, Math.floor(60 / players.length));
    const scores = {};
    players.forEach((p, pi) => {
      scores[p.id] = deltas[ri][pi];
    });
    rounds.push({
      roundNumber: ri + 1,
      cardsDealt,
      dealerIndex: ri % players.length,
      trumpSuit: ['spades', 'hearts', 'diamonds', 'clubs', null][ri % 5],
      bids: {},
      tricks: {},
      scores,
    });
  }
  return rounds;
}

function totalsFrom(players, rounds) {
  const totals = {};
  players.forEach((p) => { totals[p.id] = p.startingPoints || 0; });
  rounds.forEach((r) => {
    players.forEach((p) => {
      if (r.scores[p.id] !== undefined) totals[p.id] += r.scores[p.id];
    });
  });
  return totals;
}

// ─── Scenarios ────────────────────────────────────────────────────────

export const SCENARIOS = {
  dominance: () => {
    const players = buildPlayers(4);
    const rounds = buildRounds(players, 10, [320, 140, 110, 80]);
    return {
      players,
      rounds,
      totalScores: totalsFrom(players, rounds),
      shamePoints: { [players[1].id]: 1, [players[3].id]: 2 },
      settings: { canadianRules: false },
    };
  },
  close: () => {
    const players = buildPlayers(3);
    const rounds = buildRounds(players, 10, [180, 170, 160]);
    return {
      players,
      rounds,
      totalScores: totalsFrom(players, rounds),
      shamePoints: { [players[2].id]: 1 },
      settings: { canadianRules: true },
    };
  },
  comeback: () => {
    const players = buildPlayers(4);
    const rounds = buildRounds(players, 10, [210, 190, 170, 120], { winnerStartsBehind: true });
    return {
      players,
      rounds,
      totalScores: totalsFrom(players, rounds),
      shamePoints: { [players[3].id]: 1 },
      settings: { canadianRules: false },
    };
  },
  meltdown: () => {
    const players = buildPlayers(4);
    const rounds = buildRounds(players, 10, [40, -30, -80, -120]);
    return {
      players,
      rounds,
      totalScores: totalsFrom(players, rounds),
      shamePoints: { [players[0].id]: 1, [players[1].id]: 2, [players[3].id]: 3 },
      settings: { canadianRules: false },
    };
  },
  tied: () => {
    const players = buildPlayers(3);
    const rounds = buildRounds(players, 8, [200, 200, 150]);
    return {
      players,
      rounds,
      totalScores: totalsFrom(players, rounds),
      shamePoints: { [players[2].id]: 2 },
      settings: { canadianRules: true },
    };
  },
  noshame: () => {
    const players = buildPlayers(3);
    const rounds = buildRounds(players, 8, [200, 150, 100]);
    return {
      players,
      rounds,
      totalScores: totalsFrom(players, rounds),
      shamePoints: {},
      settings: { canadianRules: false },
    };
  },
  // Many lead changes and rank swaps, great for showing label animation
  chaotic: () => {
    const players = buildPlayers(4);
    // Deltas chosen so ranks swap almost every round (totals: 190, 160, 150, 120)
    const deltas = [
      [ 40, -10, -20,  20], //  40, -10, -20,  20  → Jorge, Stefan, Avi, Mona
      [-30,  50,  40, -10], //  10,  40,  20,  10  → Avi, Mona, Jorge/Stefan tied
      [ 30, -20,  30,  20], //  40,  20,  50,  30  → Mona, Jorge, Stefan, Avi
      [ 20,  40, -30,  30], //  60,  60,  20,  60  → 3-way tie
      [-10,  30,  40, -20], //  50,  90,  60,  40  → Avi, Stefan, Jorge, Mona
      [ 60, -30,  30,  50], // 110,  60,  90,  90  → Jorge, Mona/Stefan tied, Avi
      [ 30,  50,  10, -20], // 140, 110, 100,  70  → Jorge, Avi, Mona, Stefan
      [-10,  40,  30,  40], // 130, 150, 130, 110  → Avi, Jorge/Mona tied, Stefan
      [ 20, -20,  40,  20], // 150, 130, 170, 130  → Mona, Jorge, Avi/Stefan tied
      [ 40,  30, -20, -10], // 190, 160, 150, 120  → Jorge, Avi, Mona, Stefan
    ];
    const rounds = buildRoundsFromDeltas(players, deltas);
    return {
      players,
      rounds,
      totalScores: totalsFrom(players, rounds),
      shamePoints: { [players[1].id]: 1, [players[3].id]: 2 },
      settings: { canadianRules: true },
    };
  },
  big: () => {
    const players = buildPlayers(6);
    const rounds = buildRounds(players, 10, [280, 240, 200, 150, 90, 20]);
    return {
      players,
      rounds,
      totalScores: totalsFrom(players, rounds),
      shamePoints: { [players[1].id]: 1, [players[4].id]: 1, [players[5].id]: 3 },
      settings: { canadianRules: true },
    };
  },
};

export function getDemoScenario(name) {
  const factory = SCENARIOS[name];
  return factory ? factory() : null;
}

export function getDemoNames() {
  return Object.keys(SCENARIOS);
}

export function isDemoMode() {
  if (typeof window === 'undefined') return false;
  const p = new URLSearchParams(window.location.search);
  return p.has('demo') && !!getDemoScenario(p.get('demo'));
}

export function getCurrentDemoName() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('demo');
}
