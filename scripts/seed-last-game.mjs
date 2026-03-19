/**
 * One-time script to seed the last game's results into Firebase.
 * Run with: node scripts/seed-last-game.mjs
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, query, where, limit, increment, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBT1yNBK3DyIk9GhiPc-heuBBBbjThlm88",
  authDomain: "wizard-scores-2521c.firebaseapp.com",
  projectId: "wizard-scores-2521c",
  storageBucket: "wizard-scores-2521c.firebasestorage.app",
  messagingSenderId: "37372424805",
  appId: "1:37372424805:web:383851762365e1b6f3cc8c",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Last game results from the screenshot
const lastGameResults = [
  { name: 'Jorge', score: 230, rank: 1, shamePoints: 0 },
  { name: 'Avi', score: 170, rank: 2, shamePoints: 0 },
  { name: 'Manuel', score: 90, rank: 3, shamePoints: 0 },
  { name: 'Victor', score: 80, rank: 4, shamePoints: 0 },
  { name: 'Mona', score: 70, rank: 5, shamePoints: 0 },
  { name: 'Stefan', score: 10, rank: 6, shamePoints: 0 },
];

async function findOrCreatePlayer(name) {
  const nameLower = name.trim().toLowerCase();
  const playersRef = collection(db, 'players');
  const q = query(playersRef, where('nameLower', '==', nameLower), limit(1));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const docSnap = snapshot.docs[0];
    console.log(`  Found existing player: ${name} (${docSnap.id})`);
    return { id: docSnap.id, ...docSnap.data() };
  }

  const newPlayer = {
    name: name.trim(),
    nameLower,
    gamesPlayed: 0,
    wins: 0,
    totalScore: 0,
    bestScore: null,
    worstScore: null,
    totalShamePoints: 0,
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(playersRef, newPlayer);
  console.log(`  Created new player: ${name} (${docRef.id})`);
  return { id: docRef.id, ...newPlayer };
}

async function main() {
  console.log('Seeding last game results...\n');

  // Resolve players
  const resolved = [];
  for (const r of lastGameResults) {
    const player = await findOrCreatePlayer(r.name);
    resolved.push({ ...r, firebaseId: player.id, playerData: player });
  }

  // Save game document
  const gameDoc = {
    date: serverTimestamp(),
    roundCount: 10, // approximate
    playerCount: resolved.length,
    results: resolved.map(p => ({
      playerId: p.firebaseId,
      name: p.name,
      score: p.score,
      rank: p.rank,
      shamePoints: p.shamePoints,
    })),
  };
  const gameRef = await addDoc(collection(db, 'games'), gameDoc);
  console.log(`\nGame saved: ${gameRef.id}`);

  // Update player stats
  const winnerScore = Math.max(...resolved.map(p => p.score));
  for (const p of resolved) {
    const playerRef = doc(db, 'players', p.firebaseId);
    const data = p.playerData;
    const updates = {
      gamesPlayed: increment(1),
      totalScore: increment(p.score),
      totalShamePoints: increment(p.shamePoints),
    };
    if (p.score === winnerScore) {
      updates.wins = increment(1);
    }
    if (data.bestScore === null || data.bestScore === undefined || p.score > (data.bestScore || -Infinity)) {
      updates.bestScore = p.score;
    }
    if (data.worstScore === null || data.worstScore === undefined || p.score < (data.worstScore || Infinity)) {
      updates.worstScore = p.score;
    }
    await updateDoc(playerRef, updates);
    console.log(`  Updated stats for ${p.name}`);
  }

  console.log('\nDone! All results seeded.');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
