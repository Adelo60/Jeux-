import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { ARENA_R } from './world.js';
import { assets } from './assets.js';

const PI = Math.PI;
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
const findBone = (root, name) => { let b = null; root.traverse(n => { if (!b && new RegExp('^mixamorig\\d*:?' + name + '$').test(n.name)) b = n; }); return b; };

// Mélangeur d'animations : fondu entre clips, lecture libre ou pilotée par le jeu (time)
function animator(root, clips, start) {
  const mixer = new THREE.AnimationMixer(root), acts = {};
  for (const k in clips) { const a = mixer.clipAction(clips[k]); a.play(); a.weight = k === start ? 1 : 0; acts[k] = a; }
  let cur = start;
  return {
    dur: k => clips[k].duration,
    set(name, dt, time, rate = 12, speed = 1) {
      const f = 1 - Math.exp(-rate * dt);
      for (const k in acts) { const a = acts[k]; a.weight += ((k === name ? 1 : 0) - a.weight) * f; if (a.weight < 0.002 && k !== name) a.weight = 0; }
      const a = acts[name];
      if (name !== cur) { cur = name; if (time === undefined) a.time = 0; }
      if (time !== undefined) { a.time = Math.min(clips[name].duration - 0.02, Math.max(0, time)); a.timeScale = 0; } else a.timeScale = speed;
      mixer.update(dt);
    },
  };
}

// =================== HÉROS ===================
function makeSword() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xcfd6e4, metalness: 1, roughness: 0.18 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe6ac48, metalness: 1, roughness: 0.28 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.8 });
  const bladeM = glow(4.2, 1.5, 0.3);
  const add = (geo, mat, y, sh = true) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = sh; g.add(m); return m; };
  const blade = add(new THREE.CylinderGeometry(0.012, 0.062, 1.08, 4, 1), steel, 0.68); blade.scale.z = 0.22; blade.rotation.y = PI / 4;
  add(new THREE.BoxGeometry(0.016, 0.86, 0.024), bladeM, 0.6, false); // gouttière incandescente
  const guard = add(new THREE.BoxGeometry(0.34, 0.045, 0.07), gold, 0.12);
  for (const sx of [-1, 1]) { const t = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), gold); t.position.set(sx * 0.17, 0.12, 0); g.add(t); }
  add(new THREE.CylinderGeometry(0.022, 0.026, 0.2, 10), leather, 0);
  add(new THREE.SphereGeometry(0.042, 12, 10), gold, -0.12);
  const tip = new THREE.Object3D(); tip.position.y = 1.24; const base = new THREE.Object3D(); base.position.y = 0.2; g.add(tip, base);
  const light = new THREE.PointLight(0xff7a2a, 10, 8, 1.8); light.position.y = 0.7; g.add(light);
  return { g, tip, base, light, bladeM, guard };
}

