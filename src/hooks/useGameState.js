import { useState, useCallback, useEffect } from 'react';
import { STORAGE_KEY, PHASES } from '../utils/constants';
import { getMaxRounds, getCardsForRound, getDealerIndex } from '../utils/roundCalculations';
import { calculateRoundScores, calculateTotalScores } from '../utils/scoring';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or unavailable
  }
}

export function useGameState() {
  const [gameState, setGameState] = useState(null);
  const [hasSavedGame, setHasSavedGame] = useState(false);

  useEffect(() => {
    const saved = loadState();
    if (saved && saved.players && saved.players.length >= 2) {
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
    localStorage.removeItem(STORAGE_KEY);
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

  const setTrumpSuit = useCallback((suit) => {
    updateRound((round) => {
      round.trumpSuit = suit;
    });
  }, [updateRound]);

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

  const nextRound = useCallback(() => {
    setGameState(prev => {
      const next = { ...prev };
      const newRoundIndex = prev.currentRound + 1;
      const maxRounds = prev.maxRounds;
      const cardsDealt = getCardsForRound(newRoundIndex, maxRounds);
      const dealerIndex = getDealerIndex(newRoundIndex, prev.settings.firstDealerIndex, prev.players.length);

      next.currentRound = newRoundIndex;
      next.currentPhase = PHASES.PREROUND;
      next.isLastRound = false;
      next.lastRoundTrumpChoice = null;
      next.rounds = [...prev.rounds, {
        roundNumber: newRoundIndex + 1,
        cardsDealt,
        dealerIndex,
        trumpSuit: null,
        bids: {},
        tricks: {},
        scores: {},
      }];
      saveState(next);
      return next;
    });
  }, []);

  const declareLastRound = useCallback((trumpChoice) => {
    setGameState(prev => {
      const next = { ...prev, isLastRound: true, lastRoundTrumpChoice: trumpChoice };
      if (trumpChoice === 'without') {
        next.rounds = [...prev.rounds];
        const round = { ...next.rounds[next.currentRound] };
        round.trumpSuit = 'none';
        next.rounds[next.currentRound] = round;
      }
      saveState(next);
      return next;
    });
  }, []);

  const addPlayerMidGame = useCallback((name, startingPoints = 0) => {
    setGameState(prev => {
      const newPlayer = {
        id: crypto.randomUUID(),
        name,
        addedInRound: prev.currentRound + 2, // will participate from next round
        startingPoints,
      };
      const next = { ...prev };
      next.players = [...prev.players, newPlayer];
      next.maxRounds = getMaxRounds(next.players.length);
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
      round.tricks = {};
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

  const keepPlaying = useCallback(() => {
    setGameState(prev => {
      const next = { ...prev, currentPhase: PHASES.SCORED, isLastRound: false };
      saveState(next);
      return next;
    });
  }, []);

  const newGame = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
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
    declareLastRound,
    addPlayerMidGame,
    editRound,
    goBackToPreround,
    goBackToBidding,
    endGame,
    keepPlaying,
    newGame,
  };
}
