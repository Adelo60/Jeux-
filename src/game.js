import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Particles, Trail, GroundFx, GradeShader } from './fx.js';
import { buildWorld, ARENA_R } from './world.js';
import { buildHero, Enemy, DEF } from './actors.js';
import { initAudio, sfx, setSound, setCombat } from './audio.js';
import { showRewardedAd } from './ads.js';

const $ = id => document.getElementById(id);
const PI = Math.PI, TAU = PI * 2;
const angDiff = (a, b) => ((a - b + PI) % TAU + TAU) % TAU - PI;
const angLerp = (a, b, t) => a + angDiff(b, a) * Math.min(1, t);
const mobile = matchMedia('(pointer:coarse)').matches;

// ---------------- Sauvegarde ----------------
const SAVE_KEY = 'braise_save_v1';
const save = { coins: 0, best: 0, meta: { hp: 0, dmg: 0, fury: 0, loot: 0, skill: 0 }, sound: true, quality: 'auto' };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s) { Object.assign(save, s); save.meta = Object.assign({ hp: 0, dmg: 0, fury: 0, loot: 0, skill: 0 }, s.meta); } } catch (e) { /* stockage indisponible */ }
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } };

// ---------------- Rendu ----------------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 1, 0.3, 700);
const fx = new Particles(scene), gfx = new GroundFx(scene), trail = new Trail(scene);
const world = buildWorld(scene, fx, mobile);
{ const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(world.envScene, 0.02).texture; scene.environmentIntensity = 0.6; pm.dispose(); }

let composer = null, bloom = null, grade = null, quality = 'high';
function buildComposer() {
  if (composer) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); }
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: quality === 'high' && !mobile ? 4 : 0 });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.62, 0.55, 0.92);
  grade = new ShaderPass(GradeShader);
  composer.addPass(bloom); composer.addPass(grade); composer.addPass(new OutputPass());
}
function applyQuality() {
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(quality === 'high' ? Math.min(dpr, 2) : quality === 'med' ? Math.min(dpr, 1.5) : Math.min(dpr, 1.25));
  world.sun.castShadow = quality !== 'low'; world.mist.visible = quality !== 'low';
  if (quality !== 'low') buildComposer();
  resize();
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
  camera.aspect = w / h; camera.fov = h > w ? 60 : 48; camera.updateProjectionMatrix();
  fx.mat.uniforms.uScale.value = (h * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * PI) / 360));
}
addEventListener('resize', resize);
quality = save.quality === 'low' ? 'low' : 'high';
applyQuality();

// ---------------- État ----------------
const hero = {
  m: buildHero(), pos: new THREE.Vector3(), face: 0, hp: 100, maxHp: 100, fury: 0, state: 'move', t: 0, step: 0,
  queued: false, hitDone: false, invuln: 0, dodgeCd: 0, dodgeX: 0, dodgeZ: 1, perfect: false, empower: 0, comboT: 0, lunge: 0, kx: 0, kz: 0, cds: [0, 0, 0], spinA: 0, tick: 0, stepT: 0, hitSet: null,
};
scene.add(hero.m.root);
const G = {
  state: 'menu', time: 0, hitstop: 0, slowmo: 0, cine: 0, cineT: null, shakeAmp: 0, wave: 0, queue: [], spawnT: 0, clearT: -1, deadT: -1,
  enemies: [], shots: [], picks: [], bolts: [], lances: [], boss: null, scene, camera, hero, fx, gfx, sfx,
  shake(a) { G.shakeAmp = Math.max(G.shakeAmp, a); },
};
let run = null;
const input = { jx: 0, jy: 0, mx: 0, my: 0, atk: false, atkHeld: false, dodge: false, fury: false, skill: -1, keys: {} };

const BOONS = [
  { id: 'dmg', ic: '⚔', n: 'Lame affûtée', d: '+25 % de dégâts', f: r => { r.dmg *= 1.25; } },
  { id: 'aspd', ic: '≫', n: 'Célérité', d: '+18 % de vitesse d’attaque', max: 4, f: r => { r.aspd *= 1.18; } },
  { id: 'hp', ic: '♥', n: 'Vigueur', d: '+30 PV max et soin de 30 PV', f: () => { hero.maxHp += 30; heal(30); } },
  { id: 'leech', ic: '☾', n: 'Soif de braise', d: 'Chaque coup porté rend 1,5 PV', max: 3, f: r => { r.leech += 1.5; } },
  { id: 'burn', ic: '♨', n: 'Lame ardente', d: 'Tes coups enflamment : +6 dégâts/s pendant 3 s', f: r => { r.burn += 6; } },
  { id: 'chain', ic: 'ϟ', n: 'Foudre en chaîne', d: '+30 % de chance de foudroyer les ennemis proches', max: 3, f: r => { r.chain += 0.3; } },
  { id: 'dodge', ic: '➶', n: 'Pas de l’ombre', d: 'Esquive rechargée 30 % plus vite', max: 3, f: r => { r.dodgeCd *= 0.7; } },
  { id: 'fury', ic: '✹', n: 'Rage ancestrale', d: '+50 % de gain de fureur', max: 3, f: r => { r.furyGain *= 1.5; } },
  { id: 'crit', ic: '✦', n: 'Œil du faucon', d: '+15 % de coups critiques (dégâts ×2)', max: 5, f: r => { r.crit += 0.15; } },
  { id: 'shock', ic: '◎', n: 'Onde de choc', d: 'Le 3ᵉ coup du combo libère une onde de feu', f: r => { r.shock += 1; } },
  { id: 'cdr', ic: '⧗', n: 'Écho', d: 'Compétences rechargées 20 % plus vite', max: 3, f: r => { r.cdr *= 0.8; } },
  { id: 'heal', ic: '✚', n: 'Second souffle', d: 'Rend 50 % des PV', f: () => heal(hero.maxHp * 0.5) },
];
const META = [
  { k: 'hp', n: 'Cœur de braise', d: '+12 PV max par niveau', max: 8, cost: l => 40 + l * 35 },
  { k: 'dmg', n: 'Fil de la lame', d: '+8 % de dégâts par niveau', max: 8, cost: l => 50 + l * 40 },
  { k: 'skill', n: 'Maîtrise', d: '+12 % de dégâts des compétences par niveau', max: 6, cost: l => 60 + l * 45 },
  { k: 'fury', n: 'Colère contenue', d: '+25 fureur au départ par niveau', max: 4, cost: l => 60 + l * 50 },
  { k: 'loot', n: 'Main avide', d: '+15 % de braises par niveau', max: 6, cost: l => 50 + l * 45 },
];
const BASE_DMG = 12, SWING = [0.4, 0.42, 0.62], HITP = [0.45, 0.5, 0.52], SKILL_CD = [5, 8, 10];

