export function calculateScore(bid, tricks) {
  if (bid === tricks) {
    return 20 + 10 * tricks;
  }
  return -10 * Math.abs(bid - tricks);
}

export function calculateRoundScores(bids, tricks) {
  const scores = {};
  for (const playerId of Object.keys(bids)) {
    if (playerId in tricks) {
      scores[playerId] = calculateScore(bids[playerId], tricks[playerId]);
    }
  }
  return scores;
}

export function calculateTotalScores(rounds, players) {
  const totals = {};
  for (const player of players) {
    totals[player.id] = 0;
  }
  for (const round of rounds) {
    if (round.scores) {
      for (const [playerId, score] of Object.entries(round.scores)) {
        if (playerId in totals) {
          totals[playerId] += score;
        }
      }
    }
  }
  return totals;
}
