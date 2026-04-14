import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

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
const functions = getFunctions(app, 'us-central1');

// ─── Cloud Functions ───────────────────────────────────

const generateGameSummaryFn = httpsCallable(functions, 'generateGameSummary');

/**
 * Call the Cloud Function to generate an AI game summary.
 * Returns the summary string (with <b>name</b> tags), or null on error.
 */
export async function fetchAISummary(payload) {
  try {
    const result = await generateGameSummaryFn(payload);
    const summary = result?.data?.summary;
    return typeof summary === 'string' && summary.length > 0 ? summary : null;
  } catch (err) {
    console.warn('[Firebase] AI summary failed:', err);
    return null;
  }
}

/** Returns true if running on the live GitHub Pages site */
export function isProduction() {
  return window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
}

// ─── Players ───────────────────────────────────────────

/**
 * Find or create a player by name (case-insensitive).
 * Returns { id, name, nameLower, gamesPlayed, wins, totalScore, totalShamePoints }
 */
export async function findOrCreatePlayer(name) {
  const nameLower = name.trim().toLowerCase();
  const playersRef = collection(db, 'players');
  const q = query(playersRef, where('nameLower', '==', nameLower), limit(1));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() };
  }

  // Create new player
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
  return { id: docRef.id, ...newPlayer };
}

/**
 * Search players by name prefix (for autocomplete).
 * Returns array of { id, name, gamesPlayed, wins, ... }
 */
export async function searchPlayers(prefix, maxResults = 10) {
  if (!prefix || prefix.trim().length === 0) return [];
  const lower = prefix.trim().toLowerCase();
  const upperBound = lower.slice(0, -1) + String.fromCharCode(lower.charCodeAt(lower.length - 1) + 1);

  const playersRef = collection(db, 'players');
  const q = query(
    playersRef,
    where('nameLower', '>=', lower),
    where('nameLower', '<', upperBound),
    orderBy('nameLower'),
    limit(maxResults)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Get all players sorted by total score (for all-time leaderboard).
 */
export async function getAllPlayers() {
  const playersRef = collection(db, 'players');
  const q = query(playersRef, orderBy('totalScore', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Games ─────────────────────────────────────────────

/**
 * Save a completed game and update player stats.
 * playerResults: [{ name, score, rank, shamePoints }]
 */
export async function saveGameResult(playerResults, roundCount) {
  // Only save on the live site, not during local development
  if (!isProduction()) {
    console.log('[Firebase] Skipping save — local development');
    return playerResults.map(pr => ({ ...pr, firebaseId: null }));
  }

  // 1. Resolve all players (find or create)
  const resolvedPlayers = await Promise.all(
    playerResults.map(async (pr) => {
      const player = await findOrCreatePlayer(pr.name);
      return { ...pr, firebaseId: player.id };
    })
  );

  const winnerScore = Math.max(...resolvedPlayers.map(p => p.score));
  const winners = resolvedPlayers.filter(p => p.score === winnerScore);

  // 2. Save game document
  const gameDoc = {
    date: serverTimestamp(),
    roundCount,
    playerCount: resolvedPlayers.length,
    results: resolvedPlayers.map(p => ({
      playerId: p.firebaseId,
      name: p.name,
      score: p.score,
      rank: p.rank,
      shamePoints: p.shamePoints || 0,
    })),
  };
  await addDoc(collection(db, 'games'), gameDoc);

  // 3. Update each player's stats
  await Promise.all(
    resolvedPlayers.map(async (p) => {
      const playerRef = doc(db, 'players', p.firebaseId);
      const playerSnap = await getDoc(playerRef);
      const data = playerSnap.data() || {};

      const updates = {
        gamesPlayed: increment(1),
        totalScore: increment(p.score),
        totalShamePoints: increment(p.shamePoints || 0),
      };

      // Track wins
      if (winners.some(w => w.firebaseId === p.firebaseId)) {
        updates.wins = increment(1);
      }

      // Track best/worst scores
      if (data.bestScore === null || data.bestScore === undefined || p.score > data.bestScore) {
        updates.bestScore = p.score;
      }
      if (data.worstScore === null || data.worstScore === undefined || p.score < data.worstScore) {
        updates.worstScore = p.score;
      }

      await updateDoc(playerRef, updates);
    })
  );

  return resolvedPlayers;
}

/**
 * Get recent games (for history view).
 */
export async function getRecentGames(maxResults = 20) {
  const gamesRef = collection(db, 'games');
  const q = query(gamesRef, orderBy('date', 'desc'), limit(maxResults));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Get games for a specific player.
 */
export async function getPlayerGames(playerFirebaseId, maxResults = 20) {
  // Firestore doesn't support array-contains on nested fields easily,
  // so we query all recent games and filter client-side
  const games = await getRecentGames(50);
  return games
    .filter(g => g.results.some(r => r.playerId === playerFirebaseId))
    .slice(0, maxResults);
}