// ---------------- UI ----------------
const show = (id, on = true) => $(id).classList.toggle('hidden', !on);
function banner(h, p = '') { const b = $('banner'); $('bh').textContent = h; $('bp').textContent = p; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
function toast(t) { const b = $('toast'); b.textContent = t; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
const v3 = new THREE.Vector3();
function num(x, y, z, text, cls = '') {
  const box = $('dmg'); if (box.childElementCount > 28) return;
  v3.set(x, y, z).project(camera); if (v3.z > 1) return;
  const e = document.createElement('div'); e.className = 'dn ' + cls; e.textContent = text;
  e.style.left = ((v3.x * 0.5 + 0.5) * innerWidth + (Math.random() - 0.5) * 30) + 'px'; e.style.top = ((-v3.y * 0.5 + 0.5) * innerHeight) + 'px';
  box.appendChild(e); setTimeout(() => e.remove(), 760);
}
const hudCache = {};
function setHud(k, v, fn) { if (hudCache[k] !== v) { hudCache[k] = v; fn(v); } }
function updateHud() {
  const hp = Math.max(0, hero.hp / hero.maxHp);
  setHud('hp', Math.ceil(hero.hp) + '/' + hero.maxHp, v => { $('hpfill').style.transform = $('hplag').style.transform = `scaleX(${hp})`; $('hptxt').textContent = v; $('hurt').classList.toggle('low', hp < 0.3 && hp > 0); });
  setHud('fury', Math.round(hero.fury), v => { $('furyfill').style.transform = `scaleX(${v / 100})`; $('furybar').classList.toggle('full', v >= 100); $('bFury').classList.toggle('ready', v >= 100); });
  setHud('coins', Math.floor(run.coins), v => { $('coins').textContent = v; });
  const left = G.queue.length + G.enemies.filter(e => !e.dead).length;
  setHud('left', left, v => { $('wavee').textContent = v > 0 ? v + ' ennemi' + (v > 1 ? 's' : '') : ''; });
  setHud('cd', Math.round((hero.dodgeCd / run.dodgeCd) * 20), v => { $('bDodge').style.setProperty('--p', Math.min(100, v * 5) + '%'); });
  for (let i = 0; i < 3; i++) setHud('s' + i, Math.ceil((hero.cds[i] / (SKILL_CD[i] * run.cdr)) * 25), v => { const b = $('bS' + i); b.style.setProperty('--p', v * 4 + '%'); b.classList.toggle('cool', v > 0); });
  if (G.boss) setHud('boss', Math.max(0, Math.round((G.boss.hp / G.boss.maxHp) * 200)), v => { $('bossfill').style.transform = `scaleX(${v / 200})`; });
}
function refreshMenu() {
  $('mcoins').textContent = $('scoins').textContent = save.coins; $('mbest').textContent = save.best;
  $('snd').textContent = 'SON : ' + (save.sound ? 'OUI' : 'NON');
  $('qual').textContent = 'GRAPHISMES : ' + ({ auto: 'AUTO', high: 'MAX', low: 'RAPIDE' })[save.quality];
}
function renderShop() {
  const l = $('shopl'); l.innerHTML = '';
  for (const it of META) {
    const lv = save.meta[it.k], cost = it.cost(lv), maxed = lv >= it.max;
    const row = document.createElement('div'); row.className = 'it';
    row.innerHTML = `<div><b>${it.n}</b><span>${it.d}</span><span class="pips">${'◆'.repeat(lv)}${'◇'.repeat(it.max - lv)}</span></div>`;
    const b = document.createElement('button');
    b.innerHTML = maxed ? 'MAX' : `<span class="gem"></span>${cost}`; b.disabled = maxed || save.coins < cost;
    b.onclick = () => { save.coins -= cost; save.meta[it.k]++; persist(); sfx('boon'); refreshMenu(); renderShop(); };
    row.appendChild(b); l.appendChild(row);
  }
}
function setState(s) {
  G.state = s;
  show('menu', s === 'menu'); show('shop', s === 'shop'); show('boons', s === 'boon'); show('over', s === 'over'); show('pauseS', s === 'pause');
  show('hud', s === 'play' || s === 'pause' || s === 'boon');
  setCombat(s === 'play' ? (G.boss ? 2 : 1) : 0);
  if (s === 'menu' || s === 'shop') { refreshMenu(); if (s === 'shop') renderShop(); }
}

// ---------------- Partie ----------------
function clearField() {
  for (const e of G.enemies) e.dispose(); G.enemies.length = 0;
  for (const s of G.shots) scene.remove(s.m); G.shots.length = 0;
  for (const p of G.picks) scene.remove(p.m); G.picks.length = 0;
  for (const b of G.bolts) scene.remove(b.m); G.bolts.length = 0;
  for (const l of G.lances) scene.remove(l.m); G.lances.length = 0;
  gfx.clear(); G.boss = null; show('boss', false); document.body.classList.remove('cine'); G.cine = 0;
}
function newRun() {
  clearField();
  run = { dmg: 1 + 0.08 * save.meta.dmg, aspd: 1, leech: 0, burn: 0, chain: 0, dodgeCd: 0.75, furyGain: 1, crit: 0.05, shock: 0, cdr: 1, skill: 1 + 0.12 * save.meta.skill, coins: 0, banked: 0, kills: 0, revived: false, doubled: false, taken: {} };
  Object.assign(hero, { hp: 100 + 12 * save.meta.hp, maxHp: 100 + 12 * save.meta.hp, fury: Math.min(100, 25 * save.meta.fury), state: 'move', t: 0, invuln: 1, blink: 0, cds: [0, 0, 0], spinA: 0, dodgeCd: 0, empower: 0, comboT: 0, kx: 0, kz: 0, face: PI });
  hero.pos.set(0, 0, 0); G.wave = 0; G.hitstop = G.slowmo = 0; G.deadT = G.clearT = -1; G.time = 0;
  for (const k in hudCache) delete hudCache[k];
  setState('play'); startWave(1);
}
function startWave(n) {
  G.wave = n; G.queue = []; G.spawnT = 1.2; G.clearT = -1;
  const boss = n % 5 === 0; let budget = 3 + n * 2.1;
  if (boss) { G.queue.push('boss'); budget *= 0.35; }
  while (budget > 0) {
    const o = ['grunt', 'grunt']; if (n >= 2) o.push('caster'); if (n >= 3) o.push('brute'); if (n >= 7) o.push('brute', 'caster');
    const t = o[(Math.random() * o.length) | 0]; G.queue.push(t); budget -= { grunt: 1, caster: 1.7, brute: 3.4 }[t];
  }
  $('wavet').textContent = 'VAGUE ' + n;
  banner(boss ? 'COLOSSE DES CENDRES' : 'VAGUE ' + n, boss ? 'Le gardien déchu s’éveille' : n === 1 ? 'Défends le dernier brasier' : '');
  sfx(boss ? 'roar' : 'wave');
}
G.spawnEnemy = (type) => {
  let x = 0, z = 0;
  for (let i = 0; i < 24; i++) { const a = Math.random() * TAU, r = 4 + Math.random() * (ARENA_R - 6); x = Math.cos(a) * r; z = Math.sin(a) * r; if (Math.hypot(x - hero.pos.x, z - hero.pos.z) > (type === 'boss' ? 10 : 7)) break; }
  const lv = G.wave - 1, e = new Enemy(type, G, x, z, (1 + 0.13 * lv) * (type === 'boss' ? 1 + lv * 0.08 : 1), 1 + 0.06 * lv);
  G.enemies.push(e); gfx.ring(x, z, 0.3, e.r * 2.6, 0.7, 0x9a3cff, 2.5);
  if (type === 'boss') { G.boss = e; G.cine = 2.6; G.cineT = e; document.body.classList.add('cine'); show('boss', true); setCombat(2); G.shake(0.5); }
  return e;
};
function heal(v) { const b = hero.hp; hero.hp = Math.min(hero.maxHp, hero.hp + v); if (hero.hp - b >= 1) num(hero.pos.x, 2.2, hero.pos.z, '+' + Math.round(hero.hp - b), 'heal'); }

// ---------------- Combat ----------------
G.damageEnemy = (e, amt, o = {}) => {
  if (e.dead) return;
  amt = Math.max(1, Math.round(amt)); e.hp -= amt; e.flash = 1;
  num(e.x, e.def.h * 0.8 + 0.4, e.z, amt + (o.crit ? '!' : ''), o.crit ? 'crit' : o.dot ? 'dot' : '');
  if (!o.dot) {
    const big = e.type === 'brute' || e.type === 'boss';
    fx.burst(e.x, e.def.h * 0.55, e.z, o.crit ? 16 : 9, o.crit ? [4, 3, 0.8] : [3.4, 1.3, 0.3], 8, 0.32, 0.35);
    if (o.kx !== undefined) { const k = (o.knock || 4) * (big ? 0.2 : 1); e.kx += o.kx * k; e.kz += o.kz * k; }
    e.stagger(o.heavy ? 0.4 : 0.22);
  }
  if (e.hp <= 0) kill(e);
};
function kill(e) {
  e.dead = true; e.set('dying'); gfx.cancel(e.tele); run.kills++;
  const c = e.type === 'caster' ? [0.5, 2.4, 3.4] : [2.8, 0.4, 2.2];
  fx.burst(e.x, e.def.h * 0.5, e.z, e.type === 'boss' ? 160 : 34, c, e.type === 'boss' ? 16 : 9, 0.5, 0.8, 6, 0.6);
  gfx.ring(e.x, e.z, 0.4, e.r * 4, 0.45, 0xb04cff, 2.5); sfx('kill');
  const val = e.def.braise * (1 + 0.15 * save.meta.loot), n = Math.min(8, Math.max(2, Math.round(e.def.braise / 1.5)));
  for (let i = 0; i < n; i++) dropPick(e.x, e.z, val / n, false);
  const heals = e.type === 'boss' ? 4 : Math.random() < (e.type === 'brute' ? 0.4 : 0.1) ? 1 : 0;
  for (let i = 0; i < heals; i++) dropPick(e.x, e.z, 14, true);
  if (e.type === 'boss') { G.slowmo = 1.4; G.shake(1); gfx.ring(e.x, e.z, 1, 22, 1, 0xffb040, 4); show('boss', false); G.boss = null; setCombat(1); for (const o of G.enemies) if (!o.dead) G.damageEnemy(o, 9999, { dot: true }); banner('VICTOIRE', 'Le colosse est tombé'); }
}
function onHit(e) {
  if (run.leech) heal(run.leech);
  if (run.burn && !e.dead) { e.burnT = 3; e.burnDps = run.burn; }
  if (run.chain && Math.random() < run.chain) {
    let from = e, n = 0;
    for (const o of G.enemies) { if (n >= 2) break; if (o === e || o.dead || o.state === 'spawn' || Math.hypot(o.x - e.x, o.z - e.z) > 8) continue; bolt(from, o); G.damageEnemy(o, BASE_DMG * run.dmg * 0.8, { dot: false }); from = o; n++; }
    if (n) sfx('zap');
  }
}
function heroHit(step) {
  const h = hero, range = [3.4, 3.4, 4.3][step], half = [1.3, 1.3, 1.8][step], mult = [1, 1.15, 1.9][step];
  let n = 0, crit = false;
  for (const e of [...G.enemies]) {
    if (e.dead || e.state === 'spawn') continue;
    const dx = e.x - h.pos.x, dz = e.z - h.pos.z, d = Math.hypot(dx, dz) || 0.01;
    if (d - e.r > range) continue;
    if (Math.abs(angDiff(Math.atan2(dx, dz), h.face)) > half && d - e.r > 1.1) continue;
    const c = h.empower > 0 || Math.random() < run.crit; crit = crit || c;
    G.damageEnemy(e, BASE_DMG * run.dmg * mult * (c ? 2 : 1) * (0.9 + Math.random() * 0.2), { crit: c, kx: dx / d, kz: dz / d, knock: step === 2 ? 10 : 4.5, heavy: step === 2 });
    onHit(e); n++;
  }
  for (const s of G.shots) { // renvoi des projectiles
    if (s.friendly) continue;
    const dx = s.m.position.x - h.pos.x, dz = s.m.position.z - h.pos.z, d = Math.hypot(dx, dz);
    if (d < range + 0.5 && Math.abs(angDiff(Math.atan2(dx, dz), h.face)) < half + 0.3) {
      s.friendly = true; s.life = 3; s.m.material = shotMatF;
      const o = s.owner && !s.owner.dead ? s.owner : null, tx = o ? o.x - s.m.position.x : Math.sin(h.face), tz = o ? o.z - s.m.position.z : Math.cos(h.face), tl = Math.hypot(tx, tz) || 1;
      s.vx = (tx / tl) * 24; s.vz = (tz / tl) * 24; sfx('parry'); fx.burst(s.m.position.x, 1.5, s.m.position.z, 12, [1, 3, 4], 7, 0.3, 0.3); G.hitstop = 0.05; h.fury = Math.min(100, h.fury + 5);
    }
  }
  if (n) { h.fury = Math.min(100, h.fury + Math.min(n, 3) * 6 * run.furyGain); G.hitstop = step === 2 ? 0.085 : 0.045; G.shake(step === 2 ? 0.42 : 0.18); sfx(crit ? 'crit' : 'hit'); }
  if (step === 2) {
    const sx = h.pos.x + Math.sin(h.face) * 1.6, sz = h.pos.z + Math.cos(h.face) * 1.6;
    gfx.ring(sx, sz, 0.4, run.shock ? 7.5 : 3.6, 0.35, 0xff8a3c, run.shock ? 3.5 : 2); fx.burst(sx, 0.2, sz, 16, [3.4, 1.3, 0.3], 7, 0.35, 0.45, 12, 0.8);
    if (run.shock) for (const e of [...G.enemies]) { if (e.dead || e.state === 'spawn') continue; const d = Math.hypot(e.x - sx, e.z - sz); if (d < 7.5 + e.r) G.damageEnemy(e, BASE_DMG * run.dmg * 0.9 * run.shock, { kx: (e.x - sx) / (d || 1), kz: (e.z - sz) / (d || 1), knock: 7 }); }
  }
}
G.damageHero = (amt, sx, sz) => {
  const h = hero;
  if (h.state === 'dead' || G.cine > 0 || G.state !== 'play') return;
  if (h.invuln > 0) {
    if (h.state === 'dodge' && !h.perfect) { h.perfect = true; G.slowmo = 0.75; h.empower = 3.2; h.fury = Math.min(100, h.fury + 25); toast('ESQUIVE PARFAITE'); sfx('perfect'); gfx.ring(h.pos.x, h.pos.z, 0.5, 5, 0.5, 0x58c8ff, 3); }
    return;
  }
  amt = Math.round(amt); h.hp -= amt; h.invuln = 0.55; h.blink = 0.55; G.shake(0.5); sfx('hurt'); num(h.pos.x, 2.3, h.pos.z, '-' + amt, 'hero');
  const hu = $('hurt'); hu.style.transition = 'none'; hu.style.opacity = 0.9; requestAnimationFrame(() => { hu.style.transition = ''; hu.style.opacity = ''; });
  const dx = h.pos.x - sx, dz = h.pos.z - sz, d = Math.hypot(dx, dz) || 1; h.kx = (dx / d) * 9; h.kz = (dz / d) * 9;
  fx.burst(h.pos.x, 1.2, h.pos.z, 12, [3.5, 0.3, 0.3], 6, 0.3, 0.4);
  if (h.state === 'attack') { h.state = 'move'; h.comboT = 0; }
  if (h.hp <= 0) { h.hp = 0; h.state = 'dead'; h.t = 0; G.slowmo = 1.1; G.deadT = 1.7; sfx('death'); setCombat(0); }
};

const shotGeo = new THREE.IcosahedronGeometry(0.3, 1);
const shotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.4, 1.6) }), shotMatF = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.6, 4) });
G.shoot = (x, y, z, dx, dz, speed, dmg, owner) => {
  const m = new THREE.Mesh(shotGeo, shotMat); m.position.set(x, y, z); scene.add(m);
  G.shots.push({ m, vx: dx * speed, vz: dz * speed, dmg, owner, life: 4.5, friendly: false }); sfx('shoot');
};
const pickGeo = new THREE.OctahedronGeometry(0.17, 0);
const pickMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.8, 0.3) }), healMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 3.6, 1) });
function dropPick(x, z, value, isHeal) {
  const m = new THREE.Mesh(pickGeo, isHeal ? healMat : pickMat); if (isHeal) m.scale.setScalar(1.7); m.position.set(x, 1, z); scene.add(m);
  const a = Math.random() * TAU, s = 2 + Math.random() * 4;
  G.picks.push({ m, vx: Math.cos(a) * s, vy: 5 + Math.random() * 4, vz: Math.sin(a) * s, t: 0, value, isHeal });
}
function bolt(a, b) {
  const pts = []; const ay = a.def.h * 0.6, by = b.def.h * 0.6;
  for (let i = 0; i <= 8; i++) { const k = i / 8, j = i > 0 && i < 8 ? 0.7 : 0; pts.push(new THREE.Vector3(a.x + (b.x - a.x) * k + (Math.random() - 0.5) * j, ay + (by - ay) * k + (Math.random() - 0.5) * j, a.z + (b.z - a.z) * k + (Math.random() - 0.5) * j)); }
  const m = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: new THREE.Color(2, 5, 8), fog: false }));
  scene.add(m); G.bolts.push({ m, t: 0.13 });
  for (const p of pts) fx.emit(p.x, p.y, p.z, 0, 0, 0, 1, 3, 5, 0.5, 0.2);
}

