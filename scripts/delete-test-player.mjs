/**
 * One-time script to delete the "Test" player from Firebase.
 * Run with: node scripts/delete-test-player.mjs
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc, query, where, limit } from 'firebase/firestore';

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
  const playersRef = collection(db, 'players');
  const q = query(playersRef, where('nameLower', '==', 'test'), limit(1));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    console.log('No "Test" player found.');
    process.exit(0);
  }

  const playerDoc = snapshot.docs[0];
  console.log(`Found: ${playerDoc.data().name} (${playerDoc.id})`);
  console.log('Stats:', JSON.stringify(playerDoc.data(), null, 2));

  await deleteDoc(doc(db, 'players', playerDoc.id));
  console.log('Deleted.');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
