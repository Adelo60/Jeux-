// Sons 100 % synthétisés (aucun fichier audio à charger)
let ctx = null, master = null, musicGain = null, noiseBuf = null, enabled = true, musicTimer = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = enabled ? 0.7 : 0;
    const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
    startMusic();
  } catch (e) { ctx = null; }
}
export function setSound(on) { enabled = on; if (master) master.gain.value = on ? 0.7 : 0; }

function tone(f0, f1, dur, type = 'sine', vol = 0.3, delay = 0, dest = master) {
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, f0, f1, q = 1, delay = 0, type = 'bandpass') {
  const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
}

const S = {
  slash: () => noise(0.16, 0.22, 900, 4200, 1.2),
  heavy: () => { noise(0.26, 0.3, 500, 3200, 1); tone(140, 60, 0.2, 'sine', 0.2); },
  hit: () => { noise(0.09, 0.35, 2200, 500, 0.8); tone(190, 70, 0.12, 'triangle', 0.35); },
  crit: () => { noise(0.12, 0.4, 3200, 600, 0.8); tone(260, 60, 0.18, 'square', 0.2); tone(1400, 900, 0.12, 'sine', 0.12); },
  kill: () => { tone(320, 50, 0.3, 'sawtooth', 0.16); noise(0.3, 0.2, 1500, 150, 0.7); },
  dodge: () => noise(0.22, 0.2, 300, 1800, 0.6),
  perfect: () => { tone(660, 1320, 0.35, 'sine', 0.25); tone(990, 1980, 0.45, 'sine', 0.15, 0.05); },
  hurt: () => { tone(160, 50, 0.3, 'sawtooth', 0.35); noise(0.2, 0.3, 800, 150, 0.6); },
  swipe: () => noise(0.14, 0.15, 500, 1600, 1.5),
  slam: () => { tone(90, 28, 0.55, 'sine', 0.7); noise(0.5, 0.45, 600, 60, 0.5, 0, 'lowpass'); },
  fury: () => { tone(70, 25, 0.9, 'sine', 0.8); noise(0.9, 0.5, 3000, 80, 0.5, 0, 'lowpass'); tone(440, 110, 0.6, 'sawtooth', 0.15); },
  shoot: () => tone(900, 300, 0.22, 'triangle', 0.14),
  parry: () => { tone(1500, 2400, 0.14, 'square', 0.12); noise(0.1, 0.25, 5000, 2500, 2); },
  pickup: () => tone(1100 + Math.random() * 500, 1900, 0.09, 'sine', 0.08),
  heal: () => { tone(520, 780, 0.25, 'sine', 0.2); tone(780, 1040, 0.3, 'sine', 0.15, 0.1); },
  roar: () => { tone(110, 45, 0.9, 'sawtooth', 0.4); noise(0.9, 0.3, 400, 120, 0.8); },
  wave: () => { tone(98, 98, 1.2, 'sawtooth', 0.14); tone(147, 147, 1.2, 'sawtooth', 0.1); tone(60, 30, 0.5, 'sine', 0.6); },
  boon: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.4, 'sine', 0.14, i * 0.07)); },
  click: () => tone(700, 500, 0.06, 'triangle', 0.15),
  zap: () => { noise(0.14, 0.25, 6000, 1500, 3); tone(1800, 300, 0.12, 'sawtooth', 0.08); },
  death: () => { tone(220, 30, 1.6, 'sawtooth', 0.35); tone(55, 25, 1.4, 'sine', 0.7); },
};
export function sfx(name) { if (!ctx || !enabled) return; try { S[name] && S[name](); } catch (e) { /* ignore */ } }

// Nappe d'ambiance générative + pulsation de tambour en combat
let combat = 0;
export function setCombat(v) { combat = v; }
function startMusic() {
  const roots = [73.4, 58.3, 87.3, 65.4]; let bar = 0, beat = 0;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.connect(musicGain);
  const step = () => {
    if (!ctx) return;
    if (beat % 8 === 0) {
      const r = roots[bar++ % roots.length];
      for (const m of [1, 1.5, 2, 2.4, 3]) for (const det of [-4, 4]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
        o.type = 'sawtooth'; o.frequency.value = r * m; o.detune.value = det + Math.random() * 3;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.11 / m, t + 1.6); g.gain.linearRampToValueAtTime(0.0001, t + 5.2);
        o.connect(g); g.connect(lp); o.start(t); o.stop(t + 5.3);
      }
    }
    if (combat > 0) {
      const p = beat % 8;
      if (p === 0 || p === 3 || p === 6 || (combat > 1 && p === 5)) { tone(82, 38, 0.3, 'sine', 0.5, 0, musicGain); }
      if (combat > 1 && p % 2 === 1) tone(196, 180, 0.08, 'square', 0.05, 0, musicGain);
    }
    beat++;
  };
  step(); musicTimer = setInterval(step, 600);
}
