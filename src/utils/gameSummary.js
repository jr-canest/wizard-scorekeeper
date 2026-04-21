// Names are wrapped in <b> tags for bold rendering
function b(name) {
  return `<b>${name}</b>`;
}

function joinNames(names) {
  if (names.length === 0) return '';
  if (names.length === 1) return b(names[0]);
  if (names.length === 2) return `${b(names[0])} and ${b(names[1])}`;
  return names.slice(0, -1).map(b).join(', ') + ', and ' + b(names[names.length - 1]);
}

const SENTENCES = {
  dominance: [
    "{1st} waved the wand like the deck was under a spell. {2nd} and {3rd} never stood a chance. {rest}",
    "The Grand Wizard has spoken. {1st} saw the future every single round. {2nd} and {3rd} were playing a different game entirely. {rest}",
    "{1st} played like the deck was enchanted from the start. {2nd} and {3rd}, better luck next prophecy. {rest}",
    "Was that magic or just skill? {1st} left the table spellbound. {2nd} and {3rd} are still figuring out what happened. {rest}",
  ],
  close: [
    "{1st} edges out {2nd} by a whisker on the wizard's beard. {3rd} watches from the crystal ball. That was anyone's game until the last card. {rest}",
    "{1st} and {2nd} duelled wands to the final round. {1st} blinked last. {3rd} stirred the potion bravely. {rest}",
    "A single trick separated {1st} from {2nd}. {3rd} was right there brewing too. The council demands a rematch. {rest}",
    "The crystal ball couldn't have predicted this finish. {1st} barely outcast {2nd}. {3rd} was a spell away from glory. {rest}",
  ],
  comeback: [
    "{1st} rose like a phoenix spell. Down and out, then untouchable. {2nd} and {3rd} watched the magic unfold. {rest}",
    "Never count a wizard out. {1st} wandered the enchanted forest and still found the crown. {2nd} and {3rd} learned that the hard way. {rest}",
    "From bottom of the tower to the top — {1st} pulled off the greatest spell reversal in wizard history. {2nd} and {3rd} are still wide-eyed. {rest}",
    "Somebody check {1st}'s sleeves — that comeback was suspiciously magical. {2nd} and {3rd} demand a wand inspection. {rest}",
  ],
  steady: [
    "{1st} played it cool as a frozen wand, bid it clean, and walked away with the win. {2nd} and {3rd} kept the potions steady. {rest}",
    "No chaos, no wild spells — just quiet mastery from {1st}. {2nd} and {3rd} ran an honest enchantment. {rest}",
    "{1st} read the cards like a seasoned oracle. No drama, just precision. {2nd} and {3rd} kept composure at the table. {rest}",
    "Boring? No. Clinical. {1st} bid with wizard-level precision all game long. {2nd} and {3rd} brewed a clean cauldron too. {rest}",
  ],
  chaotic: [
    "What in Merlin's name just happened? {1st} somehow emerged from the magical mishap. {2nd} and {3rd} made it out in one piece. {rest}",
    "The lead changed hands more times than a wand in a duel. {1st} held on by a spell. {2nd} and {3rd} have stories to tell. {rest}",
    "Absolute fireworks of a game. {1st} bubbled up with the crown. {2nd} and {3rd} are still sorting the sparks. {rest}",
  ],
  meltdown: [
    "Bids went sideways all night. {1st} won, but nobody's popping confetti. {2nd} and {3rd} are nursing bruised pride. {rest}",
    "The spells misfired left and right tonight. {1st} kept the wand steady. {2nd} and {3rd} weren't so lucky. {rest}",
    "Negative points everywhere — this wasn't a card game, it was a potion gone very wrong. {1st} dodged the splash. {2nd} and {3rd} need a hot cocoa. {rest}",
    "Someone forgot to put the lid on the cauldron. {1st} ducked in time. {2nd} and {3rd} took a face full of fizzy potion. {rest}",
  ],
  fallback: [
    "{1st} claims the title of Grand Wizard. {2nd} earns the rank of Apprentice. {rest}",
    "The enchanted cards have spoken. {1st} stands victorious, {2nd} bows gracefully. {rest}",
    "A duel of wits between {1st} and {2nd}. Only one could wear the pointy hat. {rest}",
    "{1st} wins! {2nd} can keep the broomstick as a consolation prize. {rest}",
  ],
  tied_first: [
    "A shared prophecy! {1st} — the Wizard Crown must be split! {2nd} and {3rd} bow to the co-rulers. {rest}",
    "One throne, multiple wizards. {1st} share the crown in an unprecedented tie. {2nd} and {3rd} witnessed history. {rest}",
    "The sorting spell came up even — {1st} finished dead level! {2nd} and {3rd} watched the council scramble for extra crowns. {rest}",
    "Not even the oracle could separate {1st}. A tie at the top! {2nd} and {3rd} saw something truly rare. {rest}",
  ],
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRunningTotals(completedRounds, players) {
  const results = [];
  const running = {};
  for (const p of players) {
    running[p.id] = p.startingPoints || 0;
  }
  for (const round of completedRounds) {
    for (const p of players) {
      if (round.scores && round.scores[p.id] !== undefined) {
        running[p.id] = (running[p.id] || 0) + round.scores[p.id];
      }
    }
    results.push({ roundNumber: round.roundNumber, totals: { ...running } });
  }
  return results;
}

function getLeaderAtRound(roundTotals, players) {
  let maxScore = -Infinity;
  let leaderId = null;
  for (const p of players) {
    const score = roundTotals[p.id] || 0;
    if (score > maxScore) {
      maxScore = score;
      leaderId = p.id;
    }
  }
  return leaderId;
}

function getRankAtRound(roundTotals, players, targetId) {
  const scores = players.map(p => roundTotals[p.id] || 0).sort((a, b) => b - a);
  const targetScore = roundTotals[targetId] || 0;
  return scores.indexOf(targetScore);
}

// Group players by shared rank
function getGroupedRanks(sortedPlayers, totalScores) {
  const groups = []; // array of { rank, players, score }
  let currentRank = -1;
  let currentScore = null;
  for (const p of sortedPlayers) {
    const score = totalScores[p.id] || 0;
    if (score !== currentScore) {
      currentRank = groups.reduce((sum, g) => sum + g.players.length, 0);
      groups.push({ rank: currentRank, players: [p], score });
      currentScore = score;
    } else {
      groups[groups.length - 1].players.push(p);
    }
  }
  return groups;
}

const REST_PHRASES = [
  "{rest} — may the next prophecy be kinder.",
  "{rest} — the cauldron awaits your return.",
  "{rest} — every wizard has an off night.",
  "{rest} — the enchanted forest has room for everyone.",
  "{rest} — better luck in the next realm.",
  "{rest} — the cards weren't feeling generous.",
];

/**
 * Build the payload sent to the Cloud Function that generates the AI summary.
 * Contains just enough context for the model to vary tone.
 */
export function buildAISummaryPayload(sortedPlayers, totalScores, completedRounds, allPlayers, settings = {}) {
  const runningTotals = getRunningTotals(completedRounds, allPlayers);

  // Lead changes
  let leadChanges = 0;
  let prevLeader = null;
  for (const rt of runningTotals) {
    const leader = getLeaderAtRound(rt.totals, allPlayers);
    if (prevLeader !== null && leader !== prevLeader) leadChanges++;
    prevLeader = leader;
  }

  // Biggest lead during game
  let biggestLead = 0;
  for (const rt of runningTotals) {
    const scores = allPlayers.map(p => rt.totals[p.id] || 0).sort((a, b) => b - a);
    const gap = (scores[0] ?? 0) - (scores[1] ?? 0);
    if (gap > biggestLead) biggestLead = gap;
  }

  // Winner's worst rank during the game
  let comebackRank = null;
  if (sortedPlayers.length > 0) {
    const winnerId = sortedPlayers[0].id;
    let worst = 0;
    for (const rt of runningTotals) {
      const rank = getRankAtRound(rt.totals, allPlayers, winnerId);
      if (rank > worst) worst = rank;
    }
    // Only report if winner was behind at some point (rank > 0 meaning not always 1st)
    if (worst > 0) comebackRank = worst + 1; // convert to 1-indexed
  }

  const negativeCount = sortedPlayers.filter(p => (totalScores[p.id] || 0) < 0).length;

  return {
    players: sortedPlayers.map((p, i) => ({
      name: p.name,
      score: totalScores[p.id] || 0,
      rank: i + 1,
      shamePoints: 0, // caller can fill this in
    })),
    roundCount: completedRounds.length,
    canadianRules: !!settings.canadianRules,
    leadChanges,
    biggestLead,
    comebackRank,
    negativeCount,
  };
}

export function getGameSummary(sortedPlayers, totalScores, completedRounds, allPlayers) {
  if (sortedPlayers.length < 2) return '';

  const groups = getGroupedRanks(sortedPlayers, totalScores);
  const firstGroup = groups[0]; // rank 0
  const secondGroup = groups[1]; // rank 1 (may not exist if all tied)
  const thirdGroup = groups.length >= 3 ? groups[2] : null;

  const firstNames = firstGroup.players.map(p => p.name);
  const secondNames = secondGroup ? secondGroup.players.map(p => p.name) : [];
  const thirdNames = thirdGroup ? thirdGroup.players.map(p => p.name) : [];

  // Remaining players (rank 3+, excluding first/second/third groups)
  const topGroupCount = (firstGroup?.players.length || 0) + (secondGroup?.players.length || 0) + (thirdGroup?.players.length || 0);
  const restPlayers = sortedPlayers.slice(topGroupCount);
  const restNames = restPlayers.map(p => p.name);

  const firstScore = firstGroup.score;
  const secondScore = secondGroup ? secondGroup.score : 0;
  const margin = firstScore - secondScore;

  const runningTotals = getRunningTotals(completedRounds, allPlayers);

  // Check for tied first
  const tiedFirst = firstGroup.players.length > 1;

  let category = 'fallback';

  if (tiedFirst) {
    category = 'tied_first';
  } else if (sortedPlayers.length < 3 || !thirdGroup) {
    category = 'fallback';
  } else {
    // 1. Comeback
    const midpoint = Math.floor(runningTotals.length / 2);
    if (midpoint >= 1) {
      const midTotals = runningTotals[midpoint - 1].totals;
      const firstRankAtMid = getRankAtRound(midTotals, allPlayers, firstGroup.players[0].id);
      if (firstRankAtMid >= 2) {
        category = 'comeback';
      }
    }

    // 2. Dominance
    if (category === 'fallback' && firstScore > 0 && margin >= firstScore * 0.3) {
      category = 'dominance';
    }

    // 3. Chaotic
    if (category === 'fallback' && runningTotals.length >= 3) {
      let leadChanges = 0;
      let prevLeader = null;
      for (const rt of runningTotals) {
        const leader = getLeaderAtRound(rt.totals, allPlayers);
        if (prevLeader !== null && leader !== prevLeader) {
          leadChanges++;
        }
        prevLeader = leader;
      }
      if (leadChanges >= 4) {
        category = 'chaotic';
      }
    }

    // 4. Close finish
    if (category === 'fallback' && margin <= 20) {
      category = 'close';
    }

    // 5. Meltdown (multiple players in the negative)
    if (category === 'fallback') {
      const negCount = sortedPlayers.filter(p => (totalScores[p.id] || 0) < 0).length;
      if (negCount >= 2) {
        category = 'meltdown';
      }
    }

    // 6. Steady
    if (category === 'fallback') {
      category = 'steady';
    }
  }

  let sentence = pickRandom(SENTENCES[category]);

  // Build rest phrase
  let restPhrase = '';
  if (restNames.length > 0) {
    restPhrase = pickRandom(REST_PHRASES).replace('{rest}', joinNames(restNames));
  }

  // Substitute placeholders with bold names
  sentence = sentence.replaceAll('{1st}', joinNames(firstNames));
  sentence = sentence.replaceAll('{2nd}', joinNames(secondNames));
  sentence = sentence.replaceAll('{3rd}', joinNames(thirdNames));
  sentence = sentence.replaceAll('{rest}', restPhrase);

  // Clean up any leftover artifacts from missing groups
  sentence = sentence.replace(/\s+\./g, '.').replace(/\s{2,}/g, ' ').trim();

  return sentence;
}
