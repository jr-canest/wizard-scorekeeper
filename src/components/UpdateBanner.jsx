import { useEffect } from 'react';
import { useUpdateCheck } from '../hooks/useUpdateCheck';
import { formatVersion, markResumeAfterUpdate } from '../utils/appVersion';

const BANNER_HEIGHT = 40;

// Sticky strip pinned above every screen once a newer build is live.
// Not dismissable — the only way past it is Update, which reloads the
// page. The current game is safe: every change is already in
// localStorage, and the resume flag drops the player straight back in.
export default function UpdateBanner() {
  const liveVersion = useUpdateCheck();
  const show = liveVersion != null;

  // Other sticky bars (PhaseStatusBar) read this to sit just below.
  useEffect(() => {
    if (!show) return;
    document.body.style.setProperty('--update-banner-h', `${BANNER_HEIGHT}px`);
    return () => document.body.style.removeProperty('--update-banner-h');
  }, [show]);

  if (!show) return null;

  function update() {
    markResumeAfterUpdate();
    window.location.reload();
  }

  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between gap-3 px-3.5 bg-[#1a2340] border-b border-gold-300/40 text-cream"
      style={{ height: BANNER_HEIGHT }}
    >
      <div className="min-w-0">
        <div className="text-[12px] font-semibold leading-tight truncate">New version available</div>
        <div className="text-[10px] text-navy-200 leading-tight truncate tabular-nums">
          {formatVersion(liveVersion)} · your game is kept
        </div>
      </div>
      <button onClick={update} className="btn-gold h-7 px-3.5 text-[12px] shrink-0">
        Update
      </button>
    </div>
  );
}
