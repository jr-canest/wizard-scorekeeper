# Wizard Score Keeper

## Overview

**Wizard card game score keeper** web app deployed on Firebase Hosting. Local game state in `localStorage`, player history + game records in **Firebase Firestore**.

- **Repo:** https://github.com/jr-canest/wizard-scorekeeper
- **Live:** https://wizard-scorekeeper.web.app (Firebase Hosting, target `scorekeeper` under project `wizard-scores-2521c`). Old GH Pages URL `jr-canest.github.io/wizard-scorekeeper/` is no longer canonical.
- **Run locally:** `cd wizard-scorekeeper && npm install && npm run dev`
- **Deploy:** push to `main` = CI deploy (GitHub Actions: lint + build + `hosting:scorekeeper`; Cloud Functions NOT included — deploy those manually). Phone/cloud Claude sessions ship by pushing. Manual fallback from a Mac: `npm run build && firebase deploy --only hosting:scorekeeper --project wizard-scores-2521c`. **Always `git pull` before working locally** — changes may land from cloud sessions.
- **CI secret:** `FIREBASE_SERVICE_ACCOUNT_WIZARD` (service account `github-deploy@wizard-scores-2521c`, also used by the wizard-multiplayer repo)
- **Firebase console:** https://console.firebase.google.com (project: wizard-scores-2521c)

---

## Tech Stack

- React 19 + Vite 8
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- localStorage for current game persistence
- **Firebase Firestore** for cross-device player history + game records
  - Project: `wizard-scores-2521c` (nam5 / us-central)
  - Saves only in production (skips on localhost)
  - Collections: `players` (case-insensitive name matching via `nameLower`), `games` (results per game)
- **Firebase Cloud Functions** (Blaze plan) for AI-generated game summaries
  - `generateGameSummary` — us-central1, Node 20, callable
  - Calls Anthropic Claude Sonnet 5 via `@anthropic-ai/sdk`
  - API key stored as secret: `ANTHROPIC_API_KEY` (Google Secret Manager)
  - Deploy: `firebase deploy --only functions`
  - Updates: `firebase functions:secrets:set ANTHROPIC_API_KEY`