// ---------------- Héros ----------------
function pickTarget(aim, range = 7) {
  let best = null, bs = 1e9;
  for (const e of G.enemies) {
    if (e.dead || e.state === 'spawn') continue;
    const dx = e.x - hero.pos.x, dz = e.z - hero.pos.z, d = Math.hypot(dx, dz) - e.r; if (d > range) continue;
    const s = d + Math.abs(angDiff(Math.atan2(dx, dz), aim)) * 2.2; if (s < bs) { bs = s; best = e; }
  }
  return best;
}
function startSwing(step, mag, aim) {
  const h = hero; Object.assign(h, { state: 'attack', t: 0, step, queued: false, hitDone: false });
  const dur = SWING[step] / run.aspd, tg = pickTarget(mag > 0.3 ? aim : h.face);
  if (tg) { const dx = tg.x - h.pos.x, dz = tg.z - h.pos.z, d = Math.hypot(dx, dz) - tg.r; h.face = Math.atan2(dx, dz); h.lunge = d > 1.5 ? Math.min(d - 1.3, 3.4) / (0.42 * dur) : 0; }
  else { if (mag > 0.3) h.face = aim; h.lunge = 1.1 / (0.42 * dur); }
  sfx(step === 2 ? 'heavy' : 'slash');
}
const lanceGeo = new THREE.OctahedronGeometry(0.3, 0).scale(0.8, 0.8, 5), lanceMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 1.8, 0.3) });
function useSkill(i, mag, aim) {
  const h = hero; h.cds[i] = SKILL_CD[i] * run.cdr;
  const base = mag > 0.3 ? aim : h.face, tg = pickTarget(base, 16);
  const a = tg && i !== 1 ? Math.atan2(tg.x - h.pos.x, tg.z - h.pos.z) : base;
  if (i === 0) { // Lance de braise
    Object.assign(h, { face: a, state: 'attack', t: 0.12, step: 1, queued: false, hitDone: true, lunge: 0 });
    const m = new THREE.Mesh(lanceGeo, lanceMat); m.position.set(h.pos.x + Math.sin(a) * 1.2, 1.3, h.pos.z + Math.cos(a) * 1.2); m.rotation.y = a; scene.add(m);
    G.lances.push({ m, vx: Math.sin(a) * 36, vz: Math.cos(a) * 36, life: 0.95, hit: new Set() }); sfx('lance'); G.shake(0.2);
  } else if (i === 1) Object.assign(h, { state: 'spin', t: 0, tick: 0, spinA: 0 }); // Tourbillon
  else { Object.assign(h, { face: a, state: 'rush', t: 0, dodgeX: Math.sin(a), dodgeZ: Math.cos(a), invuln: 0.5, hitSet: new Set() }); sfx('rush'); } // Ruée foudroyante
}
function updateHero(dt) {
  const h = hero;
  for (let i = 0; i < 3; i++) h.cds[i] = Math.max(0, h.cds[i] - dt);
  h.invuln = Math.max(0, h.invuln - dt); h.dodgeCd = Math.max(0, h.dodgeCd - dt); h.empower = Math.max(0, h.empower - dt); h.comboT -= dt;
  const mx = input.mx, mz = input.my, mag = Math.min(1, Math.hypot(mx, mz)), aim = Math.atan2(mx, mz);
  let speed = 0, p = 0;
  h.pos.x += h.kx * dt; h.pos.z += h.kz * dt; const kd = Math.exp(-10 * dt); h.kx *= kd; h.kz *= kd;
  if (h.state === 'dead') { h.t += dt; p = h.t; }
  else {
    if (input.fury && h.fury >= 100 && h.state !== 'fury') { Object.assign(h, { state: 'fury', t: 0, hitDone: false, invuln: 1.2, fury: 0 }); sfx('heavy'); }
    else if (input.dodge && h.dodgeCd <= 0 && h.state !== 'fury' && h.state !== 'dodge') {
      const a = mag > 0.2 ? aim : h.face; Object.assign(h, { state: 'dodge', t: 0, dodgeX: Math.sin(a), dodgeZ: Math.cos(a), face: a, invuln: 0.36, perfect: false, dodgeCd: run.dodgeCd }); sfx('dodge');
    } else if (input.skill >= 0 && (h.state === 'move' || h.state === 'attack')) {
      if (h.cds[input.skill] > 0) sfx('nocd'); else useSkill(input.skill, mag, aim);
    } else if (input.atk || input.atkHeld) {
      if (h.state === 'move') startSwing(h.comboT > 0 ? (h.step + 1) % 3 : 0, mag, aim); else if (h.state === 'attack') h.queued = true;
    }
    if (h.state === 'move') {
      if (mag > 0.12) { h.face = angLerp(h.face, aim, dt * 16); h.pos.x += (mx / (Math.hypot(mx, mz) || 1)) * 8.2 * mag * dt; h.pos.z += (mz / (Math.hypot(mx, mz) || 1)) * 8.2 * mag * dt; speed = mag;
        h.stepT -= dt * mag; if (h.stepT <= 0) { h.stepT = 0.29; sfx('step'); fx.emit(h.pos.x, 0.15, h.pos.z, (Math.random() - 0.5) * 1.5, 0.8, (Math.random() - 0.5) * 1.5, 0.3, 0.26, 0.36, 0.7, 0.5, 0, 2); } }
    } else if (h.state === 'attack') {
      h.t += dt / (SWING[h.step] / run.aspd); p = h.t;
      if (p < HITP[h.step]) { h.pos.x += Math.sin(h.face) * h.lunge * dt; h.pos.z += Math.cos(h.face) * h.lunge * dt; }
      if (!h.hitDone && p >= HITP[h.step]) { h.hitDone = true; heroHit(h.step); }
      if (p >= 0.74 && h.queued) startSwing((h.step + 1) % 3, mag, aim);
      else if (p >= 1 || (p > 0.8 && mag > 0.5)) { h.state = 'move'; h.comboT = 0.5; }
    } else if (h.state === 'dodge') {
      h.t += dt / 0.3; p = h.t; const s = 25 * (1 - p * 0.55);
      h.pos.x += h.dodgeX * s * dt; h.pos.z += h.dodgeZ * s * dt;
      fx.emit(h.pos.x, 0.3 + Math.random() * 1.2, h.pos.z, 0, 0.5, 0, 0.5, 0.7, 1.6, 0.6, 0.3);
      if (p >= 1) h.state = 'move';
    } else if (h.state === 'fury') {
      h.t += dt / 0.95; p = h.t;
      if (!h.hitDone && p >= 0.52) {
        h.hitDone = true; G.hitstop = 0.13; G.shake(1.1); sfx('fury');
        gfx.ring(h.pos.x, h.pos.z, 0.5, 11, 0.55, 0xffa040, 4); gfx.scorch(h.pos.x, h.pos.z, 7); gfx.ring(h.pos.x, h.pos.z, 0.3, 7, 0.8, 0xff5020, 3);
        fx.burst(h.pos.x, 0.3, h.pos.z, 110, [4, 1.6, 0.3], 16, 0.6, 0.8, 10, 0.7);
        for (const e of [...G.enemies]) { if (e.dead || e.state === 'spawn') continue; const dx = e.x - h.pos.x, dz = e.z - h.pos.z, d = Math.hypot(dx, dz) || 1; if (d < 10 + e.r) { G.damageEnemy(e, BASE_DMG * run.dmg * 5.5, { crit: true, kx: dx / d, kz: dz / d, knock: 14, heavy: true }); onHit(e); } }
        for (const s of G.shots) s.life = 0;
      }
      if (p >= 1) h.state = 'move';
    } else if (h.state === 'spin') {
      h.t += dt / 1.4; p = h.t; h.spinA += dt * 24; h.tick -= dt;
      if (mag > 0.12) { const l = Math.hypot(mx, mz) || 1; h.pos.x += (mx / l) * 6.4 * mag * dt; h.pos.z += (mz / l) * 6.4 * mag * dt; }
      const sa = h.face + h.spinA; fx.emit(h.pos.x + Math.sin(sa) * 3.2, 1.2, h.pos.z + Math.cos(sa) * 3.2, 0, 1, 0, 3.6, 1.4, 0.3, 0.6, 0.35);
      if (h.tick <= 0) {
        h.tick = 0.2; sfx('spin'); let n = 0;
        for (const e of [...G.enemies]) { if (e.dead || e.state === 'spawn') continue; const dx = e.x - h.pos.x, dz = e.z - h.pos.z, d = Math.hypot(dx, dz) || 1; if (d < 4.2 + e.r) { G.damageEnemy(e, BASE_DMG * run.dmg * run.skill * 0.85, { crit: Math.random() < run.crit, kx: dx / d, kz: dz / d, knock: 3 }); onHit(e); n++; } }
        for (const s of G.shots) if (!s.friendly && Math.hypot(s.m.position.x - h.pos.x, s.m.position.z - h.pos.z) < 4.2) s.life = 0;
        if (n) { h.fury = Math.min(100, h.fury + 3 * run.furyGain); G.shake(0.14); sfx('hit'); }
      }
      if (p >= 1) { h.state = 'move'; h.spinA = 0; }
    } else if (h.state === 'rush') {
      h.t += dt / 0.24; p = h.t; h.pos.x += h.dodgeX * 42 * dt; h.pos.z += h.dodgeZ * 42 * dt;
      for (let k = 0; k < 3; k++) fx.emit(h.pos.x + (Math.random() - 0.5), 0.4 + Math.random() * 1.6, h.pos.z + (Math.random() - 0.5), 0, 0, 0, 0.6, 2.4, 4, 0.7, 0.4);
      for (const e of [...G.enemies]) {
        if (e.dead || e.state === 'spawn' || h.hitSet.has(e)) continue; const dx = e.x - h.pos.x, dz = e.z - h.pos.z, sd = Math.sign(dx * h.dodgeZ - dz * h.dodgeX) || 1;
        if (Math.hypot(dx, dz) < 2.6 + e.r) { h.hitSet.add(e); G.damageEnemy(e, BASE_DMG * run.dmg * run.skill * 4, { crit: true, kx: h.dodgeZ * sd, kz: -h.dodgeX * sd, knock: 8, heavy: true }); onHit(e); G.hitstop = 0.05; G.shake(0.35); sfx('zap'); h.fury = Math.min(100, h.fury + 5 * run.furyGain); }
      }
      if (p >= 1) { h.state = 'move'; h.comboT = 0.5; gfx.ring(h.pos.x, h.pos.z, 0.4, 4.5, 0.4, 0x58c8ff, 3); }
    }
  }
  input.atk = input.dodge = input.fury = false; input.skill = -1;
  const r = Math.hypot(h.pos.x, h.pos.z); if (r > ARENA_R - 0.6) { h.pos.x *= (ARENA_R - 0.6) / r; h.pos.z *= (ARENA_R - 0.6) / r; }
  h.m.root.position.copy(h.pos); h.m.root.rotation.y = h.face + (h.state === 'spin' ? h.spinA : 0);
  h.blink = Math.max(0, (h.blink || 0) - dt); h.m.root.visible = !(h.blink > 0 && Math.floor(h.blink * 20) % 2 === 0);
  h.m.pose({ state: h.state, p, step: h.step, speed, time: G.time }, dt);
  const emp = h.empower > 0;
  h.m.bladeM.color.setRGB(emp ? 1.2 : 4.2, emp ? 3.2 : 1.5, emp ? 5 : 0.3); h.m.swordLight.color.setHex(emp ? 0x48c8ff : 0xff7a2a);
  trail.color = emp ? [0.25, 0.8, 1.5] : [1.3, 0.45, 0.09];
}

