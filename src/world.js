import * as THREE from 'three';
import { assets } from './assets.js';

export const ARENA_R = 20;
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

const SKY_FRAG = `varying vec3 vP; uniform float uTime, uMood;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*noise(p);p*=2.03;a*=.5;}return s;}
void main(){ vec3 d=normalize(vP); float h=d.y;
  vec3 zen=vec3(.012,.018,.06), mid=mix(vec3(.09,.05,.16),vec3(.2,.03,.06),uMood), hor=mix(vec3(.62,.22,.14),vec3(.9,.12,.08),uMood);
  vec3 c=mix(mid,zen,smoothstep(.08,.6,h)); c=mix(hor,c,smoothstep(-.02,.22,h));
  float g=pow(max(0.,1.-abs(h)*3.),3.); c+=vec3(.55,.17,.05)*g*.7;
  vec2 uv=d.xz/(abs(h)+.3)*1.3; float cl=smoothstep(.42,.8,fbm(uv+vec2(uTime*.012,0.)));
  vec3 cc=mix(vec3(.05,.03,.09),mix(vec3(.75,.27,.12),vec3(1.,.15,.08),uMood),smoothstep(.45,.02,h));
  c=mix(c,cc,cl*.6*smoothstep(-.02,.12,h));
  vec3 md=normalize(vec3(-110.,120.,-300.)); float m=max(0.,dot(d,md)); c+=vec3(.5,.55,.8)*(pow(m,60.)*.5+pow(m,8.)*.08);
  gl_FragColor=vec4(c,1.); }`;

export function buildWorld(scene, fx, mobile) {
  const fogA = new THREE.Color(0x15141e), fogB = new THREE.Color(0x2c0c14);
  scene.fog = new THREE.FogExp2(fogA.getHex(), 0.016);

  // Ciel nuageux
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uTime: { value: 0 }, uMood: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: SKY_FRAG,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), skyMat));
  // scène d'environnement (reflets sur les armures et les dalles)
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 12), skyMat));
  for (let i = 0; i < 4; i++) { const a = i * (TAU / 4) + TAU / 8; const m = new THREE.Mesh(new THREE.SphereGeometry(3.5, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 2.2, 0.6) })); m.position.set(Math.cos(a) * 22, 4, Math.sin(a) * 22); envScene.add(m); }
  const em = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.8, 2.6) })); em.position.set(-14, 30, -34); envScene.add(em);

  const sp = new Float32Array(700 * 3);
  for (let i = 0; i < 700; i++) {
    const a = Math.random() * TAU, e = 0.12 + Math.random() * 1.35;
    sp[i * 3] = Math.cos(a) * Math.cos(e) * 400; sp[i * 3 + 1] = Math.sin(e) * 400; sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 400;
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.7 })));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(16, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.6, 3.2), fog: false }));
  moon.position.set(-110, 120, -300); moon.lookAt(0, 0, 0); scene.add(moon);

  // Montagnes + épée colossale plantée au loin
  const mm = new THREE.MeshBasicMaterial({ color: 0x0b0a16, fog: false }), mm2 = new THREE.MeshBasicMaterial({ color: 0x241426, fog: false });
  for (let i = 0; i < 46; i++) {
    const far = i % 2, a = (i / 46) * TAU + Math.random() * 0.1, r = far ? 260 : 170 + Math.random() * 30, h = (far ? 34 : 14) + Math.random() * (far ? 50 : 26);
    const m = new THREE.Mesh(new THREE.ConeGeometry(h * (0.9 + Math.random() * 0.7), h, 5 + (i % 3)), far ? mm2 : mm);
    m.position.set(Math.cos(a) * r, h / 2 - 6, Math.sin(a) * r); m.rotation.y = Math.random() * 3; scene.add(m);
  }
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
  assets.wall.repeat.set(2, 2); assets.wallN.repeat.set(2, 2); assets.floor.repeat.set(7, 7); assets.floorN.repeat.set(7, 7);
  const stone = new THREE.MeshStandardMaterial({ map: assets.wall, normalMap: assets.wallN, normalScale: new THREE.Vector2(1.4, 1.4), color: 0xa9a6b2, roughness: 0.82, metalness: 0.02 });
  const dark = new THREE.MeshStandardMaterial({ map: assets.wall, normalMap: assets.wallN, color: 0x55506a, roughness: 0.95 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.42, metalness: 0.95 });
  const rock = (s, d) => { const g = new THREE.IcosahedronGeometry(s, d), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + 0.16 * Math.sin(x * 3.1 / s + y * 2.3 / s) + 0.12 * Math.sin(z * 4.3 / s + x * 1.7 / s); p.setXYZ(i, x * n, y * n, z * n); } g.computeVertexNormals(); return g; };
  const gt = groundTextures(512);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(24, 72).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: assets.floor, normalMap: assets.floorN, normalScale: new THREE.Vector2(1.5, 1.5), color: 0x8d8a96, roughnessMap: gt.bump, roughness: 1, metalness: 0.06 }));
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
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * TAU, r = 27 + Math.random() * 70, s = 0.8 + Math.random() * 4;
    const m = new THREE.Mesh(rock(s, 2), dark);
    m.position.set(Math.cos(a) * r, -2.2 + s * 0.3, Math.sin(a) * r); m.rotation.set(Math.random() * 3, Math.random() * 3, 0); m.scale.y = 0.6 + Math.random(); scene.add(m);
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
      skyMat.uniforms.uTime.value = t; skyMat.uniforms.uMood.value = k;
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
