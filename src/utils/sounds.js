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
