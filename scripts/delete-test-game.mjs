/**
 * One-time script to delete the test game (2 rounds) and fix player stats.
 * Run with: node scripts/delete-test-game.mjs
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc, updateDoc, increment, getDoc, query, orderBy } from 'firebase/firestore';

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

async function main() {
  // Find the test game with 2 rounds
  const gamesRef = collection(db, 'games');
  const snapshot = await getDocs(query(gamesRef, orderBy('date', 'desc')));

  const testGames = snapshot.docs.filter(d => {
    const data = d.data();
    return data.roundCount === 2;
  });

  if (testGames.length === 0) {
    console.log('No test game with 2 rounds found.');
    process.exit(0);
  }

  for (const gameDoc of testGames) {
    const game = gameDoc.data();
    console.log(`Found test game: ${gameDoc.id} (${game.roundCount} rounds, ${game.playerCount} players)`);
    console.log('Players:', game.results.map(r => `${r.name}: ${r.score}`).join(', '));

    // Reverse player stats
    const winnerScore = Math.max(...game.results.map(r => r.score));
    for (const r of game.results) {
      const playerRef = doc(db, 'players', r.playerId);
      const playerSnap = await getDoc(playerRef);
      if (!playerSnap.exists()) continue;

      const updates = {
        gamesPlayed: increment(-1),
        totalScore: increment(-r.score),
        totalShamePoints: increment(-(r.shamePoints || 0)),
      };
      if (r.score === winnerScore) {
        updates.wins = increment(-1);
      }
      await updateDoc(playerRef, updates);
      console.log(`  Reversed stats for ${r.name}`);
    }

    // Delete the game document
    await deleteDoc(doc(db, 'games', gameDoc.id));
    console.log(`  Deleted game ${gameDoc.id}`);
  }

  console.log('\nDone!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
