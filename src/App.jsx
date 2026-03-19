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
    editRound,
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
        <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full text-center">
          <h2 className="text-xl font-bold text-white mb-2">Game in Progress</h2>
          <p className="text-gray-400 mb-6">Resume your previous game?</p>
          <div className="flex gap-3">
            <button
              onClick={dismissSavedGame}
              className="flex-1 py-3 rounded-lg bg-gray-700 text-gray-300 font-medium active:bg-gray-600"
            >
              New Game
            </button>
            <button
              onClick={resumeGame}
              className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-medium active:bg-blue-500"
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
          className="text-gray-400 text-sm active:text-white"
        >
          New Game
        </button>
        <h1 className="text-lg font-bold text-white">Wizard</h1>
        <button
          onClick={() => setShowScoreboard(true)}
          className="bg-blue-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg active:bg-blue-500"
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
          onBack={goBackToBidding}
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Declare Last Round</h3>
            <p className="text-gray-300 text-sm mb-4">This round will be the final round. Play with or without trump?</p>
            <div className="space-y-2">
              <button
                onClick={() => { declareLastRound('with'); setShowLastRound(false); }}
                className="w-full py-3 rounded-lg bg-blue-600 text-white font-medium"
              >
                With Trump
              </button>
              <button
                onClick={() => { declareLastRound('without'); setShowLastRound(false); }}
                className="w-full py-3 rounded-lg bg-gray-700 text-gray-300 font-medium"
              >
                Without Trump
              </button>
              <button
                onClick={() => setShowLastRound(false)}
                className="w-full py-2 text-gray-500 text-sm"
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
