// Synthesized sound only: WebAudio oscillators and noise, no audio files.
// Everything is created lazily on the first user gesture, so the game is
// silent (and error-free) until the player presses a key or clicks.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  function blip(freq, dur, type, vol, slide) {
    if (!ensure() || muted) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.18, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch { /* sound is optional */ }
  }

  function noise(dur, vol, freq) {
    if (!ensure() || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = freq || 900;
      const g = ctx.createGain(); g.gain.value = vol || 0.25;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } catch { /* sound is optional */ }
  }

  // A slow two-note bass loop, scheduled while the game runs.
  const BASS = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];
  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      blip(BASS[musicStep % BASS.length], 0.5, 'triangle', 0.12);
      musicStep += 1;
    }, 420);
  }

  return {
    ensure,
    startMusic,
    toggleMute() { muted = !muted; if (engineGain) engineGain.gain.value = 0; return muted; },
    get muted() { return muted; },
    pickup() { blip(880, 0.12, 'sine', 0.2, 1320); },
    coin() { blip(1046, 0.1, 'sine', 0.2); blip(1568, 0.14, 'sine', 0.16); },
    punch() { noise(0.08, 0.3, 500); },
    crash() { noise(0.25, 0.4, 400); },
    siren() { blip(700, 0.3, 'sine', 0.12, 950); blip(950, 0.3, 'sine', 0.1, 700); },
    mission() { blip(523, 0.14, 'triangle', 0.2); blip(659, 0.14, 'triangle', 0.2); blip(784, 0.3, 'triangle', 0.22); },
    busted() { blip(392, 0.4, 'sawtooth', 0.2, 196); },
    engine(speed01) {
      if (!ensure() || muted) return;
      try {
        engineOsc.frequency.value = 50 + speed01 * 140;
        engineGain.gain.value = 0.03 + speed01 * 0.05;
      } catch { /* ignore */ }
    },
    engineOff() { if (engineGain) engineGain.gain.value = 0; },
  };
}
