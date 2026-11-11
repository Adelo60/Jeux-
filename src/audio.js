// Audio 100 % synthétisé : bruitages en couches, réverbération, ambiance et musique adaptative.
let ctx = null, master = null, sfxBus = null, musicBus = null, rev = null, noiseBuf = null, enabled = true, level = 0;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = enabled ? 0.8 : 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5;
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // réverbération (grande salle de pierre)
    const len = Math.floor(ctx.sampleRate * 2.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < len; i++) { const t = i / len; ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (i < 400 ? i / 400 : 1); } }
    rev = ctx.createConvolver(); rev.buffer = ir; const rg = ctx.createGain(); rg.gain.value = 0.55; rev.connect(rg); rg.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.85; sfxBus.connect(master);
    const s1 = ctx.createGain(); s1.gain.value = 0.22; sfxBus.connect(s1); s1.connect(rev);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
    const s2 = ctx.createGain(); s2.gain.value = 0.5; musicBus.connect(s2); s2.connect(rev);
    startAmbience(); startMusic();
  } catch (e) { ctx = null; }
}
export function setSound(on) { enabled = on; if (master) master.gain.value = on ? 0.8 : 0; }
export function setCombat(v) { level = v; }

function tone(f0, f1, dur, type = 'sine', vol = 0.3, delay = 0, dest = sfxBus, at = 0) {
  const t = (at || ctx.currentTime) + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, f0, f1, q = 1, delay = 0, type = 'bandpass', dest = sfxBus, at = 0) {
  const t = (at || ctx.currentTime) + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
}
// tintement métallique (partiels inharmoniques)
function clang(f, dur, vol, delay = 0) { for (const [m, v] of [[1, 1], [2.76, 0.6], [5.4, 0.35], [8.9, 0.2]]) tone(f * m, f * m * 0.99, dur / (0.6 + m * 0.3), 'sine', vol * v, delay); }
const rnd = (a, b) => a + Math.random() * (b - a);

