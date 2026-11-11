import * as THREE from 'three';
import { assets } from './assets.js';

export const ARENA_R = 20;
const SKY_ROT = 2.2;
const TAU = Math.PI * 2;

// Rugosité du sol : pierre mate, flaques lisses qui reflètent les braseros
function groundTextures(size) {
  const c = document.createElement('canvas'); c.width = c.height = size; const h = c.getContext('2d'), cx = size / 2;
  h.fillStyle = 'rgb(0,215,0)'; h.fillRect(0, 0, size, size);
  for (let i = 0; i < 22; i++) {
    const x = cx + (Math.random() - 0.5) * size * 0.85, y = cx + (Math.random() - 0.5) * size * 0.85, r = size * (0.02 + Math.random() * 0.05);
    const gr = h.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,120,0,.9)'); gr.addColorStop(0.7, 'rgba(0,130,0,.7)'); gr.addColorStop(1, 'rgba(0,130,0,0)');
    h.fillStyle = gr; h.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return { bump: new THREE.CanvasTexture(c) };
}
function softTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.5, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
function bannerTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#9c1626'); gr.addColorStop(1, '#4a0a14'); g.fillStyle = gr; g.fillRect(0, 0, 128, 256);
  g.strokeStyle = '#e8b455'; g.lineWidth = 5; g.strokeRect(9, 9, 110, 300);
  g.fillStyle = '#e8b455'; g.beginPath(); g.moveTo(64, 50); g.lineTo(74, 150); g.lineTo(54, 150); g.closePath(); g.fill(); g.fillRect(40, 150, 48, 8); g.fillRect(59, 158, 10, 30);
  g.beginPath(); g.arc(64, 112, 34, 0, TAU); g.lineWidth = 3; g.stroke();
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(0, 256); g.lineTo(64, 206); g.lineTo(128, 256); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildWorld(scene, fx, mobile) {
  const fogA = new THREE.Color(0x15141e), fogB = new THREE.Color(0x2c0c14);
  scene.fog = new THREE.FogExp2(fogA.getHex(), 0.016);

  // Ciel photographié (HDRI Poly Haven), assombri pour le crépuscule
  assets.sky.wrapT = THREE.ClampToEdgeWrapping;
  const skyMat = new THREE.MeshBasicMaterial({ map: assets.sky, side: THREE.BackSide, depthWrite: false, fog: false });
  const skyA = new THREE.Color(0.62, 0.5, 0.6), skyB = new THREE.Color(1.0, 0.36, 0.3);
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(420, 48, 24), skyMat); skyMesh.rotation.y = SKY_ROT; scene.add(skyMesh);
  // scène d'environnement (reflets sur les armures et les dalles)
  const envScene = new THREE.Scene();
  { const e = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ map: assets.sky, side: THREE.BackSide, color: new THREE.Color(0.8, 0.68, 0.78) })); e.rotation.y = SKY_ROT; envScene.add(e); }
  for (let i = 0; i < 4; i++) { const a = i * (TAU / 4) + TAU / 8; const m = new THREE.Mesh(new THREE.SphereGeometry(3.5, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 2.2, 0.6) })); m.position.set(Math.cos(a) * 22, 4, Math.sin(a) * 22); envScene.add(m); }
  const em = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.8, 2.6) })); em.position.set(-14, 30, -34); envScene.add(em);

  // Montagnes + épée colossale plantée au loin
  const mm = new THREE.MeshBasicMaterial({ color: 0x0b0a16, fog: false }), mm2 = new THREE.MeshBasicMaterial({ color: 0x241426, fog: false });
  const colossus = new THREE.Group(), cm = new THREE.MeshBasicMaterial({ color: 0x07060d, fog: false });
  const bl = new THREE.Mesh(new THREE.BoxGeometry(9, 110, 2), cm); bl.position.y = 50; colossus.add(bl);
  const gd = new THREE.Mesh(new THREE.BoxGeometry(34, 5, 4), cm); gd.position.y = 84; colossus.add(gd);
  const hl = new THREE.Mesh(new THREE.BoxGeometry(4, 24, 3), cm); hl.position.y = 98; colossus.add(hl);
  const vein = new THREE.Mesh(new THREE.BoxGeometry(0.9, 78, 2.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.8, 0.2), fog: false })); vein.position.y = 42; colossus.add(vein);
  colossus.position.set(46, -8, -120); colossus.rotation.z = 0.16; colossus.rotation.y = 0.3; scene.add(colossus);

  // Lumières : lune (ombres), contre-jour chaud, ambiance
  const hemi = new THREE.HemisphereLight(0x93a4d6, 0x3a2418, 0.7); scene.add(hemi);
  const hemiA = hemi.color.clone(), hemiB = new THREE.Color(0xff6a6a);
  const sun = new THREE.DirectionalLight(0xc4d2ff, 2.7);
  sun.position.set(-14, 26, -18); sun.castShadow = true;
  const sc = sun.shadow.camera; sc.left = sc.bottom = -25; sc.right = sc.top = 25; sc.near = 1; sc.far = 80;
  sun.shadow.mapSize.setScalar(mobile ? 1024 : 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xff7a3c, 1.5); rim.position.set(18, 7, -12); scene.add(rim);

  // Arène
  for (const k of ['wall', 'wall_n', 'wall_arm']) assets[k].repeat.set(2, 2); for (const k of ['floor', 'floor_n', 'floor_arm']) assets[k].repeat.set(7, 7);
  const stone = new THREE.MeshStandardMaterial({ map: assets.wall, normalMap: assets.wall_n, normalScale: new THREE.Vector2(1.3, 1.3), roughnessMap: assets.wall_arm, color: 0xa9a6b2, roughness: 1, metalness: 0.02 });
  const dark = new THREE.MeshStandardMaterial({ map: assets.wall, normalMap: assets.wall_n, color: 0x55506a, roughness: 0.95 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.42, metalness: 0.95 });
  const rock = (s, d) => { const g = new THREE.IcosahedronGeometry(s, d), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + 0.16 * Math.sin(x * 3.1 / s + y * 2.3 / s) + 0.12 * Math.sin(z * 4.3 / s + x * 1.7 / s); p.setXYZ(i, x * n, y * n, z * n); } g.computeVertexNormals(); return g; };
  const gt = groundTextures(512);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(24, 72).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: assets.floor, normalMap: assets.floor_n, normalScale: new THREE.Vector2(1.6, 1.6), color: 0x8d8a96, roughnessMap: assets.floor_arm, aoMap: assets.floor_arm, aoMapIntensity: 1.2, roughness: 0.9, metalness: 0.06 }));
  floor.receiveShadow = true; scene.add(floor);
  const rimWall = new THREE.Mesh(new THREE.CylinderGeometry(24, 25.5, 2.4, 72, 1, true), stone); rimWall.position.y = -1.2; scene.add(rimWall);
  const land = new THREE.Mesh(new THREE.CircleGeometry(280, 48).rotateX(-Math.PI / 2), dark); land.position.y = -2.2; scene.add(land);

  // Runes lumineuses
  const runes = [], runeA = new THREE.Color(0xff7a2a), runeB = new THREE.Color(0xff1428);
  const runeMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const [a, b] of [[3.0, 3.12], [9.2, 9.3], [20.4, 20.62]]) {
    const m = new THREE.Mesh(new THREE.RingGeometry(a, b, 96).rotateX(-Math.PI / 2), runeMat); m.position.y = 0.03; scene.add(m); runes.push(m);
  }
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 5.4).rotateX(-Math.PI / 2), runeMat);
    const a = (i / 12) * TAU; m.position.set(Math.cos(a) * 6.1, 0.03, Math.sin(a) * 6.1); m.rotation.y = -a + Math.PI / 2; scene.add(m);
  }

  // Piliers, bannières, gravats
  const banners = [], bMat = new THREE.MeshStandardMaterial({ map: bannerTexture(), side: THREE.DoubleSide, roughness: 0.9, alphaTest: 0.5 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + 0.22, h = 3 + Math.random() * 8, broken = Math.random() < 0.35;
    const p = new THREE.Group();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.95, h, 24), stone); col.position.y = h / 2; col.castShadow = true;
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 2.4), stone); base.position.y = 0.3; base.castShadow = true;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.25, 24), stone); band.position.y = Math.min(h - 0.4, 2.6); p.add(col, base, band);
    if (!broken) { const cap = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 2.2), stone); cap.position.y = h + 0.25; cap.castShadow = true; p.add(cap); }
    else {
      col.rotation.z = (Math.random() - 0.5) * 0.14;
      for (let k = 0; k < 3; k++) { const s = 0.3 + Math.random() * 0.5, rb = new THREE.Mesh(rock(s, 2), stone); const ra = a + (Math.random() - 0.5) * 0.25, rr = 20.6 + Math.random() * 2.6; rb.position.set(Math.cos(ra) * rr, s * 0.5, Math.sin(ra) * rr); rb.rotation.set(Math.random() * 3, Math.random() * 3, 0); rb.castShadow = true; scene.add(rb); }
    }
    p.position.set(Math.cos(a) * 22.6, 0, Math.sin(a) * 22.6); p.rotation.y = Math.random() * 3; scene.add(p);
    if (!broken && h > 5.5) {
      const geo = new THREE.PlaneGeometry(1.5, 3.4, 3, 8); geo.translate(0, -1.7, 0);
      const b = new THREE.Mesh(geo, bMat); b.position.set(Math.cos(a) * 21.55, h - 0.3, Math.sin(a) * 21.55); b.rotation.y = -a - Math.PI / 2; b.castShadow = true;
      scene.add(b); banners.push({ geo, rest: geo.attributes.position.array.slice(), ph: Math.random() * 9 });
    }
  }
  // Décor scanné : falaises, rochers et statues de rois déchus (modèles Poly Haven)
  const place = (name, x, y, z, size, ry, tint) => {
    const A = assets[name], o = A.scene.clone(), k = size / Math.max(A.size.x, A.size.y, A.size.z);
    if (tint) o.traverse(n => { if (n.isMesh) { n.material = n.material.clone(); n.material.color.multiplyScalar(tint); } });
    o.scale.setScalar(k); o.rotation.y = ry; o.position.set(x, y - A.min.y * k, z); scene.add(o); return o;
  };
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + Math.random() * 0.25, r = 33 + Math.random() * 26; place('cliff', Math.cos(a) * r, -3.2, Math.sin(a) * r, 11 + Math.random() * 12, Math.random() * TAU, 0.5); }
  for (let i = 0; i < 44; i++) { const a = Math.random() * TAU, r = 26.5 + Math.random() * 40; place('boulder', Math.cos(a) * r, -2.5, Math.sin(a) * r, 1.2 + Math.random() * 4, Math.random() * TAU, 0.55); }
  for (let i = 0; i < 22; i++) { const a = (i / 22) * TAU + Math.random() * 0.15, r = 150 + Math.random() * 60; place('cliff', Math.cos(a) * r, -12, Math.sin(a) * r, 36 + Math.random() * 44, Math.random() * TAU, 0.4); }
  for (let i = 0; i < 4; i++) {
    const a = i * (TAU / 4), x = Math.cos(a) * 28.5, z = Math.sin(a) * 28.5;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 4.4, 28), stone); ped.position.set(x, -0.2, z); ped.castShadow = true; scene.add(ped);
    place('statue', x, 2.0, z, 12, Math.atan2(-x, -z), 0.9);
  }

  // Braseros
  const braziers = [];
  for (let i = 0; i < 4; i++) {
    const a = i * (TAU / 4) + TAU / 8, x = Math.cos(a) * 21.3, z = Math.sin(a) * 21.3;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.5, 1.6, 20), iron); foot.position.set(x, 0.8, z); foot.castShadow = true;
    const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0.25, 0], [0.75, 0.16], [1.02, 0.5], [1.06, 0.62], [0.96, 0.62], [0.9, 0.5]].map(p => new THREE.Vector2(p[0], p[1] - 0.3)), 28), iron); bowl.position.set(x, 1.9, z); bowl.castShadow = true;
    const coal = new THREE.Mesh(new THREE.CircleGeometry(0.92, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.4, 0.3) })); coal.position.set(x, 2.21, z);
    const light = new THREE.PointLight(0xff7a30, 90, 26, 1.8); light.position.set(x, 3.4, z);
    scene.add(foot, bowl, coal, light); braziers.push({ x, z, light, ph: Math.random() * 9 });
  }

  // Brume basse
  const mist = new THREE.Group(), soft = softTexture(), mists = [];
  const mistMat = new THREE.MeshBasicMaterial({ map: soft, color: 0x8a8cb0, transparent: true, opacity: 0.07, depthWrite: false });
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mistMat); const s = 16 + Math.random() * 14; m.scale.set(s, 1, s);
    m.renderOrder = 3; mist.add(m); mists.push({ m, a: Math.random() * TAU, r: 4 + Math.random() * 17, sp: (Math.random() - 0.5) * 0.06, y: 0.35 + Math.random() * 0.9 });
  }
  scene.add(mist);

  const W = {
    sun, envScene, mist, mood: 0, cur: 0,
    update(t, dt, focus) {
      W.cur += (W.mood - W.cur) * Math.min(1, dt * 1.5); const k = W.cur;
      skyMat.color.copy(skyA).lerp(skyB, k);
      scene.fog.color.copy(fogA).lerp(fogB, k); hemi.color.copy(hemiA).lerp(hemiB, k * 0.6); rim.intensity = 1.5 + k * 1.3;
      runeMat.color.copy(runeA).lerp(runeB, k); runeMat.opacity = 0.38 + Math.sin(t * (1.3 + k * 4)) * 0.14 + k * 0.25;
      for (const b of braziers) {
        b.light.intensity = 85 + Math.sin(t * 11 + b.ph) * 14 + Math.sin(t * 23 + b.ph) * 8;
        for (let j = 0; j < 2; j++) fx.emit(b.x + (Math.random() - 0.5) * 1.1, 2.2, b.z + (Math.random() - 0.5) * 1.1,
          (Math.random() - 0.5) * 0.5, 1.6 + Math.random() * 2.2, (Math.random() - 0.5) * 0.5, 3.4, 1.1 + Math.random() * 0.6 - k * 0.6, 0.2, 0.75, 0.45 + Math.random() * 0.4, -1.5, 0.6);
      }
      for (const b of banners) {
        const pa = b.geo.attributes.position.array, r = b.rest;
        for (let i = 0; i < pa.length; i += 3) { const v = -r[i + 1] / 3.4; pa[i + 2] = Math.sin(t * 2.2 + v * 5 + b.ph + r[i]) * 0.22 * v + Math.sin(t * 3.7 + v * 9 + b.ph) * 0.07 * v; }
        b.geo.attributes.position.needsUpdate = true; b.geo.computeVertexNormals();
      }
      for (const m of mists) { m.a += m.sp * dt; m.m.position.set(Math.cos(m.a) * m.r, m.y, Math.sin(m.a) * m.r); }
      if (Math.random() < dt * (90 + k * 160)) {
        const a = Math.random() * TAU, r = Math.random() * 24;
        fx.emit(focus.x + Math.cos(a) * r, Math.random() * 1.5, focus.z + Math.sin(a) * r,
          (Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 1.2 + k, (Math.random() - 0.5) * 0.8, 3, 1 + Math.random() - k * 0.6, 0.2, 0.13 + Math.random() * 0.1, 3 + Math.random() * 3, -0.1, 0.1);
      }
    },
  };
  return W;
}
