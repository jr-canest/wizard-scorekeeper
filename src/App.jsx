import { useState } from 'react';
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
    addPlayerMidGame,
    reorderPlayers,
    editRound,
    goBackToPreround,
    goBackToBidding,
    endGame,
    keepPlaying,
    newGame,
  } = useGameState();

  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showLastRound, setShowLastRound] = useState(false);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [showTrumpPicker, setShowTrumpPicker] = useState(false);

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
    return <SetupScreen onStartGame={startGame} />;
  }

  // Game finished — reuse GameScoreboard with game-over actions
  if (gameState.currentPhase === 'finished') {
    return (
      <GameScoreboard
        players={gameState.players}
        rounds={gameState.rounds}
        totalScores={totalScores}
        isGameOver
        onKeepPlaying={keepPlaying}
        onNewGame={newGame}
      />
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
          onDeclareLastRound={() => setShowLastRound(true)}
          onAddPlayer={() => setShowAddPlayer(true)}
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
          onBid={setBid}
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
          onTrick={setTricks}
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
          isLastRound={gameState.isLastRound}
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
          onClose={() => setShowScoreboard(false)}
        />
      )}

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

      {showLastRound && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-navy-800 border border-gold-700/50 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Declare Last Round</h3>
            <p className="text-gray-300 text-sm mb-4">This round will be the final round. Play with or without trump?</p>
            <div className="space-y-2">
              <button
                onClick={() => { declareLastRound('with'); setShowLastRound(false); }}
                className="btn-gold w-full py-3 rounded-lg"
              >
                With Trump
              </button>
              <button
                onClick={() => { declareLastRound('without'); setShowLastRound(false); }}
                className="w-full py-3 rounded-lg bg-navy-600 text-gray-300 font-medium active:bg-navy-500"
              >
                Without Trump
              </button>
              <button
                onClick={() => setShowLastRound(false)}
                className="w-full py-2 text-navy-200/60 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
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
    </div>
  );
}
