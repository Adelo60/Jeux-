import * as THREE from 'three';
import { ARENA_R } from './world.js';

const PI = Math.PI;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true, ...o });
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; if (parent) parent.add(m); return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function pivot(x, y, z, parent) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// =================== HÉROS ===================
export function buildHero() {
  const root = new THREE.Group();
  const armor = std(0x5a6688, { roughness: 0.3, metalness: 0.85 });
  const darkM = std(0x15161f, { roughness: 0.8 });
  const gold = std(0xe6ac48, { roughness: 0.24, metalness: 1, emissive: 0x2a1600 });
  const cloth = std(0x8f1626, { roughness: 0.95, side: THREE.DoubleSide });
  const bladeM = glow(4.2, 1.5, 0.3);

  const body = pivot(0, 0.95, 0, root);
  const legL = pivot(-0.19, 0, 0, body), legR = pivot(0.19, 0, 0, body);
  for (const l of [legL, legR]) {
    mesh(box(0.24, 0.55, 0.28), darkM, 0, -0.27, 0, l);
    mesh(box(0.26, 0.45, 0.32), armor, 0, -0.7, 0.01, l);
    mesh(box(0.27, 0.12, 0.42), darkM, 0, -0.9, 0.06, l);
  }
  const torso = pivot(0, 0, 0, body);
  mesh(new THREE.CylinderGeometry(0.46, 0.3, 0.78, 6), armor, 0, 0.42, 0, torso);
  mesh(box(0.66, 0.14, 0.42), gold, 0, 0.05, 0, torso);
  mesh(box(0.2, 0.3, 0.06), gold, 0, 0.5, 0.36, torso);
  mesh(new THREE.OctahedronGeometry(0.09, 0), glow(4, 1.5, 0.3), 0, 0.52, 0.41, torso).castShadow = false;
  mesh(box(0.3, 0.6, 0.03), cloth, 0, -0.3, 0.2, torso);
  mesh(box(0.3, 0.05, 0.035), gold, 0, -0.56, 0.2, torso);
  for (const sx of [-1, 1]) mesh(new THREE.ConeGeometry(0.08, 0.34, 4), gold, sx * 0.62, 0.95, 0, torso).rotation.z = -sx * 0.5;
  root.scale.setScalar(1.08);
  const head = pivot(0, 0.98, 0, torso);
  mesh(new THREE.IcosahedronGeometry(0.22, 1), darkM, 0, 0.05, 0, head);
  mesh(new THREE.ConeGeometry(0.3, 0.42, 6), armor, 0, 0.2, -0.03, head);
  mesh(box(0.26, 0.045, 0.05), glow(3, 1.6, 0.5), 0, 0.06, 0.2, head).castShadow = false;
  const armL = pivot(-0.56, 0.7, 0, torso), armR = pivot(0.56, 0.7, 0, torso);
  for (const a of [armL, armR]) {
    mesh(new THREE.IcosahedronGeometry(0.24, 0), gold, 0, 0.04, 0, a).scale.set(1.1, 0.8, 1.1);
    mesh(box(0.18, 0.4, 0.2), darkM, 0, -0.22, 0, a);
    mesh(box(0.2, 0.34, 0.22), armor, 0, -0.56, 0, a);
  }
  // bouclier léger au bras gauche
  mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 6), gold, -0.14, -0.5, 0, armL).rotation.z = PI / 2;
  // épée
  const sword = pivot(0, -0.74, 0, armR);
  mesh(box(0.06, 0.3, 0.06), darkM, 0, 0.02, 0, sword);
  mesh(box(0.44, 0.07, 0.12), gold, 0, 0.2, 0, sword);
  const blade = mesh(box(0.11, 1.55, 0.035), bladeM, 0, 1.0, 0, sword); blade.castShadow = false;
  const tip = pivot(0, 1.85, 0, sword), base = pivot(0, 0.3, 0, sword);
  const swordLight = new THREE.PointLight(0xff7a2a, 14, 9, 1.8); swordLight.position.y = 1; sword.add(swordLight);
  // cape
  const capeGeo = new THREE.PlaneGeometry(0.95, 1.35, 4, 6); capeGeo.translate(0, -0.675, 0);
  const cape = mesh(capeGeo, cloth, 0, 0.82, -0.3, torso);
  const capeRest = capeGeo.attributes.position.array.slice();

  const cur = { lL: 0, lR: 0, aL: 0, aR: 0, tw: 0, lean: 0, sw: PI / 2, y: 0.95, aRz: 0, aLz: 0, hd: 0 };
  let phase = 0;

  function pose(s, dt) {
    let t = { lL: 0, lR: 0, aL: 0.1, aR: -0.25, tw: 0, lean: 0, sw: PI / 2 + 0.3, y: 0.95 + Math.sin(s.time * 2) * 0.012, aRz: 0.12, aLz: -0.12, hd: 0 };
    let rate = 22, roll = 0, fall = 0;
    if (s.state === 'move' && s.speed > 0.05) {
      phase += dt * 13 * s.speed;
      const w = Math.sin(phase) * 0.95 * s.speed;
      t.lL = w; t.lR = -w; t.aL = -w * 0.8; t.aR = -0.35 + w * 0.25; t.lean = 0.2 * s.speed;
      t.y = 0.95 + Math.abs(Math.cos(phase)) * 0.09 * s.speed - 0.04;
    } else if (s.state === 'attack') {
      const p = s.p, k = smooth(0.18, 0.5, p); rate = 38;
      t.lL = 0.45; t.lR = -0.4; t.lean = 0.16; t.y = 0.88;
      if (s.step === 0) { t.tw = lerp(1.15, -1.25, k); t.aR = -1.4; t.sw = PI / 2 + 1.1; t.aRz = 0.5; t.aL = 0.5; }
      else if (s.step === 1) { t.tw = lerp(-1.25, 1.2, k); t.aR = -1.45; t.sw = PI / 2 + 1.15; t.aRz = -0.3; t.aL = 0.4; }
      else { t.aR = lerp(-3.1, -0.75, k); t.sw = lerp(2.3, 2.95, k); t.lean = lerp(-0.25, 0.5, k); t.y = 0.9 + Math.sin(Math.min(1, p * 1.6) * PI) * 0.55; t.aL = lerp(-2.6, -0.4, k); t.lL = 0.6; t.lR = -0.7; }
    } else if (s.state === 'dodge') {
      roll = s.p * PI * 2; t.y = 0.95 - Math.sin(s.p * PI) * 0.4; t.lL = 1.3; t.lR = 1.3; t.aL = -1; t.aR = -1; rate = 40;
    } else if (s.state === 'fury') {
      const p = s.p, k = smooth(0.4, 0.55, p); rate = 40;
      t.y = 0.95 + Math.sin(Math.min(1, p / 0.5) * PI) * 2.4 * (p < 0.5 ? 1 : 0);
      t.aR = lerp(-3.1, -0.5, k); t.aL = lerp(-3.1, -0.5, k); t.sw = lerp(2.0, 3.0, k); t.lean = lerp(-0.3, 0.6, k);
      t.lL = lerp(-0.8, 0.5, k); t.lR = lerp(-0.6, -0.5, k);
    } else if (s.state === 'spin') {
      rate = 30; t.aR = -1.5; t.aRz = 0.2; t.sw = PI / 2 + 1.45; t.aL = -1.2; t.aLz = -1.2; t.lean = 0.12; t.lL = 0.35; t.lR = -0.35; t.y = 0.88;
    } else if (s.state === 'rush') {
      rate = 45; t.aR = -1.45; t.sw = PI / 2 + 1.4; t.aL = 0.9; t.lean = 0.75; t.lL = 0.9; t.lR = -0.9; t.y = 0.8;
    } else if (s.state === 'dead') {
      fall = Math.min(1, s.p * 1.6); t.y = lerp(0.95, 0.3, fall); t.aR = -0.4; t.aL = 0.6; t.hd = 0.5;
    }
    const a = 1 - Math.exp(-rate * dt);
    for (const k in cur) cur[k] += (t[k] - cur[k]) * a;
    legL.rotation.x = cur.lL; legR.rotation.x = cur.lR;
    armL.rotation.set(cur.aL, 0, cur.aLz); armR.rotation.set(cur.aR, 0, cur.aRz);
    torso.rotation.y = cur.tw; sword.rotation.x = cur.sw; head.rotation.x = cur.hd;
    body.position.y = cur.y; body.rotation.x = cur.lean + roll - fall * 1.5;
    // cape
    const pa = capeGeo.attributes.position.array, sp = s.state === 'dodge' ? 0.3 : s.state === 'rush' || s.state === 'spin' ? 1 : s.speed;
    for (let i = 0; i < pa.length; i += 3) {
      const v = -capeRest[i + 1] / 1.35;
      pa[i + 2] = capeRest[i + 2] - v * v * (0.22 + sp * 0.75) + Math.sin(s.time * (5 + sp * 6) + v * 4 + capeRest[i] * 3) * 0.07 * v * (0.5 + sp);
      pa[i + 1] = capeRest[i + 1] + v * v * sp * 0.35;
    }
    capeGeo.attributes.position.needsUpdate = true; capeGeo.computeVertexNormals();
  }
  return { root, pose, tip, base, swordLight, bladeM };
}