// ---------------- Boucle ----------------
function update(dt, rdt) {
  G.time += dt;
  if (G.cine > 0) {
    G.cine -= rdt; if (G.cineT) G.cineT.update(rdt);
    if (G.cine <= 0) document.body.classList.remove('cine');
    hero.m.pose({ state: 'move', p: 0, step: 0, speed: 0, time: G.time }, rdt); return;
  }
  updateHero(G.slowmo > 0 && hero.state !== 'dead' ? dt * 2.4 : dt);
  // apparitions
  if (G.queue.length) {
    G.spawnT -= dt; const alive = G.enemies.filter(e => !e.dead).length;
    if (G.spawnT <= 0 && alive < 8) { G.spawnEnemy(G.queue.shift()); G.spawnT = alive < 2 ? 0.25 : 0.7; }
  }
  for (let i = G.enemies.length - 1; i >= 0; i--) { const e = G.enemies[i]; e.update(dt); if (e.gone) { e.dispose(); G.enemies.splice(i, 1); } }
  // projectiles
  for (let i = G.shots.length - 1; i >= 0; i--) {
    const s = G.shots[i], p = s.m.position; p.x += s.vx * dt; p.z += s.vz * dt; s.life -= dt; s.m.rotation.x += dt * 9;
    const c = s.friendly ? [0.4, 1.8, 3] : [3, 0.3, 1.2]; fx.emit(p.x, p.y, p.z, 0, 0, 0, c[0], c[1], c[2], 0.45, 0.25);
    let hit = s.life <= 0 || Math.hypot(p.x, p.z) > ARENA_R + 4;
    if (!hit && s.friendly) { for (const e of G.enemies) if (!e.dead && e.state !== 'spawn' && Math.hypot(e.x - p.x, e.z - p.z) < e.r + 0.5) { G.damageEnemy(e, BASE_DMG * run.dmg * 2.5, { crit: true, kx: s.vx / 24, kz: s.vz / 24, knock: 6 }); hit = true; break; } }
    else if (!hit && Math.hypot(hero.pos.x - p.x, hero.pos.z - p.z) < 0.85) { const inv = hero.invuln > 0; G.damageHero(s.dmg, p.x - s.vx, p.z - s.vz); hit = !inv; }
    if (hit) { fx.burst(p.x, p.y, p.z, 10, c, 5, 0.3, 0.3); scene.remove(s.m); G.shots.splice(i, 1); }
  }
  // lances de braise
  for (let i = G.lances.length - 1; i >= 0; i--) {
    const l = G.lances[i], p = l.m.position; p.x += l.vx * dt; p.z += l.vz * dt; l.life -= dt; l.m.rotation.z += dt * 20;
    for (let k = 0; k < 3; k++) fx.emit(p.x + (Math.random() - 0.5) * 0.5, p.y + (Math.random() - 0.5) * 0.5, p.z + (Math.random() - 0.5) * 0.5, 0, 0.6, 0, 3.6, 1.4, 0.3, 0.6, 0.35);
    for (const e of [...G.enemies]) if (!e.dead && e.state !== 'spawn' && !l.hit.has(e) && Math.hypot(e.x - p.x, e.z - p.z) < e.r + 1.3) {
      l.hit.add(e); G.damageEnemy(e, BASE_DMG * run.dmg * run.skill * 3.2, { crit: Math.random() < run.crit, kx: l.vx / 36, kz: l.vz / 36, knock: 7, heavy: true }); onHit(e); G.hitstop = 0.04; G.shake(0.25); sfx('hit');
    }
    if (l.life <= 0 || Math.hypot(p.x, p.z) > ARENA_R + 3) { fx.burst(p.x, p.y, p.z, 18, [3.6, 1.4, 0.3], 7, 0.35, 0.4); scene.remove(l.m); G.lances.splice(i, 1); }
  }
  // butin
  const magnet = G.clearT >= 0;
  for (let i = G.picks.length - 1; i >= 0; i--) {
    const k = G.picks[i], p = k.m.position; k.t += dt; k.m.rotation.y += dt * 5;
    const dx = hero.pos.x - p.x, dz = hero.pos.z - p.z, d = Math.hypot(dx, dz) || 0.01;
    if (k.t > 0.45 && (d < 6.5 || magnet) && hero.state !== 'dead') {
      const s = 10 + k.t * 16; p.x += (dx / d) * s * dt; p.z += (dz / d) * s * dt; p.y += (1 - p.y) * dt * 8;
      if (d < 0.9) { if (k.isHeal) { heal(k.value); sfx('heal'); } else { run.coins += k.value; sfx('pickup'); } fx.burst(p.x, p.y, p.z, 5, k.isHeal ? [0.5, 3, 1] : [3.5, 1.6, 0.3], 3, 0.25, 0.3, 0); scene.remove(k.m); G.picks.splice(i, 1); }
    } else { k.vy -= 22 * dt; p.x += k.vx * dt; p.y += k.vy * dt; p.z += k.vz * dt; if (p.y < 0.35) { p.y = 0.35; k.vy *= -0.4; k.vx *= 0.6; k.vz *= 0.6; } }
  }
  for (let i = G.bolts.length - 1; i >= 0; i--) { const b = G.bolts[i]; b.t -= dt; if (b.t <= 0) { scene.remove(b.m); b.m.geometry.dispose(); G.bolts.splice(i, 1); } }
  // fin de vague / mort
  if (hero.state === 'dead') { G.deadT -= rdt; if (G.deadT <= 0) gameOver(); }
  else if (!G.queue.length && !G.enemies.length) {
    if (G.clearT < 0) G.clearT = 1.3;
    else { G.clearT -= dt; if (G.clearT <= 0 && !G.picks.length) offerBoons(); else if (G.clearT < -2) offerBoons(); }
  }
  updateHud();
}
function offerBoons() {
  G.clearT = -1; for (const s of G.shots) scene.remove(s.m); G.shots.length = 0;
  const pool = BOONS.filter(b => (run.taken[b.id] || 0) < (b.max || 99) && !(b.id === 'heal' && hero.hp > hero.maxHp * 0.7));
  const pick = []; while (pick.length < 3 && pool.length) pick.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
  const box = $('cards'); box.innerHTML = '';
  for (const b of pick) {
    const lv = run.taken[b.id] || 0, c = document.createElement('button'); c.className = 'card';
    c.innerHTML = `<span class="ic">${b.ic}︎</span><div><b>${b.n}</b><span>${b.d}</span>${lv ? `<em>NIVEAU ${lv + 1}</em>` : ''}</div>`;
    c.onclick = () => { run.taken[b.id] = lv + 1; b.f(run); sfx('boon'); heal(hero.maxHp * 0.1); if (G.wave > save.best) { save.best = G.wave; } bank(); setState('play'); startWave(G.wave + 1); };
    box.appendChild(c);
  }
  sfx('boon'); setState('boon');
}
function bank() { const t = Math.floor(run.coins); save.coins += t - run.banked; run.banked = t; persist(); }
function gameOver() {
  bank(); if (G.wave - 1 > save.best) save.best = G.wave - 1; persist();
  $('oWave').textContent = G.wave; $('oKills').textContent = run.kills; $('oCoins').textContent = run.banked;
  $('overs').textContent = G.wave - 1 >= save.best && G.wave > 1 ? 'Nouveau record !' : 'Les cendres se souviendront de toi';
  $('revive').disabled = run.revived; $('dbl').disabled = run.doubled || run.banked === 0;
  setState('over');
}

