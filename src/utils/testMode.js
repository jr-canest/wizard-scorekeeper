// Hidden test mode: play a full game without touching real data.
// Activated by adding ?test to the URL (e.g. wizard-scorekeeper.web.app/?test).
// In test mode:
//   - game results are NEVER saved to Firebase (no players/games writes)
//   - the AI summary Cloud Function is not called (deterministic fallback used)
//   - game state persists under a separate localStorage key, so a real
//     in-progress game on the same device is untouched
export function isTestMode() {
  return new URLSearchParams(window.location.search).has('test');
}