// =================== ENNEMIS ===================
export const DEF = {
  grunt: { hp: 30, speed: 4.5, r: 0.65, dmg: 10, braise: 2, h: 1.9 },
  caster: { hp: 24, speed: 3.3, r: 0.6, dmg: 9, braise: 3, h: 2.6 },
  brute: { hp: 125, speed: 2.7, r: 1.25, dmg: 22, braise: 7, h: 3.1 },
  boss: { hp: 700, speed: 3.4, r: 2.3, dmg: 26, braise: 50, h: 5.6 },
};

function buildEnemyModel(type) {
  const g = new THREE.Group(), parts = {};
  if (type === 'grunt') {
    const bm = std(0x2a1838, { roughness: 0.34, metalness: 0.5 }), ac = glow(3.4, 0.25, 0.9);
    parts.bodyMat = bm;
    const b = pivot(0, 1.0, 0, g); parts.body = b;
    mesh(new THREE.IcosahedronGeometry(0.55, 0), bm, 0, 0, 0, b).scale.set(1, 1.25, 0.85);
    const hd = mesh(new THREE.IcosahedronGeometry(0.3, 0), bm, 0, 0.72, 0.22, b);
    for (const sx of [-1, 1]) { mesh(new THREE.SphereGeometry(0.055, 6, 4), ac, sx * 0.12, 0.04, 0.26, hd).castShadow = false; mesh(new THREE.ConeGeometry(0.07, 0.4, 4), bm, sx * 0.17, 0.3, -0.05, hd).rotation.z = -sx * 0.4; }
    for (let i = 0; i < 3; i++) mesh(new THREE.ConeGeometry(0.11, 0.55, 4), bm, 0, 0.5 - i * 0.32, -0.42, b).rotation.x = -1.1;
    parts.armL = pivot(-0.55, 0.35, 0.05, b); parts.armR = pivot(0.55, 0.35, 0.05, b);
    for (const a of [parts.armL, parts.armR]) { mesh(box(0.17, 0.95, 0.19), bm, 0, -0.45, 0, a); mesh(new THREE.ConeGeometry(0.1, 0.5, 4), ac, 0, -1.1, 0.04, a).rotation.x = PI; }
    parts.legL = pivot(-0.24, 0.55, 0, g); parts.legR = pivot(0.24, 0.55, 0, g);
    for (const l of [parts.legL, parts.legR]) mesh(box(0.2, 0.58, 0.24), bm, 0, -0.27, 0, l);
  } else if (type === 'caster') {
    const bm = std(0x14263a, { roughness: 0.3, metalness: 0.55 }), ac = glow(0.4, 2.6, 3.6);
    parts.bodyMat = bm;
    const b = pivot(0, 0.5, 0, g); parts.body = b;
    mesh(new THREE.ConeGeometry(0.62, 1.9, 6), bm, 0, 0.95, 0, b);
    const hd = mesh(new THREE.OctahedronGeometry(0.3, 0), bm, 0, 2.05, 0, b);
    mesh(new THREE.SphereGeometry(0.09, 8, 6), ac, 0, 0, 0.24, hd).castShadow = false;
    const halo = mesh(new THREE.TorusGeometry(0.46, 0.03, 4, 20), ac, 0, 2.3, -0.1, b); halo.castShadow = false;
    parts.orbit = pivot(0, 1.3, 0, b);
    for (let i = 0; i < 3; i++) { const a = i * 2.094; mesh(new THREE.OctahedronGeometry(0.15, 0), ac, Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95, parts.orbit).castShadow = false; }
  } else {
    const boss = type === 'boss';
    const bm = std(boss ? 0x3a141c : 0x271c36, { roughness: 0.32, metalness: 0.55 }), ac = boss ? glow(4.5, 1.3, 0.2) : glow(3.6, 0.5, 0.25);
    parts.bodyMat = bm;
    const b = pivot(0, 1.55, 0, g); parts.body = b;
    mesh(new THREE.DodecahedronGeometry(1.0, 0), bm, 0, 0, 0, b).scale.set(1.15, 1.1, 0.9);
    for (let i = 0; i < 3; i++) mesh(box(0.07, 0.5 - i * 0.1, 0.05), ac, (i - 1) * 0.3, 0.15, 0.86, b).castShadow = false;
    const hd = mesh(new THREE.IcosahedronGeometry(0.38, 0), bm, 0, 1.1, 0.3, b);
    for (const sx of [-1, 1]) { mesh(new THREE.SphereGeometry(0.07, 6, 4), ac, sx * 0.15, 0.03, 0.33, hd).castShadow = false; mesh(new THREE.ConeGeometry(0.13, 0.85, 5), bm, sx * 0.34, 0.36, 0, hd).rotation.z = -sx * 0.7; }
    if (boss) for (let i = 0; i < 5; i++) { const a = (i / 4 - 0.5) * 2.2; mesh(new THREE.ConeGeometry(0.09, 0.7, 4), ac, Math.sin(a) * 0.9, 1.0 + Math.cos(a) * 0.5, -0.35, b).rotation.z = -a; }
    parts.armL = pivot(-1.25, 0.55, 0, b); parts.armR = pivot(1.25, 0.55, 0, b);
    for (const a of [parts.armL, parts.armR]) {
      mesh(new THREE.IcosahedronGeometry(0.48, 0), bm, 0, 0, 0, a);
      mesh(box(0.42, 1.3, 0.46), bm, 0, -0.75, 0, a);
      mesh(new THREE.IcosahedronGeometry(0.46, 0), bm, 0, -1.55, 0, a);
      mesh(box(0.44, 0.08, 0.48), ac, 0, -1.15, 0, a).castShadow = false;
    }
    parts.legL = pivot(-0.5, 0.75, 0, g); parts.legR = pivot(0.5, 0.75, 0, g);
    for (const l of [parts.legL, parts.legR]) mesh(box(0.45, 0.8, 0.5), bm, 0, -0.38, 0, l);
    if (boss) g.scale.setScalar(1.85);
  }
  // barre de vie
  const bar = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: false, fog: false }));
  const fgGeo = new THREE.PlaneGeometry(1.06, 0.08); fgGeo.translate(0.53, 0, 0);
  const fg = new THREE.Mesh(fgGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.25, 0.3), depthTest: false, fog: false }));
  fg.position.set(-0.53, 0, 0.001); bg.renderOrder = 8; fg.renderOrder = 9;
  bar.add(bg, fg); bar.visible = false; parts.bar = bar; parts.barFg = fg;
  return { g, parts };
}