const camPos = new THREE.Vector3(0, 8, 18), camLook = new THREE.Vector3(0, 1.5, 0), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
function updateCamera(rdt, now) {
  const portrait = innerHeight > innerWidth;
  if (G.state === 'menu' || G.state === 'shop') {
    const a = now * 0.00012 + 0.6; tmp.set(Math.sin(a) * (portrait ? 9 : 6.6), portrait ? 2.4 : 1.5, Math.cos(a) * (portrait ? 9 : 6.6)); tmp2.set(0, portrait ? 2.4 : 1.75, 0);
    camPos.lerp(tmp, 1 - Math.exp(-2.5 * rdt)); camLook.lerp(tmp2, 1 - Math.exp(-2.5 * rdt));
  } else {
    const cine = G.cine > 0 && G.cineT, f = cine ? tmp2.set(G.cineT.x, 2.5, G.cineT.z) : tmp2.copy(hero.pos);
    const zoom = cine ? 0.75 : G.slowmo > 0 ? 0.86 : 1;
    tmp.set(f.x * 0.9, (portrait ? 17 : 8.6) * zoom, f.z * 0.88 + (portrait ? 12.5 : 8.6) * zoom);
    camPos.lerp(tmp, 1 - Math.exp(-5 * rdt)); tmp2.y += 1; tmp2.z -= cine ? 0 : 1.2; camLook.lerp(tmp2, 1 - Math.exp(-7 * rdt));
  }
  G.shakeAmp *= Math.exp(-7 * rdt);
  camera.position.set(camPos.x + (Math.random() - 0.5) * G.shakeAmp, camPos.y + (Math.random() - 0.5) * G.shakeAmp, camPos.z + (Math.random() - 0.5) * G.shakeAmp * 0.5);
  camera.lookAt(camLook);
}