- Firebase Hosting (multi-site under `wizard-scores-2521c`; this app's site ID = `wizard-scorekeeper`)

### Project Structure

```
wizard-scorekeeper/
├── index.html
├── package.json
├── vite.config.js          # base: '/wizard-scorekeeper/', port 5180
├── firebase.json           # Cloud Functions deploy config
├── .firebaserc             # Firebase project pinning (wizard-scores-2521c)
├── functions/              # Cloud Functions source
│   ├── index.js            # generateGameSummary (Claude Haiku 4.5)
│   └── package.json        # Node 20, @anthropic-ai/sdk, firebase-functions
├── public/favicon.svg
│   └── wizard-logo.svg      # Gold gradient "WIZARD" wordmark logo
└── src/
    ├── main.jsx
    ├── index.css            # Tailwind import + custom gold/navy theme + utility classes
    ├── App.jsx              # Main app with all screen routing
    ├── components/
    │   ├── SetupScreen.jsx      # Player names, drag reorder, dealer, Canadian rules, autocomplete
    │   ├── PreRoundScreen.jsx   # Pre-round: player list, scores, Start/Trump/LastRound
    │   ├── RoundHeader.jsx      # Compact header during bidding/tricks/scored
    │   ├── TrumpSelection.jsx   # Modal: suit picker with Wizard/Jester reminder
    │   ├── BiddingPhase.jsx     # All players visible, all bid buttons, live summary, shame button
    │   ├── TricksPhase.jsx      # All players visible, Won: X/Y format, shame points, validation
    │   ├── RoundScoreboard.jsx  # Round results + all-rounds history table
    │   ├── GameScoreboard.jsx   # Full-screen: standings + round-by-round table
    │   ├── HistoryScreen.jsx     # All-time stats + past games (Firebase)
    │   ├── AddPlayerModal.jsx   # Mid-game player addition with warning
    │   ├── ConfirmDialog.jsx    # Reusable confirmation modal
    │   ├── BooToast.jsx         # Full-screen "BOOOO, NAME!" confirmation when a shame point is given
    │   └── BarChartRace.jsx     # SVG score-line replay on game over (auto-plays, ref-smoothed label swaps)
    ├── hooks/
    │   └── useGameState.js      # All game state + localStorage persistence
    └── utils/
        ├── scoring.js           # Exact bid: 20+10*tricks, Miss: -10*|diff|
        ├── roundCalculations.js # Max rounds, cards per round, bid constraints
        ├── gameSummary.js       # Dynamic game-over summary with category detection
        ├── firebase.js          # Firebase config, Firestore CRUD (players, games)
        ├── sounds.js            # Web Audio API sounds (boo, sparkle)
        ├── booPhrases.js        # Randomized "BOO NAME BOO!" phrases for shame toast
        ├── demoScenarios.js     # Mock game-over data for ?demo=<name> preview mode
        └── constants.js         # Suits, phases, limits (2-12 players, 60 cards)
```

---

## Game Rules (as implemented)

### Deck & Players
- 60-card deck (52 + 4 Wizards + 4 Jesters)
- **2–12 players** supported
- Max cards per round = `floor(60 / numPlayers)`

### Round Flow
1. **Pre-round** — Shows player list with scores, dealer badge. Buttons: Start Round, Select Trump (optional), Declare Last Round, Add Player, End Game
2. **Bidding** — All players shown with all bid buttons visible. Bid summary (even/over/underbid) shown as soon as first bid entered
3. **Tricks** — All players shown with all trick buttons. Shows X/Y (won/bid) colored green (exact) or red (miss). Auto-fills 0 for remaining players when all tricks accounted for. Score Round disabled until all tricks entered and total = cards dealt
4. **Scored** — Round results table + all-rounds history with running totals and winner highlights

### Cards Per Round
- Rounds 1 through maxRounds: cards = round number (1, 2, 3, ...)
- Beyond maxRounds: cards stay at maxRounds (extra rounds at max cards)
- Game never auto-ends — only ends via "Declare Last Round" or "End Game" button

### Scoring
- **Exact bid:** `20 + (10 × tricks_won)`
- **Missed bid:** `−10 × |bid − tricks_won|`

### Canadian Rules (optional toggle)
- Dealer (last bidder) cannot bid a number making total bids = cards dealt
- Exception: round 1 is always unrestricted

### Trump Selection
- Optional — only used when a Wizard or Jester is flipped
- Button on pre-round screen shows current selection (e.g. "Trump: ♥ Hearts"), tappable to edit
- Modal shows reminder: "Wizard — [Dealer] chooses" / "Jester — No trump"
- 4 suit buttons + No Trump + N/A (clear selection)

### Last Round Declaration
- Toggle switch on pre-round screen (no modal, no trump choice — decided at the table)
- Can be toggled on/off freely before starting the round
- After this round, game ends

---

## UI/UX Decisions

- **Design kit "1b Evolve"** (2026-08-19, from `Wizard Game/_Design/design_handoff_wizard_1b/README.md` — shared with wizard-multiplayer, keep the two in lockstep)
  - Darker bg gradient (#0b1224 → #040913); frame gutter 14px (`px-3.5`)
  - **Typography rules (2026-08-20, applies to BOTH apps):** serif (`font-display`, Cormorant Garamond via Google Fonts) is for IDENTITY and NARRATIVE only — screen titles ("Round 3", "History"), player names, room codes, AI recap prose; never below 13px (smaller name contexts use sans). Sans (default) is for ALL DATA and UI: **every numeral** (always `tabular-nums`, semibold/bold), labels, buttons, chips, status words, metadata. Numerals are NEVER serif.
  - Kit tokens in `@theme`: `cream` #ece0c4, `cream-bright` #f7f0dd, `gold-text` #e2c579, `steel` #2e3a55; kit classes in index.css: `.btn-gold` (new lighter gradient, radius 8), `.btn-secondary`, `.btn-header`, `.btn-danger`, `.card-gold` (panel gradient + inset highlight), `.card-gold-active` (warm gold active), `.card-gold-subtle` (quiet row), `.chip`/`.chip-selected`/`.chip-locked`/`.chip-disabled` (number buttons), `.eyebrow`, `.section-label`, `.ornament` + `.diamond` (hairline ◆ rule), `.shame-chip`
  - NOTE: kit classes are unlayered CSS, so they beat Tailwind utilities — don't try to override e.g. `.chip` font-size with a `text-*` utility
  - Shared 50px header: ghost text action · ◆ logo ◆ · "Scores" btn-header; title blocks = eyebrow + serif Round N + ornament + metadata row (`Trump ♥ Hearts · Dealer X · N cards`, trump tappable during rounds — `RoundMeta.jsx`; RoundHeader.jsx retired)
  - True minus sign − (U+2212) for all negative scores
  - Bid/trick chips: ≤6 values = one flex row of 44px chips; 7+ = 6-column grid of 38px chips (density frame 2c; 2d collapsed-rows variant NOT implemented)
  - `public/wizard-logo.svg` replaced with the handoff's gold-fill version (old one had undefined st0–st5 classes)
  - Dealer shown with ♛ crown icon; 💀/⚠️ emoji replaced by `.shame-chip` + bordered `!` button
- **Mobile-first** dark theme (375px+)
- **Player list in seating order** (not sorted by score) in pre-round
- **Round results sorted by score** (best to worst), with dealer name + card count header (no round title)
- **Standings sorted by score** only in the Scoreboard view
- **All bid/trick buttons always visible** — no progressive reveal, tap to change. Back + Confirm/Score buttons always shown, disabled until valid
- **Shame points** — ⚠️ button on each player during bidding and tricks phases. Plays a "boo" sound (Web Audio API), confirms before adding. Shown as 💀 next to names everywhere (bidding, tricks, round results, scoreboard). After confirmation, a full-screen **BooToast** overlay pops up with a randomized phrase like "BOOOO, JORGE!" or "SHAAAME! SHAAAAME!" so players know the shame registered even if the phone is on silent. Phrases live in `src/utils/booPhrases.js`. Persisted in game state and saved to Firebase
- **Tied standings** — players with same score share rank (e.g. two 3rds, then 5th)
- **Game over** — full scoreboard with Keep Playing + New Game + History buttons
  - White gradient wipe transition (top to bottom, 1s) reveals the score screen
  - Emoji sparkles (🪄 ⭐ ✨) pop/twinkle for 3s, start with the wipe
  - Wizard sparkle sound (ascending C major arpeggio + shimmer) via Web Audio API
  - Medal emojis: 🥇🥈🥉 for top 3 ranks
  - Game results auto-saved to Firebase (production only)
  - Dynamic game summary sentence at the top with bold player names (via `<b>` tags + `dangerouslySetInnerHTML`)
  - **AI-generated** via Claude Sonnet 5 through `generateGameSummary` Cloud Function in production (prompt picks a random narrator voice per game for variety; roast-y, 50-85 words)
  - ⚠️ The function's CORS allowlist must include the `*.web.app` hosting origins — it originally only allowed GitHub Pages, so after the hosting move every production game silently fell back to the deterministic sentences (fixed 2026-08-20; functions deploy is manual)
  - Payload includes: final standings, shame points, round count, lead changes, comeback rank, negative-score count, Canadian rules
  - Deterministic fallback sentences in `gameSummary.js` used on localhost and if API call fails
  - Fallback categories: dominance (margin ≥30%), close (margin ≤20), comeback (1st was ≥3rd at midpoint), chaotic (4+ lead changes), meltdown (2+ negative scores), steady (default), tied_first, fallback (<3 players)
  - All sentences use wizard puns, no they/their pronouns, remaining players get farewell phrases
- **Drag-to-reorder players** — available on pre-round screen via touch/mouse drag handles
- **End Game** — red-outline button on pre-round screen (calmer tint) and round results (both with confirm dialog). On a declared last round the gold End Game button ends immediately (no confirm)
- **Add player mid-game** — optional starting points, joins current round immediately
- **Dealer rotation** — based on previous round's dealer + 1 (not formula), stays stable when players are added or reordered mid-game. Change Dealer button on pre-round screen for manual override
- **Sticky phase status bar** (`PhaseStatusBar.jsx`) — during bidding and tricks, a sticky top bar titled "Round N · Bidding/Tricks" shows total vs cards dealt plus an over/under chip (red overbid / gold even / blue underbid; tricks: "Over by N" / "All in" / "N left"). Replaced the old bottom summary bands
- **Auto-scroll** — entering a bid/trick smooth-scrolls to the next player still missing one (wrapping); when all are set (or tricks auto-fill completes the total) it scrolls to the footer buttons. Bidding and tricks screens open scrolled to top
- **Last Round toggle** (`LastRoundToggle.jsx`, shared) — on the pre-round screen and at the bottom of the bidding phase
- **Micro-animations** (index.css, all ≤200ms, transform/opacity only, `prefers-reduced-motion` respected) — `.phase-enter` fade+rise on each stage mount, `.bid-pop` on a newly selected number, `.pop-in` on the status chip (keyed by text so it re-pops on change), `.card-gold-active` gold glow glides to the player awaiting input
- **Tricks won colors** — green (exact match), red (miss) next to each player
- **Wake lock** — Screen stays awake while app is open (Screen Wake Lock API)
- **Round info** — Shows "[Dealer] deals X cards each" and "Y rounds left"
- **Canadian Rules subtitle** shown when toggled on
- **Running totals with deltas** in scoreboards: "50 (+30)" format
- **Round winner highlighted** with gold background in history tables
- **Scoreboard button** — gold outline in top right header, opens full-screen overlay
- **Pre-round layout** — Start Round (gold), Trump + Last Round toggle (same row), Change Dealer + Add Player (bordered secondary row), End Game (red-outline button)
- **Edit Round** — Back button on round results keeps existing trick values for adjustment (non-destructive)
- **Player name autocomplete** — setup screen queries Firebase for matching player names as you type, shows dropdown with games played count
- Suit colors: ♠ light gray, ♥ red, ♦ blue, ♣ green

---

## Firebase Data Model

```
players/{playerId}:
  name, nameLower (for case-insensitive matching)
  gamesPlayed, wins, totalScore, bestScore, worstScore
  totalShamePoints, createdAt

games/{gameId}:
  date, roundCount, playerCount
  results: [{ playerId, name, score, rank, shamePoints }]
```

- **Production only** — `isProduction()` check skips writes on localhost
- **Player matching** — case-insensitive via `nameLower` field ("Victor" = "victor")
- **Security rules** — open read/write (`allow read, write: if true`)
- **One-off scripts** in `scripts/` for data seeding/cleanup

---

## History Screen

- Accessible from: setup screen ("📜 Player History" button), game over header, mid-game scoreboard header
- Styled with the 1b Evolve kit (serif names, sans numerals, card-gold panels, shame-chips, true minus signs) — restyled 2026-08-20 after the original kit pass missed this screen
- **All-Time Stats tab** — sorted by **Rating** (default), shows: rating, win%, wins, games played, avg score (best score moved to the player detail modal)
  - **Rating** (`src/utils/ratings.js`) = podium points per game with a reliability damper: 3/2/1 pts for 1st/2nd/3rd but **last place never scores** (so a 2-player loss earns nothing), divided by `gamesPlayed + 3`. Fixes raw win% ranking a one-game winner above consistent regulars. Computed client-side from up to 300 recent game docs (fetched on history open, follows `mergedInto` chains + name/alias fallback), cached in the history SWR cache as `podium`. Player detail modal shows 🥇🥈🥉 podium counts + rating tile. Explainer footnote under the table.
  - All column headers tappable to sort ascending/descending (arrow indicator on active column)
  - Players named `test*` are hidden from the board (belt-and-braces vs the multiplayer dev-mode sign-in; the actual Test/TestJC docs were deleted 2026-08-20 via `wizard-multiplayer/scripts/delete-test-players_V01.mjs`)
  - Players with 0 completed games collapse behind a "Show N scoreless" toggle row at the bottom of the table (same in multiplayer's /history)
- **Past Games tab** — reverse chronological (30 most recent), shows all players with ranks, scores, shame points per game; games played in the multiplayer app get a sky-blue `.online-chip` badge (detected via `source: 'multiplayer'`, or a `log` field on pre-source games) — same in multiplayer's /history

---

## Game Replay Chart

`src/components/BarChartRace.jsx` renders the game-over score animation.

- SVG line chart of actual scores (not ranks) — Y axis spans min/max of the game, zero baseline shown
- Auto-plays 1.2s after the game-over wipe; play/pause/skip/close controls in header
- Everyone starts at 0 on the left edge; each player gets a distinct color (10 in the `LINE_COLORS` palette)
- **Label collision avoidance**: sorts active labels by dot Y each frame, stacks 22px apart, clamps stack inside chart bounds. When the stack overflows the bottom (e.g. start of game), it shifts up so nothing clips; a faint connector line is drawn when a label is pulled away from its dot.
- **Label smoothing**: each player's displayed Y is kept in `displayedLabelYRef` and advances 22% of the distance toward its target every frame. Rank-swap jumps slide over ~8 frames (~130ms); continuous smooth tracking barely lags. This replaces an earlier CSS-transition approach that desynced when targets changed every frame.

---

## Test Mode (hidden, works in production)

For playing a full throwaway game without touching real data:

- **URL param**: `?test` (e.g. https://wizard-scorekeeper.web.app/?test), or the barely-visible "test game" link at the bottom of the setup screen ("exit test mode" appears there while active)
- **Preloaded players**: in test mode the setup screen starts with Merlin, Gandalf, Morgana, Radagast (editable) so a test game is one tap away
- **Multiplayer equivalent**: https://wizard-multiplayer.web.app/?test unlocks the "add 3 bots" panel in production with bots pre-checked (bot games never reach shared history)
- `isTestMode()` lives in `src/utils/testMode.js`
- **No Firebase writes**: game results are never saved (guard next to the `isDemoMode()` check in `GameScoreboard.jsx`); AI summary Cloud Function is not called — deterministic fallback summary shows instead
- **Separate localStorage slot** (`wizard-scorekeeper-state-test`) so a real in-progress game on the same device is untouched
- Purple "🧪 TEST GAME — nothing is saved to history" ribbon pinned to the bottom of every screen (rendered in `main.jsx`)

## Demo Mode (dev only)

For previewing the game-over screen without playing a real game:

- **URL param**: `?demo=<name>` where `<name>` is one of `dominance`, `close`, `comeback`, `chaotic`, `meltdown`, `tied`, `noshame`, `big`
- **Dev panel**: a pink "🧪 Demo scenarios" card appears at the bottom of the setup screen when `isProduction()` is false, with a button for each scenario
- Mock data lives in `src/utils/demoScenarios.js`. Each scenario is a factory that returns `{ players, rounds, totalScores, shamePoints, settings }`
- **Does NOT write to Firestore**: `saveGameResult` is skipped when `isDemoMode()` is true (even in prod, as a belt-and-braces guard)
- **AI summary IS called** in demo mode (including on localhost) so the real output can be previewed — see `GameScoreboard.jsx` gate: `if (!isProduction() && !isDemoMode()) return;`
- "Keep Playing" / "New Game" clear the URL param and reload to the setup screen
- A gold banner at the top indicates you're in demo mode

---

## State Shape

```javascript
{
  players: [{ id, name, addedInRound, startingPoints }],
  settings: { canadianRules, roundDirection: "ascending", firstDealerIndex },
  currentRound: 0,          // index into rounds array
  currentPhase: "preround",  // preround | bidding | tricks | scored | finished
  isLastRound: false,
  lastRoundTrumpChoice: null, // legacy, now always null
  shamePoints: { playerId: number }, // visual-only shame counters
  rounds: [{
    roundNumber, cardsDealt, dealerIndex,
    trumpSuit,   // "spades"|"hearts"|"diamonds"|"clubs"|"none"|null
    bids: { playerId: number },
    tricks: { playerId: number },
    scores: { playerId: number }
  }],
  maxRounds: number          // floor(60/numPlayers)
}
```

localStorage key: `wizard-scorekeeper-state`