const angLerp = (a, b, t) => { let d = ((b - a + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI; return a + d * Math.min(1, t); };

export class Enemy {
  constructor(type, G, x, z, hpMul = 1, dmgMul = 1) {
    const d = DEF[type];
    Object.assign(this, { type, G, x, z, def: d, r: d.r, hp: d.hp * hpMul, maxHp: d.hp * hpMul, dmg: d.dmg * dmgMul });
    this.state = 'spawn'; this.t = 0; this.face = Math.atan2(G.hero.pos.x - x, G.hero.pos.z - z);
    this.kx = 0; this.kz = 0; this.flash = 0; this.cd = 0.3 + Math.random() * 0.8; this.ph = Math.random() * 9;
    this.burnT = 0; this.burnDps = 0; this.burnAcc = 0; this.dead = false; this.gone = false; this.y = 0; this.hitDone = false;
    this.summoned = false; this.strafe = Math.random() < 0.5 ? 1 : -1; this.tele = null;
    const { g, parts } = buildEnemyModel(type); this.g = g; this.parts = parts;
    this.baseScale = g.scale.x;
    G.scene.add(g); G.scene.add(parts.bar);
  }
  dispose() { this.G.scene.remove(this.g); this.G.scene.remove(this.parts.bar); this.G.gfx.cancel(this.tele); }
  set(state, t = 0) { this.state = state; this.t = t; this.hitDone = false; }
  stagger(dur) {
    if (this.type === 'brute' || this.type === 'boss' || this.dead || this.state === 'spawn') return;
    this.G.gfx.cancel(this.tele); this.set('stagger', dur);
  }
  update(dt) {
    const G = this.G, h = G.hero, P = this.parts;
    let dx = h.pos.x - this.x, dz = h.pos.z - this.z; const d = Math.hypot(dx, dz) || 0.001; dx /= d; dz /= d;
    const toHero = Math.atan2(dx, dz), fx = Math.sin(this.face), fz = Math.cos(this.face);
    const big = this.type === 'brute' || this.type === 'boss';
    this.flash = Math.max(0, this.flash - dt * 7);
    let glowR = this.flash * 1.6, glowG = this.flash * 1.6, glowB = this.flash * 1.6;
    if (this.burnT > 0 && !this.dead) {
      this.burnT -= dt; this.burnAcc += this.burnDps * dt; glowR += 0.5; glowG += 0.12;
      if (Math.random() < dt * 30) G.fx.emit(this.x + (Math.random() - 0.5) * this.r, 0.6 + Math.random() * this.def.h * 0.6, this.z + (Math.random() - 0.5) * this.r, 0, 2, 0, 3.5, 1.2, 0.2, 0.4, 0.4, -2);
      if (this.burnAcc >= 3) { const v = Math.floor(this.burnAcc); this.burnAcc -= v; G.damageEnemy(this, v, { dot: true }); }
    }
    let speed = 0, armL = 0, armR = 0, lean = 0;
    const move = (mx, mz, s) => { this.x += mx * s * dt; this.z += mz * s * dt; speed = s; };
    switch (this.state) {
      case 'spawn': {
        this.t += dt; const k = Math.min(1, this.t / 0.85);
        this.y = -(this.def.h + 0.3) * (1 - k) * (1 - k);
        if (Math.random() < dt * 60) G.fx.emit(this.x + (Math.random() - 0.5) * this.r * 2, 0.1, this.z + (Math.random() - 0.5) * this.r * 2, 0, 2 + Math.random() * 3, 0, 1.6, 0.3, 2.4, 0.4, 0.6, 0, 1);
        if (k >= 1) { this.y = 0; this.set('chase'); if (Math.random() < 0.4) G.sfx('growl'); }
        break;
      }
      case 'stagger': this.t -= dt; lean = -0.35; if (this.t <= 0) this.set('chase'); break;
      case 'dying': {
        this.t += dt; const k = Math.min(1, this.t / 0.55);
        this.g.scale.setScalar(this.baseScale * (1 - k * 0.6)); this.y = -k * this.def.h * 0.7; lean = -k * 1.2;
        if (k >= 1) this.gone = true;
        break;
      }
      case 'chase': {
        this.face = angLerp(this.face, toHero, dt * (big ? 4 : 9)); this.cd -= dt;
        if (this.type === 'grunt') {
          if (d > 1.9) move(dx, dz, this.def.speed);
          if (d < 2.3 && this.cd <= 0) this.set('windup', 0.45);
        } else if (this.type === 'caster') {
          if (d < 7) move(-dx, -dz, this.def.speed); else if (d > 13) move(dx, dz, this.def.speed);
          else move(-dz * this.strafe, dx * this.strafe, this.def.speed * 0.6);
          if (Math.hypot(this.x, this.z) > ARENA_R - 1.5) this.strafe *= -1;
          if (this.cd <= 0 && d < 18) this.set('windup', 0.7);
        } else if (this.type === 'brute') {
          if (d > 3) move(dx, dz, this.def.speed);
          if (d < 3.8 && this.cd <= 0) { this.set('windup', 0.95); this.tx = this.x + fx * 1.6; this.tz = this.z + fz * 1.6; this.tele = G.gfx.circle(this.tx, this.tz, 4.3, 0.95); }
        } else { // boss
          if (!this.summoned && this.hp < this.maxHp * 0.5) {
            this.summoned = true; G.gfx.ring(this.x, this.z, 1, 14, 0.7, 0xff3a6a, 3); G.shake(0.6); G.sfx('roar');
            for (let i = 0; i < 3; i++) G.spawnEnemy('grunt');
          }
          if (d > 4) move(dx, dz, this.def.speed);
          if (this.cd <= 0) {
            const r = Math.random();
            if (d < 6.5 && r < 0.6) { this.atk = 'slam'; this.set('windup', 1.0); this.tx = this.x + fx * 2.5; this.tz = this.z + fz * 2.5; this.tele = G.gfx.circle(this.tx, this.tz, 6.5, 1.0); }
            else if (r < 0.55 || d > 12) { this.atk = 'charge'; this.set('windup', 0.9); this.face = toHero; this.tele = G.gfx.rect(this.x, this.z, toHero, 5, 19, 0.9); }
            else { this.atk = 'orbs'; this.set('windup', 0.8); }
          }
        }
        break;
      }
      case 'windup': {
        this.t -= dt; glowR += 0.55 * (0.5 + 0.5 * Math.sin(this.ph + G.time * 30));
        if (this.type === 'grunt') { this.face = angLerp(this.face, toHero, dt * 5); armL = armR = -2.4; lean = -0.25; }
        else if (this.type === 'caster') { this.face = angLerp(this.face, toHero, dt * 8); P.orbit.rotation.y += dt * 14; }
        else if (this.atk === 'charge') { lean = -0.3; armL = armR = 0.8; }
        else if (this.atk === 'orbs') { armL = armR = -1.5; }
        else { armL = armR = -2.9; lean = -0.3; }
        if (this.t <= 0) {
          if (this.type === 'grunt') { this.set('strike', 0.2); G.sfx('swipe'); }
          else if (this.type === 'caster') { G.shoot(this.x + fx * 0.8, 1.6, this.z + fz * 0.8, dx, dz, 11, this.dmg, this); this.cd = 2.2 + Math.random() * 1.4; this.set('chase'); }
          else if (this.type === 'boss' && this.atk === 'charge') { this.set('strike', 0.62); G.sfx('roar'); }
          else if (this.type === 'boss' && this.atk === 'orbs') {
            for (let i = 0; i < 12; i++) { const a = this.face + (i / 12) * PI * 2; G.shoot(this.x + Math.sin(a) * 2.4, 1.5, this.z + Math.cos(a) * 2.4, Math.sin(a), Math.cos(a), 8.5, this.dmg * 0.5, this); }
            this.set('recover', 0.8);
          } else { // slam
            const R = this.type === 'boss' ? 6.5 : 4.3;
            G.gfx.ring(this.tx, this.tz, 0.5, R * 1.25, 0.45, 0xff5a2a, 3); G.gfx.scorch(this.tx, this.tz, R * 0.9); G.fx.burst(this.tx, 0.2, this.tz, 40, [3, 1, 0.3], 11, 0.5, 0.6, 14, 0.8);
            G.shake(this.type === 'boss' ? 0.9 : 0.55); G.sfx('slam');
            if (Math.hypot(h.pos.x - this.tx, h.pos.z - this.tz) < R) G.damageHero(this.dmg, this.x, this.z);
            this.set('recover', this.type === 'boss' ? 1.0 : 1.15);
          }
        }
        break;
      }
      case 'strike': {
        this.t -= dt;
        if (this.type === 'grunt') {
          move(fx, fz, 10); armL = armR = -1.0; lean = 0.4;
          if (!this.hitDone && d < 2.0) { this.hitDone = true; G.damageHero(this.dmg, this.x, this.z); }
          if (this.t <= 0) { this.cd = 0.5 + Math.random() * 0.9; this.set('recover', 0.5); }
        } else { // charge du boss
          move(fx, fz, 30); lean = 0.5; armL = armR = 0.9;
          G.fx.emit(this.x, 0.2, this.z, 0, 2, 0, 3, 0.8, 0.2, 0.7, 0.4);
          if (!this.hitDone && d < 3.4) { this.hitDone = true; G.damageHero(this.dmg, this.x, this.z); G.shake(0.6); }
          if (this.t <= 0 || Math.hypot(this.x, this.z) > ARENA_R - 1) this.set('recover', 0.9);
        }
        break;
      }
      case 'recover': this.t -= dt; lean = 0.2; if (this.t <= 0) { if (big) this.cd = 0.7 + Math.random() * 0.8; this.set('chase'); } break;
    }
    // recul + séparation + limites
    this.x += this.kx * dt; this.z += this.kz * dt; const kd = Math.exp(-9 * dt); this.kx *= kd; this.kz *= kd;
    if (!this.dead && this.state !== 'spawn') for (const o of G.enemies) {
      if (o === this || o.dead) continue;
      const ox = this.x - o.x, oz = this.z - o.z, od = Math.hypot(ox, oz), min = this.r + o.r;
      if (od < min && od > 0.001) { const p = (min - od) * (this.r < o.r ? 0.8 : 0.35); this.x += (ox / od) * p; this.z += (oz / od) * p; }
    }
    if (!this.dead && this.state !== 'strike' && d < this.r + 0.5) { this.x -= dx * (this.r + 0.5 - d); this.z -= dz * (this.r + 0.5 - d); }
    const rr = Math.hypot(this.x, this.z), lim = ARENA_R - this.r * 0.5;
    if (rr > lim) { this.x *= lim / rr; this.z *= lim / rr; }
    // pose
    const walk = Math.sin(G.time * (big ? 6 : 11) + this.ph) * Math.min(1, speed / 3);
    if (P.legL) { P.legL.rotation.x = walk * 0.7; P.legR.rotation.x = -walk * 0.7; }
    const a = 1 - Math.exp(-18 * dt);
    if (P.armL) {
      P.armL.rotation.x += (armL + walk * 0.5 - P.armL.rotation.x) * a; P.armR.rotation.x += (armR - walk * 0.5 - P.armR.rotation.x) * a;
      P.body.rotation.x += (lean + (speed > 0 ? 0.15 : 0) - P.body.rotation.x) * a;
    } else { P.orbit.rotation.y += dt * 2.2; P.body.position.y = 0.5 + Math.sin(G.time * 2.4 + this.ph) * 0.18; P.body.rotation.x += (lean - P.body.rotation.x) * a; }
    P.bodyMat.emissive.setRGB(glowR, glowG, glowB);
    this.g.position.set(this.x, this.y, this.z); this.g.rotation.y = this.face;
    const bar = P.bar;
    bar.visible = !this.dead && this.type !== 'boss' && this.hp < this.maxHp;
    if (bar.visible) { bar.position.set(this.x, this.def.h + 0.45, this.z); bar.quaternion.copy(G.camera.quaternion); P.barFg.scale.x = Math.max(0.001, this.hp / this.maxHp); }
  }
}