export function buildHero() {
  const A = assets.paladin, model = SkeletonUtils.clone(A.scene), mats = new Map();
  model.traverse(o => { if (o.isMesh) { if (!mats.has(o.material)) { const m = o.material.clone(); m.metalness = 0.7; m.roughness = 0.4; m.envMapIntensity = 2.6; m.color.setScalar(1.5); mats.set(o.material, m); } o.material = mats.get(o.material); } });
  model.updateMatrixWorld(true);
  // Épée dans la main droite, placée en pose de repos (bras à l'horizontale, lame vers l'avant)
  const S = makeSword(), hand = findBone(model, 'RightHand'), hp = hand.getWorldPosition(new THREE.Vector3());
  S.g.position.set(hp.x - 0.1, hp.y - 0.03, hp.z + 0.02); S.g.rotation.x = PI / 2; model.add(S.g); S.g.updateMatrixWorld(true); hand.attach(S.g);
  // Bouclier sanglé sur l'avant-bras gauche
  { const SH = assets.shield, sh = SH.scene.clone(), wrap = new THREE.Group(), fa = findBone(model, 'LeftForeArm'), lh = findBone(model, 'LeftHand');
    const k = 0.74 / Math.max(SH.size.x, SH.size.y, SH.size.z), a = fa.getWorldPosition(new THREE.Vector3()), b = lh.getWorldPosition(new THREE.Vector3());
    sh.scale.setScalar(k); sh.position.set(-(SH.min.x + SH.size.x / 2) * k, -(SH.min.y + SH.size.y / 2) * k, -(SH.min.z + SH.size.z / 2) * k); wrap.add(sh);
    wrap.position.copy(a).lerp(b, 0.6); wrap.position.y += 0.07; wrap.rotation.set(-PI / 2, 0, 0); model.add(wrap); wrap.updateMatrixWorld(true); fa.attach(wrap); }
  const SC = 1.95 / A.height, root = new THREE.Group(), pivot = new THREE.Group(), holder = new THREE.Group();
  holder.add(model); holder.scale.setScalar(SC); holder.position.y = -1; pivot.position.y = 1; pivot.add(holder); root.add(pivot);
  const key = new THREE.PointLight(0xffe2c4, 26, 11, 1.6); key.position.set(0, 3.4, 2.6); root.add(key);
  const anim = animator(model, A.clips, 'idle');

  function pose(s, dt) {
    let name = 'idle', time, rate = 10, speed = 1, roll = 0, jy = 0, lean = 0;
    if (s.state === 'move') { if (s.speed > 0.05) { name = 'run'; speed = 0.7 + 0.5 * s.speed; rate = 14; } }
    else if (s.state === 'attack') { name = 's' + s.step; time = Math.min(1, s.p) * anim.dur(name); rate = 30; }
    else if (s.state === 'dodge') { name = 'jump'; time = s.p * anim.dur('jump'); roll = s.p * PI * 2; rate = 30; }
    else if (s.state === 'fury') { name = 'fury'; time = Math.min(1, s.p) * anim.dur('fury'); jy = s.p < 0.5 ? Math.sin((s.p / 0.5) * PI) * 2 : 0; rate = 30; }
    else if (s.state === 'spin') { name = 's0'; time = 0.56 * anim.dur('s0'); rate = 26; }
    else if (s.state === 'rush') { name = 'thrust'; time = 0.5 * anim.dur('thrust'); rate = 45; lean = 0.45; }
    else if (s.state === 'dead') { name = 'death'; time = s.p * 1.25; rate = 12; }
    anim.set(name, dt, time, rate, speed);
    pivot.rotation.x = roll + lean; pivot.position.y = 1 + jy - (roll ? Math.sin(s.p * PI) * 0.25 : 0);
  }
  return { root, pose, tip: S.tip, base: S.base, swordLight: S.light, bladeM: S.bladeM };
}

// =================== ENNEMIS ===================
export const DEF = {
  grunt: { hp: 30, speed: 4.5, r: 0.7, dmg: 10, braise: 2, h: 2.0, model: 'mutant', size: 2.0, move: 'run', ref: 4.5 },
  ghoul: { hp: 16, speed: 6.6, r: 0.55, dmg: 7, braise: 2, h: 1.9, model: 'ghoul', size: 1.85, move: 'run', ref: 5, ai: 'grunt', wind: 0.34 },
  caster: { hp: 24, speed: 3.3, r: 0.65, dmg: 9, braise: 3, h: 2.1, model: 'ganfaul', size: 2.1, move: 'walk', ref: 2.6 },
  brute: { hp: 125, speed: 2.7, r: 1.3, dmg: 22, braise: 7, h: 3.3, model: 'warrok', size: 3.3, move: 'walk', ref: 2.4 },
  boss: { hp: 700, speed: 3.4, r: 2.3, dmg: 26, braise: 50, h: 5.6, model: 'maw', size: 5.6, move: 'walk', ref: 3.2, em: [0.03, 0.004, 0] },
};