let last = performance.now(), fpsT = 0, fpsN = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.05, (now - last) / 1000); last = now;
  let ts = 1;
  if (G.state === 'play') {
    if (G.hitstop > 0) { G.hitstop -= rdt; ts = 0.03; } else if (G.slowmo > 0) { G.slowmo -= rdt; ts = 0.25; }
    update(rdt * ts, rdt);
    if (save.quality === 'auto' && quality !== 'low' && !document.hidden) { // adaptation automatique
      fpsT += rdt; fpsN++;
      if (fpsT > 3) { if (fpsN / fpsT < 40) { quality = quality === 'high' ? 'med' : 'low'; applyQuality(); } fpsT = fpsN = 0; }
    }
  } else if (G.state === 'menu' || G.state === 'shop') {
    G.time += rdt; hero.m.pose({ state: 'move', p: 0, step: 0, speed: 0, time: G.time }, rdt);
  }
  world.mood = G.boss && (G.state === 'play' || G.state === 'pause') ? 1 : 0;
  if (grade) { grade.uniforms.uTime.value = (now / 1000) % 100; grade.uniforms.uFx.value += ((G.state === 'play' && G.slowmo > 0 ? 1 : 0) - grade.uniforms.uFx.value) * Math.min(1, rdt * 8); }
  const live = G.state === 'play' ? rdt * ts : G.state === 'pause' ? 0 : rdt;
  world.update(now / 1000, live, hero.pos); fx.update(live); gfx.update(live);
  const h = hero, sw = (h.state === 'attack' && h.t > 0.12 && h.t < 0.7) || (h.state === 'fury' && h.t > 0.35 && h.t < 0.7) || h.state === 'spin' || h.state === 'rush';
  h.m.root.updateWorldMatrix(true, true);
  trail.push(h.m.base.getWorldPosition(tmp), h.m.tip.getWorldPosition(tmp2), sw ? 1 : 0, now / 1000);
  updateCamera(rdt, now);
  if (quality !== 'low' && composer) composer.render(); else renderer.render(scene, camera);
}

