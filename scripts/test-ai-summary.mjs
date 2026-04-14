// Test the generateGameSummary Cloud Function with synthetic scenarios.
// Run with: node scripts/test-ai-summary.mjs
//
// Does NOT write to Firestore or affect game history — it only calls the
// callable function directly and prints the model's response.

const FUNCTION_URL = 'https://us-central1-wizard-scores-2521c.cloudfunctions.net/generateGameSummary';

const SCENARIOS = [
  {
    label: 'Dominance (blowout)',
    data: {
      players: [
        { name: 'Jorge',  score: 320, rank: 1, shamePoints: 0 },
        { name: 'Avi',    score: 140, rank: 2, shamePoints: 1 },
        { name: 'Mona',   score: 110, rank: 3, shamePoints: 0 },
        { name: 'Stefan', score: 80,  rank: 4, shamePoints: 2 },
      ],
      roundCount: 10,
      canadianRules: false,
      leadChanges: 0,
      biggestLead: 180,
      comebackRank: null,
      negativeCount: 0,
    },
  },
  {
    label: 'Nail-biter (10pt margin)',
    data: {
      players: [
        { name: 'Avi',    score: 180, rank: 1, shamePoints: 0 },
        { name: 'Jorge',  score: 170, rank: 2, shamePoints: 0 },
        { name: 'Mona',   score: 160, rank: 3, shamePoints: 1 },
      ],
      roundCount: 10,
      canadianRules: true,
      leadChanges: 5,
      biggestLead: 40,
      comebackRank: null,
      negativeCount: 0,
    },
  },
  {
    label: 'Comeback (winner was 4th at lowest)',
    data: {
      players: [
        { name: 'Mona',   score: 210, rank: 1, shamePoints: 0 },
        { name: 'Jorge',  score: 190, rank: 2, shamePoints: 0 },
        { name: 'Avi',    score: 170, rank: 3, shamePoints: 0 },
        { name: 'Stefan', score: 120, rank: 4, shamePoints: 1 },
      ],
      roundCount: 10,
      canadianRules: false,
      leadChanges: 6,
      biggestLead: 60,
      comebackRank: 4,
      negativeCount: 0,
    },
  },
  {
    label: 'Bloodbath (everyone negative but winner)',
    data: {
      players: [
        { name: 'Jorge',  score: 40,   rank: 1, shamePoints: 1 },
        { name: 'Avi',    score: -30,  rank: 2, shamePoints: 2 },
        { name: 'Mona',   score: -80,  rank: 3, shamePoints: 0 },
        { name: 'Stefan', score: -120, rank: 4, shamePoints: 3 },
      ],
      roundCount: 10,
      canadianRules: false,
      leadChanges: 3,
      biggestLead: 100,
      comebackRank: null,
      negativeCount: 3,
    },
  },
  {
    label: 'Tied first',
    data: {
      players: [
        { name: 'Jorge',  score: 200, rank: 1, shamePoints: 0 },
        { name: 'Avi',    score: 200, rank: 1, shamePoints: 0 },
        { name: 'Mona',   score: 150, rank: 3, shamePoints: 2 },
      ],
      roundCount: 8,
      canadianRules: true,
      leadChanges: 7,
      biggestLead: 40,
      comebackRank: null,
      negativeCount: 0,
    },
  },
];

async function callFunction(data) {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const json = await res.json();
  // Callable response shape: { result: { summary: "..." } }
  return json.result?.summary ?? JSON.stringify(json);
}

(async () => {
  for (const scenario of SCENARIOS) {
    console.log('\n─────────────────────────────────────────');
    console.log(scenario.label);
    console.log('─────────────────────────────────────────');
    try {
      const start = Date.now();
      const summary = await callFunction(scenario.data);
      const ms = Date.now() - start;
      console.log(summary);
      console.log(`(${ms}ms)`);
    } catch (err) {
      console.error('ERROR:', err.message);
    }
  }
})();