function buildEnemyModel(type) {
  const d = DEF[type], A = assets[d.model], model = SkeletonUtils.clone(A.scene), g = new THREE.Group(), body = new THREE.Group(), holder = new THREE.Group(), parts = { body };
  let mat = null;
  model.traverse(o => { if (o.isMesh) { if (!mat) { mat = o.material.clone(); mat.envMapIntensity = 1.6; if (d.tint) mat.color.setRGB(d.tint[0], d.tint[1], d.tint[2]); } o.material = mat; } });
  parts.bodyMat = mat; parts.em = d.em || [0, 0, 0];
  holder.add(model); holder.scale.setScalar(d.size / A.height); body.add(holder); g.add(body);
  parts.anim = animator(model, A.clips, 'idle');
  if (type === 'caster') {
    parts.orbit = new THREE.Group(); parts.orbit.position.y = 1.5; g.add(parts.orbit);
    const cm = glow(0.4, 2.6, 3.6);
    for (let i = 0; i < 3; i++) { const a = i * 2.094, m = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), cm); m.position.set(Math.cos(a) * 1.05, Math.sin(a * 2) * 0.2, Math.sin(a) * 1.05); m.scale.y = 1.8; parts.orbit.add(m); }
  }
  if (type === 'boss') { const l = new THREE.PointLight(0xff5a2a, 22, 16, 1.8); l.position.set(0, 2.2, 3.6); g.add(l); }
  const bar = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: false, fog: false }));
  const fgGeo = new THREE.PlaneGeometry(1.06, 0.08); fgGeo.translate(0.53, 0, 0);
  const fg = new THREE.Mesh(fgGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.25, 0.3), depthTest: false, fog: false }));
  fg.position.set(-0.53, 0, 0.001); bg.renderOrder = 8; fg.renderOrder = 9;
  bar.add(bg, fg); bar.visible = false; parts.bar = bar; parts.barFg = fg;
  return { g, parts };
}