const S = {
  slash: () => { noise(0.18, 0.26, rnd(700, 1000), rnd(4200, 5200), 1.4); noise(0.1, 0.1, 6000, 9000, 2, 0.03); },
  heavy: () => { noise(0.3, 0.34, 400, 3600, 1); noise(0.14, 0.12, 5000, 9000, 2, 0.08); tone(150, 55, 0.25, 'sine', 0.25); },
  hit: () => { noise(0.07, 0.4, 2600, 500, 0.8); tone(rnd(170, 220), 60, 0.14, 'triangle', 0.4); tone(90, 40, 0.12, 'sine', 0.35); clang(rnd(1700, 2300), 0.12, 0.05); },
  crit: () => { noise(0.1, 0.45, 3600, 500, 0.8); tone(240, 50, 0.22, 'square', 0.22); tone(70, 30, 0.25, 'sine', 0.5); clang(rnd(2400, 3000), 0.3, 0.1); },
  kill: () => { tone(rnd(280, 360), 45, 0.38, 'sawtooth', 0.16); noise(0.4, 0.22, 1800, 120, 0.7); noise(0.5, 0.1, 400, 3000, 3, 0.05); tone(60, 30, 0.3, 'sine', 0.3); },
  dodge: () => { noise(0.24, 0.24, 250, 2200, 0.6); noise(0.1, 0.08, 4000, 1500, 1.5, 0.1); },
  perfect: () => { tone(660, 1320, 0.4, 'sine', 0.22); tone(990, 1980, 0.5, 'sine', 0.14, 0.05); clang(1320, 0.9, 0.08, 0.08); noise(0.8, 0.12, 200, 60, 0.5, 0, 'lowpass'); },
  hurt: () => { tone(170, 45, 0.32, 'sawtooth', 0.35); noise(0.22, 0.32, 900, 140, 0.6); tone(70, 35, 0.3, 'sine', 0.5); },
  swipe: () => noise(0.14, 0.17, 500, 1800, 1.5),
  slam: () => { tone(95, 26, 0.7, 'sine', 0.8); noise(0.6, 0.5, 700, 50, 0.5, 0, 'lowpass'); noise(0.35, 0.2, 2500, 300, 0.7, 0.02); for (let i = 0; i < 4; i++) noise(0.06, 0.1, rnd(800, 2500), 400, 2, 0.15 + i * 0.07); },
  fury: () => { tone(75, 22, 1.2, 'sine', 0.9); noise(1.1, 0.55, 3500, 60, 0.5, 0, 'lowpass'); tone(440, 80, 0.7, 'sawtooth', 0.16); clang(520, 1.2, 0.1); noise(0.9, 0.2, 300, 5000, 1, 0.05); },
  shoot: () => { tone(rnd(800, 1000), 280, 0.25, 'triangle', 0.14); noise(0.2, 0.08, 3000, 800, 3); },
  parry: () => { clang(rnd(1900, 2300), 0.5, 0.2); noise(0.08, 0.3, 6000, 2500, 2); },
  pickup: () => { const f = rnd(1100, 1600); tone(f, f * 1.5, 0.1, 'sine', 0.07); tone(f * 2, f * 3, 0.08, 'sine', 0.03, 0.03); },
  heal: () => { [523, 659, 784].forEach((f, i) => tone(f, f * 1.01, 0.35, 'sine', 0.14, i * 0.07)); },
  roar: () => { tone(120, 42, 1.1, 'sawtooth', 0.4); tone(87, 38, 1.1, 'square', 0.2); noise(1.0, 0.35, 500, 110, 0.9); noise(0.8, 0.12, 1500, 500, 4, 0.1); },
  growl: () => { tone(rnd(95, 130), 60, 0.35, 'sawtooth', 0.12); noise(0.3, 0.08, 600, 200, 2); },
  wave: () => { tone(55, 28, 0.8, 'sine', 0.7); noise(0.5, 0.25, 500, 60, 0.6, 0, 'lowpass'); tone(110, 110, 1.4, 'sawtooth', 0.1); tone(165, 165, 1.4, 'sawtooth', 0.07); clang(294, 1.6, 0.06, 0.05); },
  boon: () => { [587, 740, 880, 1175].forEach((f, i) => { tone(f, f, 0.5, 'sine', 0.13, i * 0.075); tone(f * 2, f * 2, 0.3, 'sine', 0.04, i * 0.075); }); },
  click: () => { tone(760, 520, 0.06, 'triangle', 0.14); noise(0.03, 0.08, 4000, 2000, 2); },
  zap: () => { noise(0.16, 0.28, 7000, 1500, 3); tone(1900, 250, 0.14, 'sawtooth', 0.09); noise(0.05, 0.2, 2000, 9000, 1, 0.04); },
  death: () => { tone(220, 28, 1.8, 'sawtooth', 0.32); tone(55, 24, 1.6, 'sine', 0.75); noise(1.5, 0.2, 1200, 80, 0.6, 0, 'lowpass'); },
  step: () => noise(0.05, 0.05, rnd(300, 500), 150, 1.2, 0, 'lowpass'),
  lance: () => { noise(0.35, 0.3, 600, 5000, 1.2); tone(520, 1400, 0.3, 'sawtooth', 0.1); tone(130, 60, 0.2, 'sine', 0.3); },
  spin: () => { noise(0.2, 0.22, rnd(500, 700), rnd(2600, 3400), 1.6); clang(rnd(1500, 1900), 0.1, 0.03); },
  rush: () => { noise(0.3, 0.35, 5000, 400, 0.8); tone(1600, 120, 0.3, 'sawtooth', 0.14); tone(80, 35, 0.35, 'sine', 0.5); noise(0.08, 0.25, 3000, 9000, 1, 0.12); },
  nocd: () => tone(180, 140, 0.08, 'square', 0.05),
};
export function sfx(name) { if (!ctx || !enabled) return; try { S[name] && S[name](); } catch (e) { /* ignore */ } }

// ---------- Ambiance : vent grave + crépitement des braseros ----------
function startAmbience() {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.frequency.value = 320; f.Q.value = 0.6; g.gain.value = 0.06;
  lfo.frequency.value = 0.11; lg.gain.value = 180; lfo.connect(lg); lg.connect(f.frequency);
  s.connect(f); f.connect(g); g.connect(musicBus); s.start(); lfo.start();
}

