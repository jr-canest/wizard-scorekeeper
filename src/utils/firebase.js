import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  runTransaction,
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
 * Follow `mergedInto` to land on a player's canonical doc. Returns the
 * resolved {id, ...data}. Shallow chain in practice (1 hop), but
 * guards against accidental multi-hops up to 5 deep. Returns the input
 * unchanged if not merged or if a hop's doc is missing.
 */
async function resolveCanonicalPlayerDoc(player) {
  let current = player;
  for (let hop = 0; hop < 5; hop++) {
    if (!current?.mergedInto || current.mergedInto === current.id) return current;
    const snap = await getDoc(doc(db, 'players', current.mergedInto));
    if (!snap.exists()) return current;
    current = { id: snap.id, ...snap.data() };
  }
  return current;
}

/**
 * Find or create a player by name (case-insensitive). Matches against
 * `nameLower` first, then `aliases` (case-insensitive — multiplayer-
 * sourced merges store display case like "Stefan" while older
 * scorekeeper data may store lowercase; both work). Always returns
 * the canonical doc when one chain of `mergedInto` points elsewhere.
 */
export async function findOrCreatePlayer(name) {
  const nameLower = name.trim().toLowerCase();
  const playersRef = collection(db, 'players');

  const byName = await getDocs(query(playersRef, where('nameLower', '==', nameLower), limit(1)));
  if (!byName.empty) {
    const d = byName.docs[0];
    const found = { id: d.id, ...d.data() };
    return await resolveCanonicalPlayerDoc(found);
  }

  // Case-insensitive aliases lookup. The array-contains path needed
  // both old (lowercase-stored) and new (display-case from merges)
  // values, so we fetch all and filter client-side. Fine at this scale
  // (~tens of players).
  const all = await getDocs(playersRef);
  for (const d of all.docs) {
    const data = d.data();
    const aliases = Array.isArray(data.aliases) ? data.aliases : [];
    if (aliases.some((a) => typeof a === 'string' && a.toLowerCase() === nameLower)) {
      const found = { id: d.id, ...data };
      return await resolveCanonicalPlayerDoc(found);
    }
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
    aliases: [],
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(playersRef, newPlayer);
  return { id: docRef.id, ...newPlayer };
}

/**
 * Search players by name- or alias-prefix (for autocomplete). Fetches
 * all players and filters client-side so we can match aliases (which
 * may be stored in either display case from a merge or lowercase from
 * older data) — fine at this scale (~tens of players). Merged player
 * docs are hidden so autocomplete only suggests the canonical name.
 */
export async function searchPlayers(prefix, maxResults = 10) {
  if (!prefix || prefix.trim().length === 0) return [];
  const lower = prefix.trim().toLowerCase();

  const snapshot = await getDocs(collection(db, 'players'));
  const matches = [];
  for (const d of snapshot.docs) {
    const p = { id: d.id, ...d.data() };
    if (p.mergedInto) continue;
    const nameHit = typeof p.nameLower === 'string' && p.nameLower.startsWith(lower);
    const aliasHit = Array.isArray(p.aliases) && p.aliases.some(a => typeof a === 'string' && a.toLowerCase().startsWith(lower));
    if (nameHit || aliasHit) matches.push({ ...p, _nameHit: nameHit });
  }
  matches.sort((a, b) => {
    if (a._nameHit !== b._nameHit) return a._nameHit ? -1 : 1;
    return (b.gamesPlayed || 0) - (a.gamesPlayed || 0);
  });
  // Strip the internal _nameHit sort helper before returning.
  // eslint-disable-next-line no-unused-vars
  return matches.slice(0, maxResults).map(({ _nameHit, ...p }) => p);
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
 * Returns { gameId, resolvedPlayers } — gameId is null on localhost.
 */
export async function saveGameResult(playerResults, roundCount) {
  // Only save on the live site, not during local development
  if (!isProduction()) {
    console.log('[Firebase] Skipping save — local development');
    return {
      gameId: null,
      resolvedPlayers: playerResults.map(pr => ({ ...pr, firebaseId: null })),
    };
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
  const gameRef = await addDoc(collection(db, 'games'), gameDoc);

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

  return { gameId: gameRef.id, resolvedPlayers };
}

/**
 * Update the AI-generated summary on a game document.
 * Silently no-ops on localhost or with a null gameId.
 */
export async function updateGameSummary(gameId, summary) {
  if (!isProduction() || !gameId || !summary) return;
  try {
    await updateDoc(doc(db, 'games', gameId), { summary });
  } catch (err) {
    console.warn('[Firebase] Failed to save summary:', err);
  }
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

// ─── Aliases ───────────────────────────────────────────

/**
 * Fold the alias player's aggregate stats into the canonical player
 * and mark the alias doc with `mergedInto: canonicalId`. Past `games`
 * docs keep their recorded name — the History view aggregates by
 * player doc, so collapsing the alias doc is enough to dedupe.
 */
export async function mergePlayerInto(canonicalId, aliasId) {
  if (canonicalId === aliasId) {
    throw new Error('mergePlayerInto: same doc');
  }
  const canonRef = doc(db, 'players', canonicalId);
  const aliasRef = doc(db, 'players', aliasId);

  await runTransaction(db, async (tx) => {
    const [canonSnap, aliasSnap] = await Promise.all([
      tx.get(canonRef),
      tx.get(aliasRef),
    ]);
    if (!canonSnap.exists() || !aliasSnap.exists()) {
      throw new Error('mergePlayerInto: not found');
    }
    const c = canonSnap.data();
    const a = aliasSnap.data();
    if (c.mergedInto) throw new Error('mergePlayerInto: canonical is merged');
    if (a.mergedInto) throw new Error('mergePlayerInto: alias already merged');

    const sumGp = (c.gamesPlayed || 0) + (a.gamesPlayed || 0);
    const sumWins = (c.wins || 0) + (a.wins || 0);
    const sumScore = (c.totalScore || 0) + (a.totalScore || 0);
    const sumShame =
      (c.totalShamePoints || 0) + (a.totalShamePoints || 0);
    const mergedBest =
      a.bestScore == null
        ? c.bestScore ?? null
        : c.bestScore == null
          ? a.bestScore
          : Math.max(c.bestScore, a.bestScore);
    const mergedWorst =
      a.worstScore == null
        ? c.worstScore ?? null
        : c.worstScore == null
          ? a.worstScore
          : Math.min(c.worstScore, a.worstScore);
    const aliasName = a.name || '';
    const nextAliases = Array.from(
      new Set([...(c.aliases || []), ...(a.aliases || []), aliasName]),
    ).filter(Boolean);

    tx.update(canonRef, {
      gamesPlayed: sumGp,
      wins: sumWins,
      totalScore: sumScore,
      totalShamePoints: sumShame,
      bestScore: mergedBest,
      worstScore: mergedWorst,
      aliases: nextAliases,
    });
    tx.update(aliasRef, {
      mergedInto: canonicalId,
      gamesPlayed: 0,
      wins: 0,
      totalScore: 0,
      totalShamePoints: 0,
      bestScore: null,
      worstScore: null,
    });
  });
}

// ─── Game deletion ─────────────────────────────────────

async function resolveCanonicalPlayerId(playerId) {
  let currentId = playerId;
  for (let hop = 0; hop < 5; hop++) {
    const snap = await getDoc(doc(db, 'players', currentId));
    if (!snap.exists()) return currentId;
    const data = snap.data();
    if (!data.mergedInto || data.mergedInto === currentId) return currentId;
    currentId = data.mergedInto;
  }
  return currentId;
}

async function findBestWorstForNames(names) {
  if (names.length === 0) return { best: null, worst: null };
  const nameSet = new Set(names);
  const snap = await getDocs(
    query(collection(db, 'games'), orderBy('date', 'desc'), limit(500)),
  );
  let best = null;
  let worst = null;
  for (const d of snap.docs) {
    const data = d.data();
    for (const r of data.results || []) {
      if (!nameSet.has(r.name)) continue;
      if (best === null || r.score > best) best = r.score;
      if (worst === null || r.score < worst) worst = r.score;
    }
  }
  return { best, worst };
}

/**
 * Delete a finished game and roll back the aggregate stats it
 * contributed: gamesPlayed, wins (if winner), totalScore, plus
 * bestScore / worstScore IF the deleted game's score was that
 * player's current best or worst (in which case those fields are
 * recomputed by scanning all remaining games for the player's name +
 * aliases). Player stat updates follow `mergedInto`.
 */
export async function deleteHistoryGame(gameId) {
  const gameRef = doc(db, 'games', gameId);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) return;
  const data = gameSnap.data();
  const results = data.results || [];
  const winnerScore =
    results.length > 0
      ? Math.max(...results.map((r) => r.score))
      : -Infinity;

  const resolved = await Promise.all(
    results.map(async (r) => {
      if (!r.playerId) return null;
      const canonicalId = await resolveCanonicalPlayerId(r.playerId);
      const pSnap = await getDoc(doc(db, 'players', canonicalId));
      if (!pSnap.exists()) return null;
      const pdata = pSnap.data();
      const namesForRecompute = [pdata.name || '', ...(pdata.aliases || [])]
        .filter((n) => typeof n === 'string' && n.length > 0);
      return {
        result: r,
        canonicalId,
        namesForRecompute,
        currentBest: pdata.bestScore,
        currentWorst: pdata.worstScore,
      };
    }),
  );

  await deleteDoc(gameRef);

  await Promise.all(
    resolved.map(async (r) => {
      if (!r) return;
      const updates = {
        gamesPlayed: increment(-1),
        totalScore: increment(-r.result.score),
        totalShamePoints: increment(-(r.result.shamePoints || 0)),
      };
      if (r.result.score === winnerScore) {
        updates.wins = increment(-1);
      }
      const wasBest =
        r.currentBest != null && r.result.score === r.currentBest;
      const wasWorst =
        r.currentWorst != null && r.result.score === r.currentWorst;
      if (wasBest || wasWorst) {
        const { best, worst } = await findBestWorstForNames(
          r.namesForRecompute,
        );
        if (wasBest) updates.bestScore = best;
        if (wasWorst) updates.worstScore = worst;
      }
      await updateDoc(doc(db, 'players', r.canonicalId), updates);
    }),
  );
}

/**
 * Reduce a finished game's log into per-round per-player bid/won/Δ
 * data, sorted by round. Only multiplayer-sourced games have a log —
 * for scorekeeper games this returns []. Used by the game-detail
 * modal in the History view.
 */
export function roundBreakdownFromLog(log) {
  if (!Array.isArray(log)) return [];
  const byRound = new Map();
  function ensure(round) {
    let r = byRound.get(round);
    if (!r) {
      r = { round, bids: {}, tricks: {}, deltas: {} };
      byRound.set(round, r);
    }
    return r;
  }
  for (const entry of log) {
    if (entry.t === 'bid') {
      ensure(entry.round).bids[entry.player] = entry.bid;
    } else if (entry.t === 'trickWin') {
      const r = ensure(entry.round);
      r.tricks[entry.winner] = (r.tricks[entry.winner] || 0) + 1;
    } else if (entry.t === 'roundScore') {
      ensure(entry.round).deltas = entry.scores;
    }
  }
  return Array.from(byRound.values()).sort((a, b) => a.round - b.round);
}