const angLerp = (a, b, t) => { const d = ((b - a + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI; return a + d * Math.min(1, t); };

export class Enemy {
  constructor(type, G, x, z, hpMul = 1, dmgMul = 1) {
    const d = DEF[type];
    Object.assign(this, { type, ai: d.ai || type, G, x, z, def: d, r: d.r, hp: d.hp * hpMul, maxHp: d.hp * hpMul, dmg: d.dmg * dmgMul });
    this.state = 'spawn'; this.t = 0; this.face = Math.atan2(G.hero.pos.x - x, G.hero.pos.z - z);
    this.kx = 0; this.kz = 0; this.flash = 0; this.cd = 0.3 + Math.random() * 0.8; this.ph = Math.random() * 9;
    this.burnT = 0; this.burnDps = 0; this.burnAcc = 0; this.dead = false; this.gone = false; this.y = 0; this.hitDone = false;
    this.summoned = false; this.strafe = Math.random() < 0.5 ? 1 : -1; this.tele = null; this.atkT = 0; this.atkClip = 'idle'; this.atkK = 1;
    const { g, parts } = buildEnemyModel(type); this.g = g; this.parts = parts;
    G.scene.add(g); G.scene.add(parts.bar);
  }
  dispose() { this.G.scene.remove(this.g); this.G.scene.remove(this.parts.bar); this.parts.bodyMat.dispose(); this.G.gfx.cancel(this.tele); }
  set(state, t = 0) { this.state = state; this.t = t; this.hitDone = false; }
  wind(dur, clip, impact) { this.set('windup', dur); this.atkT = 0; this.atkClip = clip; this.atkK = impact / dur; }
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
    let glowR = P.em[0] + this.flash * 0.2, glowG = P.em[1] + this.flash * 0.12, glowB = P.em[2] + this.flash * 0.08;
    if (this.burnT > 0 && !this.dead) {
      this.burnT -= dt; this.burnAcc += this.burnDps * dt; glowR += 0.35; glowG += 0.08;
      if (Math.random() < dt * 30) G.fx.emit(this.x + (Math.random() - 0.5) * this.r, 0.6 + Math.random() * this.def.h * 0.6, this.z + (Math.random() - 0.5) * this.r, 0, 2, 0, 3.5, 1.2, 0.2, 0.4, 0.4, -2);
      if (this.burnAcc >= 3) { const v = Math.floor(this.burnAcc); this.burnAcc -= v; G.damageEnemy(this, v, { dot: true }); }
    }
    let speed = 0, lean = 0, clip = 'idle', time, rate = 10, aspd = 1;
    const move = (mx, mz, s) => { this.x += mx * s * dt; this.z += mz * s * dt; speed = s; };
    const atk = () => { this.atkT += dt; clip = this.atkClip; time = this.atkT * this.atkK; rate = 16; };
    switch (this.state) {
      case 'spawn': {
        this.t += dt; const k = Math.min(1, this.t / 0.85);
        this.y = -(this.def.h + 0.3) * (1 - k) * (1 - k);
        if (Math.random() < dt * 60) G.fx.emit(this.x + (Math.random() - 0.5) * this.r * 2, 0.1, this.z + (Math.random() - 0.5) * this.r * 2, 0, 2 + Math.random() * 3, 0, 1.6, 0.3, 2.4, 0.4, 0.6, 0, 1);
        if (k >= 1) { this.y = 0; this.set('chase'); if (Math.random() < 0.4) G.sfx('growl'); }
        break;
      }
      case 'stagger': this.t -= dt; lean = -0.3; if (this.t <= 0) this.set('chase'); break;
      case 'dying': {
        this.t += dt; clip = 'die'; time = this.t * 1.6; rate = 14;
        if (this.t > 1.5) this.y = -(this.t - 1.5) * 2.2;
        if (this.t >= 2.2) this.gone = true;
        break;
      }
      case 'chase': {
        this.face = angLerp(this.face, toHero, dt * (big ? 4 : 9)); this.cd -= dt;
        if (this.ai === 'grunt') {
          if (d > 1.9) move(dx, dz, this.def.speed);
          if (d < 2.4 && this.cd <= 0) this.wind(this.def.wind || 0.45, 'atk', 0.42);
        } else if (this.type === 'caster') {
          if (d < 7) move(-dx, -dz, this.def.speed); else if (d > 13) move(dx, dz, this.def.speed);
          else move(-dz * this.strafe, dx * this.strafe, this.def.speed * 0.6);
          if (Math.hypot(this.x, this.z) > ARENA_R - 1.5) this.strafe *= -1;
          if (this.cd <= 0 && d < 18) this.wind(0.7, 'cast', 0.9);
        } else if (this.type === 'brute') {
          if (d > 3) move(dx, dz, this.def.speed);
          if (d < 3.8 && this.cd <= 0) { this.wind(0.95, 'slam', 1.0); this.tx = this.x + fx * 1.6; this.tz = this.z + fz * 1.6; this.tele = G.gfx.circle(this.tx, this.tz, 4.3, 0.95); }
        } else { // boss
          if (!this.summoned && this.hp < this.maxHp * 0.5) {
            this.summoned = true; G.gfx.ring(this.x, this.z, 1, 14, 0.7, 0xff3a6a, 3); G.shake(0.6); G.sfx('roar');
            for (let i = 0; i < 3; i++) G.spawnEnemy('grunt');
          }
          if (d > 4) move(dx, dz, this.def.speed);
          if (this.cd <= 0) {
            const r = Math.random();
            if (d < 6.5 && r < 0.6) { this.atk = 'slam'; this.wind(1.0, 'slam', 1.0); this.tx = this.x + fx * 2.5; this.tz = this.z + fz * 2.5; this.tele = G.gfx.circle(this.tx, this.tz, 6.5, 1.0); }
            else if (r < 0.55 || d > 12) { this.atk = 'charge'; this.wind(0.9, 'roar', 0.9); this.face = toHero; this.tele = G.gfx.rect(this.x, this.z, toHero, 5, 19, 0.9); }
            else { this.atk = 'orbs'; this.wind(0.8, 'roar', 0.8); }
          }
        }
        if (speed > 0) { clip = this.def.move; aspd = speed / this.def.ref; }
        break;
      }
      case 'windup': {
        this.t -= dt; atk(); glowR += 0.14 * (0.5 + 0.5 * Math.sin(this.ph + G.time * 30));
        if (this.ai === 'grunt') this.face = angLerp(this.face, toHero, dt * 5);
        else if (this.type === 'caster') { this.face = angLerp(this.face, toHero, dt * 8); P.orbit.rotation.y += dt * 14; }
        if (this.t <= 0) {
          if (this.ai === 'grunt') { this.set('strike', 0.2); G.sfx('swipe'); }
          else if (this.type === 'caster') { G.shoot(this.x + fx * 0.8, 1.6, this.z + fz * 0.8, dx, dz, 11, this.dmg, this); this.cd = 2.2 + Math.random() * 1.4; this.set('recover', 0.5); }
          else if (this.type === 'boss' && this.atk === 'charge') { this.set('strike', 0.62); G.sfx('roar'); }
          else if (this.type === 'boss' && this.atk === 'orbs') {
            for (let i = 0; i < 12; i++) { const a = this.face + (i / 12) * PI * 2; G.shoot(this.x + Math.sin(a) * 2.4, 1.5, this.z + Math.cos(a) * 2.4, Math.sin(a), Math.cos(a), 8.5, this.dmg * 0.5, this); }
            this.set('recover', 0.8);
          } else { // frappe au sol
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
        if (this.ai === 'grunt') {
          atk(); move(fx, fz, 10); lean = 0.15;
          if (!this.hitDone && d < 2.1) { this.hitDone = true; G.damageHero(this.dmg, this.x, this.z); }
          if (this.t <= 0) { this.cd = 0.5 + Math.random() * 0.9; this.set('recover', 0.5); }
        } else { // charge du boss
          move(fx, fz, 30); lean = 0.3; clip = 'run'; aspd = 2.2; rate = 20;
          G.fx.emit(this.x, 0.2, this.z, 0, 2, 0, 3, 0.8, 0.2, 0.7, 0.4);
          if (!this.hitDone && d < 3.4) { this.hitDone = true; G.damageHero(this.dmg, this.x, this.z); G.shake(0.6); }
          if (this.t <= 0 || Math.hypot(this.x, this.z) > ARENA_R - 1) { this.set('recover', 0.9); this.atkClip = 'idle'; this.atkT = 0; }
        }
        break;
      }
      case 'recover': this.t -= dt; atk(); if (this.t <= 0) { if (big) this.cd = 0.7 + Math.random() * 0.8; this.set('chase'); } break;
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
    // animation
    P.anim.set(clip, dt, time, rate, aspd);
    P.body.rotation.x += (lean - P.body.rotation.x) * (1 - Math.exp(-14 * dt));
    if (P.orbit) { P.orbit.rotation.y += dt * 2.2; P.orbit.visible = !this.dead; }
    P.bodyMat.emissive.setRGB(glowR, glowG, glowB);
    this.g.position.set(this.x, this.y, this.z); this.g.rotation.y = this.face;
    const bar = P.bar;
    bar.visible = !this.dead && this.type !== 'boss' && this.hp < this.maxHp;
    if (bar.visible) { bar.position.set(this.x, this.def.h + 0.45, this.z); bar.quaternion.copy(G.camera.quaternion); P.barFg.scale.x = Math.max(0.001, this.hp / this.maxHp); }
  }
}