// ---------------- Entrées ----------------
const joyzone = $('joyzone'), joy = $('joy'), joyk = $('joyk'); let jid = null, jox = 0, joy0 = 0;
joyzone.addEventListener('pointerdown', e => {
  initAudio(); if (e.pointerType === 'mouse') { input.atkHeld = true; return; }
  jid = e.pointerId; jox = e.clientX; joy0 = e.clientY; joy.style.left = (jox - 62) + 'px'; joy.style.top = (joy0 - 62) + 'px'; joy.style.bottom = 'auto'; joy.classList.add('on');
  try { joyzone.setPointerCapture(jid); } catch (err) { /* ignore */ }
});
joyzone.addEventListener('pointermove', e => {
  if (e.pointerId !== jid) return;
  let dx = e.clientX - jox, dy = e.clientY - joy0; const l = Math.hypot(dx, dy), m = 50;
  if (l > m) { dx *= m / l; dy *= m / l; }
  input.jx = dx / m; input.jy = dy / m; joyk.style.transform = `translate(${dx}px,${dy}px)`;
});
const jend = e => { if (e.pointerType === 'mouse') { input.atkHeld = false; return; } if (e.pointerId !== jid) return; jid = null; input.jx = input.jy = 0; joyk.style.transform = ''; joy.style.left = joy.style.top = joy.style.bottom = ''; joy.classList.remove('on'); };
joyzone.addEventListener('pointerup', jend); joyzone.addEventListener('pointercancel', jend);
canvas.addEventListener('pointerdown', e => { initAudio(); if (e.pointerType === 'mouse' && G.state === 'play') input.atkHeld = true; });
addEventListener('pointerup', e => { if (e.pointerType === 'mouse') input.atkHeld = false; });
function hold(id, down, up) {
  const el = $(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); el.classList.add('pr'); down(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => { el.classList.remove('pr'); up && up(); });
}
hold('bAtk', () => { input.atk = true; input.atkHeld = true; }, () => { input.atkHeld = false; });
hold('bDodge', () => { input.dodge = true; });
hold('bFury', () => { input.fury = true; });
for (let i = 0; i < 3; i++) hold('bS' + i, () => { input.skill = i; });
const keyMove = () => {
  const k = input.keys, x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0), y = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
  input.kx = x; input.ky = y;
};
addEventListener('keydown', e => {
  if (e.repeat) return; initAudio(); input.keys[e.code] = true; keyMove();
  if (e.code === 'KeyJ') { input.atk = true; input.atkHeld = true; }
  if (e.code === 'KeyK' || e.code === 'Space' || e.code === 'ShiftLeft') { input.dodge = true; e.preventDefault(); }
  if (e.code === 'KeyL' || e.code === 'KeyE') input.fury = true;
  const sk = ['KeyU', 'KeyI', 'KeyO'].indexOf(e.code), dg = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code); if (sk >= 0 || dg >= 0) input.skill = Math.max(sk, dg);
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
});
addEventListener('keyup', e => { input.keys[e.code] = false; keyMove(); if (e.code === 'KeyJ') input.atkHeld = false; });
addEventListener('blur', () => { input.keys = {}; keyMove(); input.atkHeld = false; });
addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play') setState('pause'); });
function readMove() { if (jid !== null) { input.mx = input.jx; input.my = input.jy; } else { const l = Math.hypot(input.kx || 0, input.ky || 0) || 1; input.mx = (input.kx || 0) / l; input.my = (input.ky || 0) / l; } requestAnimationFrame(readMove); }
function togglePause() { if (G.state === 'play') setState('pause'); else if (G.state === 'pause') setState('play'); }

