import { useState, useCallback, useEffect } from 'react';
import { STORAGE_KEY, PHASES } from '../utils/constants';
import { getMaxRounds, getCardsForRound, getDealerIndex } from '../utils/roundCalculations';
import { calculateRoundScores, calculateTotalScores } from '../utils/scoring';
import { isTestMode } from '../utils/testMode';

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

// Choices made on the merged round-results screen for the round that
// hasn't been created yet (dealer override, trump, last-round flag).
// Consumed by buildNextRound when the next round is created.
const EMPTY_NEXT_SETUP = { dealerIndex: null, trumpSuit: null, lastRound: false };

function getNextSetup(state) {
  return { ...EMPTY_NEXT_SETUP, ...(state.nextRoundSetup || {}) };
}

// Appends the next round to `prev` (dealer rotates from the previous
// round's dealer unless overridden; extra rounds stay at max cards) and
// clears the pending setup. Phase is left for the caller to set.
function buildNextRound(prev) {
  const setup = getNextSetup(prev);
  const newRoundIndex = prev.currentRound + 1;
  const cardsDealt = getCardsForRound(newRoundIndex, prev.maxRounds);
  // Base next dealer on previous round's dealer + 1, not the formula —
  // this keeps rotation stable when players are added mid-game.
  const prevDealerIndex = prev.rounds[prev.currentRound].dealerIndex;
  const dealerIndex =
    setup.dealerIndex != null && setup.dealerIndex < prev.players.length
      ? setup.dealerIndex
      : (prevDealerIndex + 1) % prev.players.length;

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
    const saved = loadState();
    if (saved && saved.players && saved.players.length >= 2) {
      // Once-on-mount hydrate from localStorage — there's no
      // serializable equivalent we could compute in render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasSavedGame(true);
    }
  }, []);

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
      next.maxRounds = getMaxRounds(next.players.length);
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
