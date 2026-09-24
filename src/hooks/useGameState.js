import { useState, useCallback, useEffect } from 'react';
import { STORAGE_KEY, PHASES } from '../utils/constants';
import { getMaxRounds, getCardsForRound, getDealerIndex } from '../utils/roundCalculations';
import { calculateRoundScores, calculateTotalScores } from '../utils/scoring';
import { isTestMode } from '../utils/testMode';
import { consumeResumeAfterUpdate } from '../utils/appVersion';

// Test mode gets its own slot so playing a throwaway game never
// clobbers a real game in progress on the same device.
function storageKey() {
  return isTestMode() ? `${STORAGE_KEY}-test` : STORAGE_KEY;
}

function loadState() {
  try {
    const raw = localStorage.getItem(storageKey());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(state));
  } catch {
    // storage full or unavailable
  }
}

// A refresh (pull-to-refresh, the reload button, Safari reloading a tab
// it dropped in the background) goes straight back into the game; the
// "Resume your previous game?" prompt is only for a fresh open. The
// sessionStorage flag survives reloads of this tab, the navigation type
// covers the first reload after an update.
const IN_GAME_KEY = 'wizard-scorekeeper-in-game';

function wasInGameThisTab() {
  try {
    return sessionStorage.getItem(IN_GAME_KEY) === '1';
  } catch {
    return false;
  }
}

function markInGameThisTab() {
  try {
    sessionStorage.setItem(IN_GAME_KEY, '1');
  } catch {
    // storage unavailable: the resume prompt still works
  }
}

function isPageReload() {
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    return nav ? nav.type === 'reload' : performance.navigation?.type === 1;
  } catch {
    return false;
  }
}

// A player sits in round N once they've joined and until they're
// removed: removedInRound is the first round they sit out. Removed
// players keep their place in players[] (so every round's dealerIndex
// stays valid) and their frozen total stays in the standings.
export function isSeatedIn(player, roundNumber) {
  return player.addedInRound <= roundNumber &&
    !(player.removedInRound != null && player.removedInRound <= roundNumber);
}

// The deal passes left: the next player after `fromIndex` who sits in
// `roundNumber`.
function nextSeatedIndex(players, fromIndex, roundNumber) {
  for (let step = 1; step <= players.length; step++) {
    const i = (fromIndex + step) % players.length;
    if (isSeatedIn(players[i], roundNumber)) return i;
  }
  return (fromIndex + 1) % players.length;
}

// Choices made on the merged round-results screen for the round that
// hasn't been created yet (dealer override, trump, last-round flag).
// Consumed by buildNextRound when the next round is created.
const EMPTY_NEXT_SETUP = { dealerIndex: null, trumpSuit: null, lastRound: false };

function getNextSetup(state) {
  return { ...EMPTY_NEXT_SETUP, ...(state.nextRoundSetup || {}) };
}

// Who deals the round after the current one: the dealer picked on the
// results screen, else the next seated player after this round's dealer.
// Based on the previous round's dealer, not the formula, so rotation stays
// stable when players are added, removed or reseated mid-game.
export function nextRoundDealerIndex(state) {
  const round = state.rounds[state.currentRound];
  const nextNumber = round.roundNumber + 1;
  const chosen = getNextSetup(state).dealerIndex;
  if (chosen != null && state.players[chosen] && isSeatedIn(state.players[chosen], nextNumber)) {
    return chosen;
  }
  return nextSeatedIndex(state.players, round.dealerIndex, nextNumber);
}

// Appends the next round to `prev` (dealer rotates from the previous
// round's dealer unless overridden; extra rounds stay at max cards) and
// clears the pending setup. Phase is left for the caller to set.
function buildNextRound(prev) {
  const setup = getNextSetup(prev);
  const newRoundIndex = prev.currentRound + 1;
  const cardsDealt = getCardsForRound(newRoundIndex, prev.maxRounds);
  const dealerIndex = nextRoundDealerIndex(prev);

  return {
    ...prev,
    currentRound: newRoundIndex,
    isLastRound: !!setup.lastRound,
    lastRoundTrumpChoice: null,
    nextRoundSetup: null,
    rounds: [...prev.rounds, {
      roundNumber: newRoundIndex + 1,
      cardsDealt,
      dealerIndex,
      trumpSuit: setup.trumpSuit ?? null,
      bids: {},
      tricks: {},
      scores: {},
    }],
  };
}

