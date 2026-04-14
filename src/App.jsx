import { useState, useEffect } from 'react';
import { useGameState } from './hooks/useGameState';
import { PHASES } from './utils/constants';
import SetupScreen from './components/SetupScreen';
import RoundHeader from './components/RoundHeader';
import PreRoundScreen from './components/PreRoundScreen';
import TrumpSelection from './components/TrumpSelection';
import BiddingPhase from './components/BiddingPhase';
import TricksPhase from './components/TricksPhase';
import RoundScoreboard from './components/RoundScoreboard';
import GameScoreboard from './components/GameScoreboard';
import AddPlayerModal from './components/AddPlayerModal';
import ConfirmDialog from './components/ConfirmDialog';
import HistoryScreen from './components/HistoryScreen';

function WizardLogo({ className = "h-8" }) {
  return <img src={`${import.meta.env.BASE_URL}wizard-logo.svg`} alt="Wizard" className={className} />;
}

export default function App() {
  const {
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
  } = useGameState();

  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);
  const [showTrumpPicker, setShowTrumpPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDealerPicker, setShowDealerPicker] = useState(false);

  // Wake lock — keep screen awake while app is open
  useEffect(() => {
    let wakeLock = null;
    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch { /* ignore */ }
    }
    requestWakeLock();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLock) wakeLock.release();
    };
  }, []);

  // Resume game prompt
  if (!gameState && hasSavedGame) {
    return (
      <div className="min-h-svh flex items-center justify-center p-4">
        <div className="card-gold p-6 max-w-sm w-full text-center">
          <WizardLogo className="h-10 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Game in Progress</h2>
          <p className="text-navy-200 mb-6">Resume your previous game?</p>
          <div className="flex gap-3">
            <button
              onClick={dismissSavedGame}
              className="flex-1 py-3 rounded-lg bg-navy-600 text-gray-300 font-medium active:bg-navy-500"
            >
              New Game
            </button>
            <button
              onClick={resumeGame}
              className="btn-gold flex-1 py-3 rounded-lg"
            >
              Resume
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Setup screen
  if (!gameState) {
    return (
      <>
        <SetupScreen onStartGame={startGame} onShowHistory={() => setShowHistory(true)} />
        {showHistory && <HistoryScreen onClose={() => setShowHistory(false)} />}
      </>
    );
  }

  // Game finished — reuse GameScoreboard with game-over actions
  if (gameState.currentPhase === 'finished') {
    return (
      <>
        <GameScoreboard
          players={gameState.players}
          rounds={gameState.rounds}
          totalScores={totalScores}
          shamePoints={gameState.shamePoints}
          settings={gameState.settings}
          isGameOver
          onKeepPlaying={keepPlaying}
          onNewGame={newGame}
          onShowHistory={() => setShowHistory(true)}
        />
        {showHistory && <HistoryScreen onClose={() => setShowHistory(false)} />}
      </>
    );
  }

  // Active game
  const round = gameState.rounds[gameState.currentRound];
  const dealer = gameState.players[round.dealerIndex];
  const isInExtraRounds = gameState.currentRound >= gameState.maxRounds;

  // Active players for this round
  const activePlayers = gameState.players.filter(p => p.addedInRound <= round.roundNumber);

  return (
    <div className="p-4 max-w-md mx-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setShowNewGameConfirm(true)}
          className="text-navy-200/60 text-sm active:text-gray-300"
        >
          New Game
        </button>
        <WizardLogo className="h-7" />
        <button
          onClick={() => setShowScoreboard(true)}
          className="text-gold-200 text-sm font-medium px-3 py-1.5 rounded-lg border border-gold-700/50 bg-navy-800/40 active:bg-navy-700/60"
        >
          Scoreboard
        </button>
      </div>

      {/* Pre-round screen */}
      {gameState.currentPhase === PHASES.PREROUND && (
        <PreRoundScreen
          roundNumber={round.roundNumber}
          cardsDealt={round.cardsDealt}
          maxRounds={gameState.maxRounds}
          isExtraRound={isInExtraRounds}
          players={activePlayers}
          dealerId={dealer.id}
          totalScores={totalScores}
          trumpSuit={round.trumpSuit}
          isLastRound={gameState.isLastRound}
          lastRoundTrumpChoice={gameState.lastRoundTrumpChoice}
          onStartRound={startRound}
          onSelectTrump={() => setShowTrumpPicker(true)}
          allPlayers={gameState.players}
          onReorderPlayers={reorderPlayers}
          onDeclareLastRound={declareLastRound}
          onUndeclareLastRound={undeclareLastRound}
          onAddPlayer={() => setShowAddPlayer(true)}
          onEndGame={() => setShowEndGameConfirm(true)}
          onChangeDealer={() => setShowDealerPicker(true)}
        />
      )}

      {/* Bidding, Tricks, Scored phases get a compact round header */}
      {gameState.currentPhase !== PHASES.PREROUND && (
        <RoundHeader
          roundNumber={round.roundNumber}
          cardsDealt={round.cardsDealt}
          dealerName={dealer.name}
          trumpSuit={round.trumpSuit}
        />
      )}

      {gameState.currentPhase === PHASES.BIDDING && (
        <BiddingPhase
          players={activePlayers}
          dealerId={dealer.id}
          cardsDealt={round.cardsDealt}
          canadianRules={gameState.settings.canadianRules}
          roundNumber={round.roundNumber}
          bids={round.bids}
          shamePoints={gameState.shamePoints}
          onBid={setBid}
          onShame={addShamePoint}
          onConfirm={confirmBids}
          onBack={goBackToPreround}
        />
      )}

      {gameState.currentPhase === PHASES.TRICKS && (
        <TricksPhase
          players={activePlayers}
          dealerId={dealer.id}
          cardsDealt={round.cardsDealt}
          bids={round.bids}
          tricks={round.tricks}
          shamePoints={gameState.shamePoints}
          onTrick={setTricks}
          onShame={addShamePoint}
          onConfirm={confirmTricks}
          onBack={goBackToBidding}
        />
      )}

      {gameState.currentPhase === PHASES.SCORED && (
        <RoundScoreboard
          players={activePlayers}
          round={round}
          allRounds={gameState.rounds}
          totalScores={totalScores}
          shamePoints={gameState.shamePoints}
          isLastRound={gameState.isLastRound}
          dealerName={dealer.name}
          onNextRound={nextRound}
          onEndGame={endGame}
          onEditRound={() => editRound(gameState.currentRound)}
        />
      )}

      {/* Modals */}
      {showScoreboard && (
        <GameScoreboard
          players={gameState.players}
          rounds={gameState.rounds}
          totalScores={totalScores}
          shamePoints={gameState.shamePoints}
          onClose={() => setShowScoreboard(false)}
          onShowHistory={() => setShowHistory(true)}
        />
      )}

      {showHistory && <HistoryScreen onClose={() => setShowHistory(false)} />}

      {showAddPlayer && (
        <AddPlayerModal
          onAdd={(name, points) => {
            addPlayerMidGame(name, points);
            setShowAddPlayer(false);
          }}
          onCancel={() => setShowAddPlayer(false)}
        />
      )}

      {showTrumpPicker && (
        <TrumpSelection
          dealerName={dealer.name}
          onSelect={(suit) => {
            setTrumpSuit(suit);
            setShowTrumpPicker(false);
          }}
        />
      )}

      {showEndGameConfirm && (
        <ConfirmDialog
          title="End Game?"
          message="This will end the current game and show final scores. Are you sure?"
          confirmLabel="End Game"
          onConfirm={() => { endGame(); setShowEndGameConfirm(false); }}
          onCancel={() => setShowEndGameConfirm(false)}
        />
      )}

      {showNewGameConfirm && (
        <ConfirmDialog
          title="New Game?"
          message="This will end the current game. Are you sure?"
          confirmLabel="New Game"
          onConfirm={() => { newGame(); setShowNewGameConfirm(false); }}
          onCancel={() => setShowNewGameConfirm(false)}
        />
      )}

      {showDealerPicker && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-navy-800 border border-gold-700/50 rounded-xl p-5 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-white mb-3">Change Dealer</h3>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {activePlayers.map((p) => {
                const playerIndex = gameState.players.indexOf(p);
                return (
                  <button
                    key={p.id}
                    onClick={() => { setDealer(playerIndex); setShowDealerPicker(false); }}
                    className={`w-full text-left py-2.5 px-3 rounded-lg ${
                      p.id === dealer.id ? 'bg-gold-300/20 text-gold-200' : 'text-white active:bg-navy-600'
                    }`}
                  >
                    {p.name} {p.id === dealer.id ? '♛' : ''}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowDealerPicker(false)}
              className="w-full mt-3 py-2 text-navy-200/60 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
