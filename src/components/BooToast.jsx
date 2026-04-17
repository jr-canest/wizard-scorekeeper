import { useEffect, useState } from 'react';

/**
 * Full-screen "BOO" confirmation toast when a shame point is given.
 * Renders nothing until `message` is set, then animates in for ~1.6s.
 */
export default function BooToast({ message, onDone }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const hide = setTimeout(() => setVisible(false), 1300);
    const done = setTimeout(() => onDone?.(), 1600);
    return () => {
      clearTimeout(hide);
      clearTimeout(done);
    };
  }, [message]);

  if (!message) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none px-6"
      aria-live="assertive"
    >
      <style>{`
        @keyframes boo-pop-in {
          0%   { transform: scale(0.3) rotate(-8deg); opacity: 0; }
          40%  { transform: scale(1.15) rotate(2deg); opacity: 1; }
          60%  { transform: scale(0.95) rotate(-1deg); }
          80%  { transform: scale(1.05) rotate(0.5deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes boo-pop-out {
          from { transform: scale(1); opacity: 1; }
          to   { transform: scale(0.9) translateY(10px); opacity: 0; }
        }
        @keyframes boo-backdrop-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes boo-backdrop-out {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        .boo-backdrop-in  { animation: boo-backdrop-in  0.15s ease-out forwards; }
        .boo-backdrop-out { animation: boo-backdrop-out 0.3s ease-in forwards; }
        .boo-text-in      { animation: boo-pop-in       0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .boo-text-out     { animation: boo-pop-out      0.3s ease-in forwards; }
      `}</style>
      <div className={`absolute inset-0 bg-black/70 ${visible ? 'boo-backdrop-in' : 'boo-backdrop-out'}`} />
      <div
        className={`relative text-center text-red-400 font-black tracking-wide drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] ${
          visible ? 'boo-text-in' : 'boo-text-out'
        }`}
        style={{
          fontSize: 'clamp(2.5rem, 11vw, 5rem)',
          lineHeight: 1.05,
          textShadow: '0 0 24px rgba(255,50,50,0.5)',
        }}
      >
        💀 {message} 💀
      </div>
    </div>
  );
}