// ---------------- Boutons ----------------
const click = (id, fn) => $(id).addEventListener('click', () => { initAudio(); sfx('click'); fn(); });
click('play', newRun); click('again', newRun);
click('toShop', () => setState('shop')); click('shopBack', () => setState('menu'));
click('pause', togglePause); click('resume', togglePause);
const toMenu = () => { if (run) bank(); clearField(); hero.pos.set(0, 0, 0); hero.state = 'move'; hero.face = 0.6; hero.m.root.visible = true; setState('menu'); };
click('quit', toMenu); click('toMenu', toMenu);
click('snd', () => { save.sound = !save.sound; setSound(save.sound); persist(); refreshMenu(); });
click('qual', () => { save.quality = { auto: 'high', high: 'low', low: 'auto' }[save.quality]; quality = save.quality === 'low' ? 'low' : 'high'; applyQuality(); persist(); refreshMenu(); });
click('revive', async () => {
  if (!(await showRewardedAd())) return;
  run.revived = true; Object.assign(hero, { hp: Math.round(hero.maxHp * 0.6), state: 'move', invuln: 2.5, blink: 2.5, kx: 0, kz: 0 }); G.deadT = -1; G.slowmo = 0;
  gfx.ring(hero.pos.x, hero.pos.z, 0.5, 12, 0.6, 0xffd070, 4); sfx('fury');
  for (const e of G.enemies) { const dx = e.x - hero.pos.x, dz = e.z - hero.pos.z, d = Math.hypot(dx, dz) || 1; e.kx += (dx / d) * 16; e.kz += (dz / d) * 16; e.stagger(1); }
  for (const s of G.shots) s.life = 0;
  setState('play');
});
click('dbl', async () => { if (!(await showRewardedAd())) return; run.doubled = true; save.coins += run.banked; persist(); $('oCoins').textContent = run.banked * 2; $('dbl').disabled = true; sfx('boon'); });

setSound(save.sound); setState('menu'); hero.face = 0.6;
requestAnimationFrame(readMove); requestAnimationFrame(frame);
if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window) navigator.serviceWorker.register('sw.js').catch(() => {});
window.__G = G; window.__hero = hero; window.__input = input; G.startWave = startWave;
