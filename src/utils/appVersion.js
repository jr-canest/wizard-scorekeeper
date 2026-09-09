// Build stamp baked in by vite.config.js, e.g. "2026.09.09-295a51d"
// (build date + short commit). "dev" under `npm run dev`.
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'dev';

// "2026.09.09-295a51d" → "v2026.09.09 · 295a51d"
export function formatVersion(version = APP_VERSION) {
  const [date, sha] = version.split('-');
  return sha ? `v${date} · ${sha}` : `v${version}`;
}

// The update banner reloads the page to pick up a new build. Game state
// already lives in localStorage, but a plain reload lands on the
// "Resume your previous game?" prompt — this one-shot sessionStorage
// flag lets useGameState skip the prompt and drop straight back into
// the game the player was in.
const RESUME_KEY = 'wizard-scorekeeper-resume-after-update';

export function markResumeAfterUpdate() {
  try {
    sessionStorage.setItem(RESUME_KEY, '1');
  } catch {
    // storage unavailable — the resume prompt still works
  }
}

export function consumeResumeAfterUpdate() {
  try {
    const set = sessionStorage.getItem(RESUME_KEY) === '1';
    sessionStorage.removeItem(RESUME_KEY);
    return set;
  } catch {
    return false;
  }
}