export function useGameState() {
  const [gameState, setGameState] = useState(null);
  const [hasSavedGame, setHasSavedGame] = useState(false);

  useEffect(() => {
    // One-shot flag set by the update banner before it reloads, or any
    // refresh of a tab that was in the game: skip the resume prompt and
    // drop straight back into the game in progress.
    const resumeNow = consumeResumeAfterUpdate() || wasInGameThisTab() || isPageReload();
    const saved = loadState();
    if (saved && saved.players && saved.players.length >= 2) {
      // Once-on-mount hydrate from localStorage — there's no
      // serializable equivalent we could compute in render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (resumeNow) setGameState(saved); else setHasSavedGame(true);
    }
  }, []);

  useEffect(() => {
    if (gameState) markInGameThisTab();
  }, [gameState]);

  const resumeGame = useCallback(() => {
    const saved = loadState();
    if (saved) {
      setGameState(saved);
      setHasSavedGame(false);
    }
  }, []);

  const dismissSavedGame = useCallback(() => {
    localStorage.removeItem(storageKey());
    setHasSavedGame(false);
  }, []);

  const persist = useCallback((state) => {
    setGameState(state);
    saveState(state);
  }, []);

  const startGame = useCallback((players, settings) => {
    const maxRounds = getMaxRounds(players.length);
    const dealerIndex = getDealerIndex(0, settings.firstDealerIndex, players.length);
    const cardsDealt = getCardsForRound(0, maxRounds);

    const state = {
      players,
      settings,
      currentRound: 0,
      currentPhase: PHASES.PREROUND,
      isLastRound: false,
      lastRoundTrumpChoice: null,
      shamePoints: {},
      rounds: [{
        roundNumber: 1,
        cardsDealt,
        dealerIndex,
        trumpSuit: null,
        bids: {},
        tricks: {},
        scores: {},
      }],
      maxRounds,
    };
    persist(state);
  }, [persist]);

  const updateRound = useCallback((updater) => {
    setGameState(prev => {
      const next = { ...prev };
      next.rounds = [...prev.rounds];
      const currentRoundData = { ...next.rounds[next.currentRound] };
      updater(currentRoundData, next);
      next.rounds[next.currentRound] = currentRoundData;
      saveState(next);
      return next;
    });
  }, []);

  // On the merged results screen (phase SCORED) the next round doesn't
  // exist yet, so its dealer / trump / last-round choices park in
  // nextRoundSetup until Start round creates it (see buildNextRound).

  const setTrumpSuit = useCallback((suit) => {
    setGameState(prev => {
      if (prev.currentPhase === PHASES.SCORED) {
        const next = { ...prev, nextRoundSetup: { ...getNextSetup(prev), trumpSuit: suit } };
        saveState(next);
        return next;
      }
      const next = { ...prev };
      next.rounds = [...prev.rounds];
      next.rounds[next.currentRound] = { ...next.rounds[next.currentRound], trumpSuit: suit };
      saveState(next);
      return next;
    });
  }, []);

  const startRound = useCallback(() => {
    setGameState(prev => {
      const next = { ...prev, currentPhase: PHASES.BIDDING };
      saveState(next);
      return next;
    });
  }, []);

  const setBid = useCallback((playerId, bid) => {
    updateRound((round) => {
      round.bids = { ...round.bids, [playerId]: bid };
    });
  }, [updateRound]);

  const confirmBids = useCallback(() => {
    setGameState(prev => {
      const next = { ...prev, currentPhase: PHASES.TRICKS };
      saveState(next);
      return next;
    });
  }, []);

  const setTricks = useCallback((playerId, tricks) => {
    updateRound((round) => {
      round.tricks = { ...round.tricks, [playerId]: tricks };
    });
  }, [updateRound]);

  const confirmTricks = useCallback(() => {
    setGameState(prev => {
      const next = { ...prev };
      next.rounds = [...prev.rounds];
      const round = { ...next.rounds[next.currentRound] };
      round.scores = calculateRoundScores(round.bids, round.tricks);
      next.rounds[next.currentRound] = round;
      next.currentPhase = PHASES.SCORED;
      saveState(next);
      return next;
    });
  }, []);

  // Create the next round and land on its pre-round screen. Kept for the
  // round-1 style flow; the merged results screen uses startNextRound.
  const nextRound = useCallback(() => {
    setGameState(prev => {
      const next = { ...buildNextRound(prev), currentPhase: PHASES.PREROUND };
      saveState(next);
      return next;
    });
  }, []);

  // Merged results screen: create the next round AND open bidding in one
  // step (what used to be "Next round" then "Start round").
  const startNextRound = useCallback(() => {
    setGameState(prev => {
      const next = { ...buildNextRound(prev), currentPhase: PHASES.BIDDING };
      saveState(next);
      return next;
    });
  }, []);

  // On the merged results screen the toggle means "the NEXT round is the
  // last" — it parks in the setup and becomes isLastRound when that round
  // is created. Elsewhere it flags the round in progress.
  const declareLastRound = useCallback(() => {
    setGameState(prev => {
      const next = prev.currentPhase === PHASES.SCORED
        ? { ...prev, nextRoundSetup: { ...getNextSetup(prev), lastRound: true } }
        : { ...prev, isLastRound: true, lastRoundTrumpChoice: null };
      saveState(next);
      return next;
    });
  }, []);

  const undeclareLastRound = useCallback(() => {
    setGameState(prev => {
      const next = prev.currentPhase === PHASES.SCORED
        ? { ...prev, nextRoundSetup: { ...getNextSetup(prev), lastRound: false } }
        : { ...prev, isLastRound: false, lastRoundTrumpChoice: null };
      saveState(next);
      return next;
    });
  }, []);

  const addPlayerMidGame = useCallback((name, startingPoints = 0) => {
    setGameState(prev => {
      const currentNumber = prev.rounds[prev.currentRound].roundNumber;
      const newPlayer = {
        id: crypto.randomUUID(),
        name,
        // Joins the round being set up: the current one from the pre-round
        // screen, the next one from the merged results screen.
        addedInRound: prev.currentPhase === PHASES.SCORED ? currentNumber + 1 : currentNumber,
        startingPoints,
      };
      const next = { ...prev };
      next.players = [...prev.players, newPlayer];
      next.maxRounds = getMaxRounds(next.players.filter(p => p.removedInRound == null).length);
      saveState(next);
      return next;
    });
  }, []);

  // Someone leaves mid-game: they sit out from the round being set up
  // (the next one from the results screen, the current one from the
  // pre-round screen) and their total freezes; it still shows in the
  // standings and counts in the final results. maxRounds stays put so
  // the game length the table planned on doesn't shift.
  const removePlayer = useCallback((playerId) => {
    setGameState(prev => {
      const idx = prev.players.findIndex(p => p.id === playerId);
      if (idx < 0) return prev;
      const isScored = prev.currentPhase === PHASES.SCORED;
      const round = prev.rounds[prev.currentRound];
      const fromRound = isScored ? round.roundNumber + 1 : round.roundNumber;
      const players = prev.players.map(p => (p.id === playerId ? { ...p, removedInRound: fromRound } : p));
      if (players.filter(p => isSeatedIn(p, fromRound)).length < 2) return prev;

      const next = { ...prev, players };
      if (isScored) {
        // Picked as next dealer → the deal passes to the next seated player.
        const setup = getNextSetup(prev);
        if (setup.dealerIndex === idx) {
          next.nextRoundSetup = { ...setup, dealerIndex: nextSeatedIndex(players, idx, fromRound) };
        }
      } else if (round.dealerIndex === idx) {
        next.rounds = [...prev.rounds];
        next.rounds[prev.currentRound] = { ...round, dealerIndex: nextSeatedIndex(players, idx, fromRound) };
      }
      saveState(next);
      return next;
    });
  }, []);

  // Undo a removal made on this same results screen (before the player
  // has missed a round).
  const restorePlayer = useCallback((playerId) => {
    setGameState(prev => {
      const next = {
        ...prev,
        players: prev.players.map(p => {
          if (p.id !== playerId) return p;
          const restored = { ...p };
          delete restored.removedInRound;
          return restored;
        }),
      };
      saveState(next);
      return next;
    });
  }, []);

  const reorderPlayers = useCallback((fromIndex, toIndex) => {
    setGameState(prev => {
      const next = { ...prev };
      const players = [...prev.players];
      const [moved] = players.splice(fromIndex, 1);
      players.splice(toIndex, 0, moved);
      next.players = players;
      // Update dealerIndex in all rounds to follow the same player
      next.rounds = prev.rounds.map(r => {
        const dealerPlayer = prev.players[r.dealerIndex];
        const newDealerIndex = players.findIndex(p => p.id === dealerPlayer.id);
        return { ...r, dealerIndex: newDealerIndex >= 0 ? newDealerIndex : r.dealerIndex };
      });
      const setup = getNextSetup(prev);
      if (setup.dealerIndex != null && prev.players[setup.dealerIndex]) {
        const id = prev.players[setup.dealerIndex].id;
        const idx = players.findIndex(p => p.id === id);
        next.nextRoundSetup = { ...setup, dealerIndex: idx >= 0 ? idx : null };
      }
      saveState(next);
      return next;
    });
  }, []);

  const setDealer = useCallback((playerIndex) => {
    setGameState(prev => {
      if (prev.currentPhase === PHASES.SCORED) {
        const next = { ...prev, nextRoundSetup: { ...getNextSetup(prev), dealerIndex: playerIndex } };
        saveState(next);
        return next;
      }
      const next = { ...prev };
      next.rounds = [...prev.rounds];
      const round = { ...next.rounds[next.currentRound] };
      round.dealerIndex = playerIndex;
      next.rounds[next.currentRound] = round;
      saveState(next);
      return next;
    });
  }, []);

  const addShamePoint = useCallback((playerId) => {
    setGameState(prev => {
      const next = { ...prev };
      next.shamePoints = { ...prev.shamePoints, [playerId]: (prev.shamePoints?.[playerId] || 0) + 1 };
      saveState(next);
      return next;
    });
  }, []);

  const editRound = useCallback((roundIndex) => {
    setGameState(prev => {
      const next = { ...prev };
      next.currentRound = roundIndex;
      next.currentPhase = PHASES.TRICKS;
      next.rounds = [...prev.rounds];
      const round = { ...next.rounds[roundIndex] };
      // Keep existing tricks so user can adjust individual values
      round.scores = {};
      next.rounds[roundIndex] = round;
      saveState(next);
      return next;
    });
  }, []);

  const goBackToPreround = useCallback(() => {
    setGameState(prev => {
      const next = { ...prev, currentPhase: PHASES.PREROUND };
      next.rounds = [...prev.rounds];
      const round = { ...next.rounds[next.currentRound] };
      round.bids = {};
      round.tricks = {};
      round.scores = {};
      next.rounds[next.currentRound] = round;
      saveState(next);
      return next;
    });
  }, []);

  const goBackToBidding = useCallback(() => {
    setGameState(prev => {
      const next = { ...prev, currentPhase: PHASES.BIDDING };
      next.rounds = [...prev.rounds];
      const round = { ...next.rounds[next.currentRound] };
      round.tricks = {};
      round.scores = {};
      next.rounds[next.currentRound] = round;
      saveState(next);
      return next;
    });
  }, []);

  const endGame = useCallback(() => {
    setGameState(prev => {
      const next = { ...prev, currentPhase: 'finished' };
      saveState(next);
      return next;
    });
  }, []);

  // Remember which Firestore game doc this game was saved to, so ending
  // the same game a second time (Keep Playing / edit round, then End
  // Game again) replaces that doc instead of adding a duplicate.
  const recordSavedGame = useCallback((gameId) => {
    setGameState(prev => {
      if (!prev) return prev;
      const next = { ...prev, savedGameId: gameId || null };
      saveState(next);
      return next;
    });
  }, []);

  const keepPlaying = useCallback(() => {
    setGameState(prev => {
      const next = { ...prev, currentPhase: PHASES.SCORED, isLastRound: false };
      saveState(next);
      return next;
    });
  }, []);

  const newGame = useCallback(() => {
    localStorage.removeItem(storageKey());
    setGameState(null);
    setHasSavedGame(false);
  }, []);

  const totalScores = gameState ? calculateTotalScores(gameState.rounds, gameState.players) : {};

  return {
    gameState,
    hasSavedGame,
    totalScores,
    resumeGame,
    dismissSavedGame,
    startGame,
    startRound,
    setTrumpSuit,
    setBid,
    confirmBids,
    setTricks,
    confirmTricks,
    nextRound,
    startNextRound,
    declareLastRound,
    undeclareLastRound,
    addPlayerMidGame,
    removePlayer,
    restorePlayer,
    reorderPlayers,
    setDealer,
    addShamePoint,
    editRound,
    goBackToPreround,
    goBackToBidding,
    endGame,
    keepPlaying,
    newGame,
    recordSavedGame,
  };
}
