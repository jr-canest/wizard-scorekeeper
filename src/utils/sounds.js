export function playBooSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const duration = 0.8;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const distortion = ctx.createWaveShaper();

    const samples = 256;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = (Math.PI + 200 * x) / (Math.PI + 200 * Math.abs(x));
    }
    distortion.curve = curve;

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(180, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + duration);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(120, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + duration);

    gain.gain.setValueAtTime(0.6, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    osc1.connect(distortion);
    osc2.connect(distortion);
    distortion.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + duration);
    osc2.stop(ctx.currentTime + duration);

    setTimeout(() => ctx.close(), (duration + 0.5) * 1000);
  } catch {
    // Audio not supported
  }
}

export function playSparkleSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    // Magical ascending chime — 4 quick notes with shimmer
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    const noteSpacing = 0.12;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * noteSpacing);

      gain.gain.setValueAtTime(0, now + i * noteSpacing);
      gain.gain.linearRampToValueAtTime(0.3, now + i * noteSpacing + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * noteSpacing + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * noteSpacing);
      osc.stop(now + i * noteSpacing + 0.5);
    });

    // High shimmer overlay
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = 'triangle';
    shimmer.frequency.setValueAtTime(2093, now + 0.3); // C7
    shimmer.frequency.exponentialRampToValueAtTime(4186, now + 1.2); // C8
    shimmerGain.gain.setValueAtTime(0, now + 0.3);
    shimmerGain.gain.linearRampToValueAtTime(0.15, now + 0.5);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);
    shimmer.start(now + 0.3);
    shimmer.stop(now + 1.5);

    setTimeout(() => ctx.close(), 2000);
  } catch {
    // Audio not supported
  }
}

// ─── Bid / trick chip taps ───
// These fire on every number tap, often several a second, so they share
// one long-lived AudioContext instead of the create-and-close pattern
// above (iOS Safari caps how many contexts a page can open). Both are
// pitched by the number tapped, one pentatonic note per step (0 = G4,
// capped at C7 from 12 up), so a big bid audibly sounds bigger. Bids are
// a soft mallet pluck; tricks lead with a card snap so the two phases
// sound different.

let tapCtx = null;
let noiseBuffer = null;

function getTapContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!tapCtx) tapCtx = new AudioCtx();
  // Starts suspended under autoplay rules, and iOS suspends/"interrupts"
  // it when the tab is backgrounded; the tap calling this is the user
  // gesture that's allowed to wake it back up.
  if (tapCtx.state !== 'running') tapCtx.resume().catch(() => {});
  return tapCtx;
}

const PENTATONIC = [0, 2, 5, 7, 9]; // G A C D E, in semitones above G

function noteFor(n) {
  const step = Math.min(Math.max(n, 0), 12);
  const semitones = Math.floor(step / 5) * 12 + PENTATONIC[step % 5];
  return 392 * 2 ** (semitones / 12); // G4 = 392 Hz
}

// One oscillator note: 4 ms attack, exponential ring-out over `decay` s
function tone(ctx, dest, type, freq, t, peak, decay) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(t);
  osc.stop(t + decay + 0.02);
  return osc;
}

// Per-tap output level. Each voice disconnects its bus when its longest
// note ends, so a game's worth of taps doesn't pile up on the shared
// context.
function tapBus(ctx, dest) {
  const bus = ctx.createGain();
  bus.gain.value = 0.25;
  bus.connect(dest);
  return bus;
}

function getNoiseBuffer(ctx) {
  if (noiseBuffer?.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.05), ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function bidVoice(ctx, dest, t, n) {
  const f = noteFor(n);
  const bus = tapBus(ctx, dest);
  // The note, plus its 4th partial gone in ~50 ms: the mallet "tock"
  const last = tone(ctx, bus, 'sine', f, t, 1, 0.35);
  tone(ctx, bus, 'sine', f * 4, t, 0.35, 0.05);
  last.onended = () => bus.disconnect();
}

// Card snap: 40 ms of band-passed noise. Moving the band lets a run of
// snaps (the start-round riffle) sound like different cards.
function cardSnap(ctx, dest, t, freq = 2800, level = 0.6) {
  const snap = ctx.createBufferSource();
  snap.buffer = getNoiseBuffer(ctx);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = freq;
  band.Q.value = 0.8;
  const snapGain = ctx.createGain();
  snapGain.gain.setValueAtTime(level, t);
  snapGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  snap.connect(band);
  band.connect(snapGain);
  snapGain.connect(dest);
  snap.start(t);
  snap.stop(t + 0.05);
}

function trickVoice(ctx, dest, t, n) {
  const bus = tapBus(ctx, dest);
  cardSnap(ctx, bus, t);
  // ...under the count, as a reedier triangle note
  const last = tone(ctx, bus, 'triangle', noteFor(n), t, 0.8, 0.22);
  last.onended = () => bus.disconnect();
}

// ─── Round cues ───
// Start round and Confirm bids each fire once per round, on the same
// shared context as the taps. Start round hangs on an open G fifth
// ("ready?"); Confirm bids lands on C major, the chord the pentatonic
// bid notes belong to, so the bids sound resolved.

function startRoundVoice(ctx, dest, t) {
  const bus = tapBus(ctx, dest);
  // A riffle: seven card snaps ~24 ms apart, brightening and building
  for (let i = 0; i < 7; i++) {
    const at = t + i * 0.024 + Math.random() * 0.006;
    const freq = 2200 + i * 250 + Math.random() * 300;
    cardSnap(ctx, bus, at, freq, 0.4 + i * 0.06);
  }
  // ...then G4 + D5 ring out, with a faint G5 on top
  const ring = t + 0.2;
  tone(ctx, bus, 'sine', noteFor(0), ring, 0.6, 0.9);
  tone(ctx, bus, 'sine', noteFor(3), ring, 0.45, 0.9);
  const last = tone(ctx, bus, 'sine', noteFor(5), ring + 0.02, 0.15, 1);
  last.onended = () => bus.disconnect();
}

function confirmBidsVoice(ctx, dest, t) {
  const bus = tapBus(ctx, dest);
  // The bid mallet rolls up C5 E5 G5 C6, 35 ms apart; the top C rings on
  let last;
  [2, 4, 5, 7].forEach((step, i) => {
    const at = t + i * 0.035;
    const f = noteFor(step);
    last = tone(ctx, bus, 'sine', f, at, 0.55, i === 3 ? 0.8 : 0.6);
    tone(ctx, bus, 'sine', f * 4, at, 0.2, 0.05);
  });
  last.onended = () => bus.disconnect();
}

export function playStartRoundSound() {
  try {
    const ctx = getTapContext();
    if (ctx) startRoundVoice(ctx, ctx.destination, ctx.currentTime);
  } catch {
    // Audio not supported
  }
}

export function playConfirmBidsSound() {
  try {
    const ctx = getTapContext();
    if (ctx) confirmBidsVoice(ctx, ctx.destination, ctx.currentTime);
  } catch {
    // Audio not supported
  }
}

export function playBidSound(n) {
  try {
    const ctx = getTapContext();
    if (ctx) bidVoice(ctx, ctx.destination, ctx.currentTime, n);
  } catch {
    // Audio not supported
  }
}

export function playTrickSound(n) {
  try {
    const ctx = getTapContext();
    if (ctx) trickVoice(ctx, ctx.destination, ctx.currentTime, n);
  } catch {
    // Audio not supported
  }
}
