import { useState, useEffect, useMemo } from 'react';
import { useGameState } from './hooks/useGameState';
import { useUIScale } from './hooks/useUIScale';
import { PHASES } from './utils/constants';
import SetupScreen from './components/SetupScreen';
import PreRoundScreen from './components/PreRoundScreen';
import TrumpSelection from './components/TrumpSelection';
import BiddingPhase from './components/BiddingPhase';
import TricksPhase from './components/TricksPhase';
import RoundScoreboard from './components/RoundScoreboard';
import GameScoreboard from './components/GameScoreboard';
import AddPlayerModal from './components/AddPlayerModal';
import ConfirmDialog from './components/ConfirmDialog';
import HistoryScreen from './components/HistoryScreen';
import { getDemoScenario, getCurrentDemoName } from './utils/demoScenarios';

function WizardLogo({ className = "h-8" }) {
  return <img src={`${import.meta.env.BASE_URL}wizard-logo.svg`} alt="Wizard" className={className} />;
}

export default function App() {
  useUIScale();
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

  // Wake lock — keep screen awake while app is open.
  // iOS PWAs aggressively release the lock, so we re-acquire on:
  //   - tab/app becoming visible
  //   - window regaining focus
  //   - the lock firing its own 'release' event (when visible)
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;

    let wakeLock = null;
    let cancelled = false;

    async function acquire() {
      if (cancelled || wakeLock) return;
      if (document.visibilityState !== 'visible') return;
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          wakeLock = null;
          // If the app is still visible when the system releases the lock
          // (iOS does this after a while), grab it again.
          if (document.visibilityState === 'visible' && !cancelled) {
            acquire();
          }
        });
      } catch {
        /* ignore — page not visible, or unsupported */
      }
    }

    acquire();

    const reacquire = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    document.addEventListener('visibilitychange', reacquire);
    window.addEventListener('focus', reacquire);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', reacquire);
      window.removeEventListener('focus', reacquire);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
        wakeLock = null;
      }
    };
  }, []);

  // ?demo=<name> — jump straight into a mock game-over screen, no real game
  // state touched and no Firestore writes (isProduction() check still guards
  // saveGameResult). The AI summary is allowed to run so you can preview it.
  // Memoized so every App re-render doesn't build a fresh object (which would
  // bust all the downstream memoization in GameScoreboard/BarChartRace).
  const demoName = getCurrentDemoName();
  const demoData = useMemo(
    () => (demoName ? getDemoScenario(demoName) : null),
    [demoName]
  );
  if (demoData) {
    const clearDemo = () => {
      window.history.replaceState({}, '', window.location.pathname);
      window.location.reload();
    };
    return (
      <>
        <div className="fixed top-0 inset-x-0 z-[100] bg-gold-400/90 text-black text-xs font-bold py-1 text-center pointer-events-none">
          DEMO: {demoName} — history not affected
        </div>
        <GameScoreboard
          players={demoData.players}
          rounds={demoData.rounds}
          totalScores={demoData.totalScores}
          shamePoints={demoData.shamePoints}
          settings={demoData.settings}
          isGameOver
          onKeepPlaying={clearDemo}
          onNewGame={clearDemo}
          onShowHistory={() => setShowHistory(true)}
        />
        {showHistory && <HistoryScreen onClose={() => setShowHistory(false)} />}
      </>
    );
  }

  // Resume game prompt
  if (!gameState && hasSavedGame) {
    return (
      <div className="min-h-svh flex items-center justify-center p-4">
        <div className="card-gold p-6 max-w-sm w-full text-center">
          <WizardLogo className="h-10 mx-auto mb-4" />
          <h2 className="font-display font-semibold text-[26px] leading-none text-cream-bright mb-2.5">Game in progress</h2>
          <p className="text-navy-200 mb-6">Resume your previous game?</p>
          <div className="flex gap-2.5">
            <button onClick={dismissSavedGame} className="btn-secondary flex-1 h-12 text-[15px]">
              New game
            </button>
            <button onClick={resumeGame} className="btn-gold flex-1 h-12 text-base">
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
    <div className="px-3.5 pb-4 max-w-md mx-auto">
      {/* Shared header bar: ghost action · ◆ logo ◆ · Scores */}
      <div className="flex items-center justify-between h-[50px] -mx-3.5 px-3.5 border-b border-gold-300/[.28]"
        style={{ background: 'linear-gradient(180deg,rgba(212,168,67,.07),transparent)' }}
      >
        <button
          onClick={() => setShowNewGameConfirm(true)}
          className="text-navy-200 text-[13px] font-medium active:text-cream"
        >
          New game
        </button>
        <div className="flex items-center gap-2">
          <span className="diamond" />
          <WizardLogo className="h-[15px]" />
          <span className="diamond" />
        </div>
        <button onClick={() => setShowScoreboard(true)} className="btn-header">
          Scores
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

      {/* During bidding/tricks the metadata row's trump segment is
          tappable so trump can be set or changed once a Wizard/Jester
          is flipped mid-round. */}
      {gameState.currentPhase === PHASES.BIDDING && (
        <BiddingPhase
          players={activePlayers}
          dealerId={dealer.id}
          cardsDealt={round.cardsDealt}
          canadianRules={gameState.settings.canadianRules}
          roundNumber={round.roundNumber}
          bids={round.bids}
          shamePoints={gameState.shamePoints}
          trumpSuit={round.trumpSuit}
          dealerName={dealer.name}
          onSelectTrump={() => setShowTrumpPicker(true)}
          isLastRound={gameState.isLastRound}
          onDeclareLastRound={declareLastRound}
          onUndeclareLastRound={undeclareLastRound}
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
          roundNumber={round.roundNumber}
          bids={round.bids}
          tricks={round.tricks}
          shamePoints={gameState.shamePoints}
          trumpSuit={round.trumpSuit}
          dealerName={dealer.name}
          onSelectTrump={() => setShowTrumpPicker(true)}
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
          onEndGame={gameState.isLastRound ? endGame : () => setShowEndGameConfirm(true)}
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
          <div className="card-gold bg-[#0d1426] p-5 max-w-sm w-full pop-in">
            <h3 className="font-display font-semibold text-[22px] leading-none text-cream-bright mb-3.5">Change dealer</h3>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {activePlayers.map((p) => {
                const playerIndex = gameState.players.indexOf(p);
                return (
                  <button
                    key={p.id}
                    onClick={() => { setDealer(playerIndex); setShowDealerPicker(false); }}
                    className={`w-full text-left py-2.5 px-3 rounded-lg font-display font-semibold text-[17px] ${
                      p.id === dealer.id ? 'bg-gold-300/15 text-gold-text' : 'text-cream-bright active:bg-navy-600'
                    }`}
                  >
                    {p.name} {p.id === dealer.id ? '♛' : ''}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowDealerPicker(false)}
              className="btn-secondary w-full mt-3 h-10 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