// ---------- Musique : thème en ré mineur, 3 intensités (menu / combat / boss) ----------
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
// [basse, accord...]
const CH = [[38, 50, 53, 57], [38, 50, 53, 57], [34, 46, 50, 53], [36, 48, 52, 55], [38, 50, 53, 57], [31, 43, 46, 50], [34, 46, 50, 53], [33, 45, 49, 52]];
// mélodie : [mesure, pas, note, durée en pas]
const MEL = [[0, 0, 74, 6], [0, 6, 77, 2], [0, 8, 76, 4], [0, 12, 74, 4], [1, 0, 69, 12], [1, 12, 72, 4], [2, 0, 74, 6], [2, 6, 77, 2], [2, 8, 79, 4], [2, 12, 77, 4], [3, 0, 76, 12], [3, 12, 72, 2], [3, 14, 76, 2],
  [4, 0, 81, 6], [4, 6, 79, 2], [4, 8, 77, 4], [4, 12, 76, 4], [5, 0, 74, 8], [5, 8, 70, 4], [5, 12, 74, 4], [6, 0, 77, 6], [6, 6, 76, 2], [6, 8, 74, 8], [7, 0, 73, 8], [7, 8, 76, 4], [7, 12, 69, 4]];
const DRUM = { 0: 1, 3: 0.45, 6: 0.8, 8: 1, 11: 0.45, 14: 0.75 };

function pad(m, t, dur, vol) {
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 650; f.Q.value = 0.5;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
  for (const det of [-7, 6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mf(m); o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur + 0.7); }
  f.connect(g); g.connect(musicBus);
}
function horn(m, t, dur, vol) {
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(1500, t + 0.12); f.frequency.linearRampToValueAtTime(900, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.07); g.gain.setValueAtTime(vol * 0.8, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.25);
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.2; lg.gain.value = 5; lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 0.3);
  for (const [oct, type] of [[0, 'sawtooth'], [-12, 'triangle']]) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = mf(m + oct); lg.connect(o.detune); o.connect(f); o.start(t); o.stop(t + dur + 0.3); }
  f.connect(g); g.connect(musicBus);
}
function pluck(m, t, vol) {
  const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = mf(m);
  f.type = 'lowpass'; f.frequency.setValueAtTime(2200, t); f.frequency.exponentialRampToValueAtTime(280, t + 0.14);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
  o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.2);
}
function taiko(t, v) { tone(98, 40, 0.42, 'sine', 0.85 * v, 0, musicBus, t); noise(0.1, 0.3 * v, 900, 120, 0.6, 0, 'lowpass', musicBus, t); }

function startMusic() {
  let step = 0, next = ctx.currentTime + 0.1;
  const tick = () => {
    if (!ctx || ctx.state !== 'running') return;
    if (next < ctx.currentTime - 0.5) next = ctx.currentTime + 0.05;
    const s16 = 60 / (level === 2 ? 108 : level === 1 ? 98 : 84) / 4;
    while (next < ctx.currentTime + 0.3) {
      const bar = Math.floor(step / 16) % 8, p = step % 16, c = CH[bar], t = next, L = level;
      if (p === 0) {
        for (const m of c.slice(1)) pad(m, t, s16 * 16, 0.035);
        pad(c[0], t, s16 * 16, 0.07); tone(mf(c[0] - 12), mf(c[0] - 12), s16 * 15, 'sine', 0.22, 0, musicBus, t);
        if (L === 0) taiko(t, 0.45);
      }
      for (const n of MEL) if (n[0] === bar && n[1] === p) horn(n[2] - (L === 0 ? 12 : 0), t, n[3] * s16, L === 2 ? 0.1 : L === 1 ? 0.06 : 0.075);
      if (L >= 1) {
        if (DRUM[p]) taiko(t, DRUM[p] * (L === 2 ? 1 : 0.8));
        if (p % 2 === 0 || L === 2) { const arp = [c[1], c[3], c[2] + 12, c[3]][(p >> (L === 2 ? 0 : 1)) % 4]; pluck(arp, t, L === 2 ? 0.075 : 0.06); }
        if (p % 4 === 2) noise(0.03, 0.05, 5000, 3000, 2, 0, 'bandpass', musicBus, t);
        if (L === 2 && bar % 2 === 1 && p >= 12) taiko(t, 0.5 + (p - 12) * 0.12);
        if (L === 2 && p === 0 && bar % 4 === 0) { for (const m of c.slice(1)) horn(m + 12, t, s16 * 6, 0.05); }
      }
      if (Math.random() < 0.25) noise(0.02, 0.03, rnd(2000, 5000), 1000, 3, Math.random() * s16, 'bandpass', musicBus, t);
      next += s16; step++;
    }
  };
  setInterval(tick, 70);
}
