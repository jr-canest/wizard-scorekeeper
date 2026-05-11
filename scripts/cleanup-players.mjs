/**
 * Cleanup script: delete test players, merge duplicate identities.
 *
 *   DELETE  Test, Test2
 *   MERGE   Mona       -> monesbones
 *   MERGE   Neto       -> Manuel, renamed to "Manuel / Neto"
 *
 * Dry run by default. Pass --commit to actually write.
 *   node scripts/cleanup-players.mjs            # dry run
 *   node scripts/cleanup-players.mjs --commit   # apply
 */
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  query,
  where,
  limit,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBT1yNBK3DyIk9GhiPc-heuBBBbjThlm88",
  authDomain: "wizard-scores-2521c.firebaseapp.com",
  projectId: "wizard-scores-2521c",
  storageBucket: "wizard-scores-2521c.firebasestorage.app",
  messagingSenderId: "37372424805",
  appId: "1:37372424805:web:383851762365e1b6f3cc8c",
};

const COMMIT = process.argv.includes('--commit');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function log(...args) { console.log(...args); }
function header(t) { log(`\n=== ${t} ===`); }

async function findPlayerByNameLower(nameLower) {
  const snap = await getDocs(
    query(collection(db, 'players'), where('nameLower', '==', nameLower), limit(1))
  );
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function deletePlayer(player) {
  log(`  delete player ${player.name} (${player.id})`);
  if (COMMIT) await deleteDoc(doc(db, 'players', player.id));
}

/**
 * Replace `fromPlayer`'s playerId/name in every game.results entry with `toPlayer`'s identity.
 * If `newDisplayName` is given, also rewrite the name shown in results.
 */
async function rewriteGamesForMerge(fromPlayer, toPlayer, newDisplayName) {
  const gamesSnap = await getDocs(collection(db, 'games'));
  let changed = 0;
  for (const gameDoc of gamesSnap.docs) {
    const game = gameDoc.data();
    const results = game.results || [];
    let touched = false;
    const next = results.map(r => {
      if (r.playerId === fromPlayer.id) {
        touched = true;
        return { ...r, playerId: toPlayer.id, name: newDisplayName || toPlayer.name };
      }
      if (r.playerId === toPlayer.id && newDisplayName && r.name !== newDisplayName) {
        touched = true;
        return { ...r, name: newDisplayName };
      }
      return r;
    });
    if (touched) {
      changed++;
      log(`  rewrite game ${gameDoc.id} (${next.map(r => `${r.name}:${r.score}`).join(', ')})`);
      if (COMMIT) await updateDoc(doc(db, 'games', gameDoc.id), { results: next });
    }
  }
  log(`  rewrote ${changed} game(s)`);
}

async function mergePlayers({ fromName, toName, newDisplayName }) {
  header(`MERGE ${fromName} -> ${toName}${newDisplayName ? ` (rename to "${newDisplayName}")` : ''}`);

  const from = await findPlayerByNameLower(fromName.toLowerCase());
  const to = await findPlayerByNameLower(toName.toLowerCase());
  if (!from) { log(`  ! source "${fromName}" not found, skipping`); return; }
  if (!to) { log(`  ! target "${toName}" not found, skipping`); return; }

  await rewriteGamesForMerge(from, to, newDisplayName);

  // Build merged alias list: existing target aliases + source's old name + source's old aliases,
  // minus any that equal the new canonical name.
  const finalName = newDisplayName || to.name;
  const finalNameLower = finalName.toLowerCase();
  const aliasSet = new Set([
    ...(Array.isArray(to.aliases) ? to.aliases : []),
    ...(Array.isArray(from.aliases) ? from.aliases : []),
    from.nameLower,
  ]);
  aliasSet.delete(finalNameLower);
  const aliases = [...aliasSet];

  const merged = {
    name: finalName,
    nameLower: finalNameLower,
    aliases,
    gamesPlayed: (to.gamesPlayed || 0) + (from.gamesPlayed || 0),
    wins: (to.wins || 0) + (from.wins || 0),
    totalScore: (to.totalScore || 0) + (from.totalScore || 0),
    totalShamePoints: (to.totalShamePoints || 0) + (from.totalShamePoints || 0),
    bestScore: maxNullable(to.bestScore, from.bestScore),
    worstScore: minNullable(to.worstScore, from.worstScore),
  };
  log(`  merged stats: games=${merged.gamesPlayed} wins=${merged.wins} total=${merged.totalScore} best=${merged.bestScore} worst=${merged.worstScore} shame=${merged.totalShamePoints} name="${merged.name}" aliases=[${aliases.join(', ')}]`);
  if (COMMIT) await updateDoc(doc(db, 'players', to.id), merged);

  await deletePlayer(from);
}

function maxNullable(a, b) {
  if (a == null) return b ?? null;
  if (b == null) return a;
  return Math.max(a, b);
}
function minNullable(a, b) {
  if (a == null) return b ?? null;
  if (b == null) return a;
  return Math.min(a, b);
}

async function deleteTestPlayer(name) {
  header(`DELETE ${name}`);
  const p = await findPlayerByNameLower(name.toLowerCase());
  if (!p) { log(`  ! "${name}" not found, skipping`); return; }

  // Scrub from games results (shouldn't exist but be safe)
  const gamesSnap = await getDocs(collection(db, 'games'));
  for (const gameDoc of gamesSnap.docs) {
    const game = gameDoc.data();
    const results = game.results || [];
    const filtered = results.filter(r => r.playerId !== p.id);
    if (filtered.length !== results.length) {
      log(`  scrub game ${gameDoc.id} (removed ${results.length - filtered.length} entry)`);
      if (COMMIT) {
        if (filtered.length === 0) {
          await deleteDoc(doc(db, 'games', gameDoc.id));
        } else {
          await updateDoc(doc(db, 'games', gameDoc.id), { results: filtered });
        }
      }
    }
  }
  await deletePlayer(p);
}

async function main() {
  log(COMMIT ? '*** COMMIT MODE — writes will happen ***' : '*** DRY RUN — no writes. Pass --commit to apply. ***');

  await deleteTestPlayer('Test');
  await deleteTestPlayer('Test2');
  await mergePlayers({ fromName: 'Mona', toName: 'monesbones' });
  await mergePlayers({ fromName: 'Neto', toName: 'Manuel', newDisplayName: 'Manuel / Neto' });

  log('\nDone.');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
