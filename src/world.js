import * as THREE from 'three';

export const ARENA_R = 20;
const TAU = Math.PI * 2;

function groundTexture(size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), cx = size / 2;
  g.fillStyle = '#0c0b10'; g.fillRect(0, 0, size, size);
  const rings = 13;
  for (let i = rings; i >= 1; i--) {
    const r1 = (i / rings) * cx, r0 = ((i - 1) / rings) * cx;
    const n = i === 1 ? 1 : Math.round(i * 6.5), off = Math.random() * 6;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * TAU + off, a1 = ((k + 1) / n) * TAU + off;
      const l = 17 + Math.random() * 11;
      g.fillStyle = `hsl(${250 + Math.random() * 25},${7 + Math.random() * 7}%,${l}%)`;
      g.beginPath(); g.arc(cx, cx, r1, a0, a1); g.arc(cx, cx, r0, a1, a0, true); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(4,3,8,.9)'; g.lineWidth = size / 400; g.stroke();
    }
  }
  for (let i = 0; i < size * 60; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,240,220,.035)';
    const s = 1 + Math.random() * 3; g.fillRect(Math.random() * size, Math.random() * size, s, s);
  }
  g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = size / 700;
  for (let i = 0; i < 60; i++) {
    let x = Math.random() * size, y = Math.random() * size; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * size * 0.03; y += (Math.random() - 0.5) * size * 0.03; g.lineTo(x, y); }
    g.stroke();
  }
  const v = g.createRadialGradient(cx, cx, cx * 0.2, cx, cx, cx);
  v.addColorStop(0, 'rgba(255,170,90,.10)'); v.addColorStop(0.5, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)');
  g.fillStyle = v; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export function buildWorld(scene, fx, mobile) {
  scene.fog = new THREE.FogExp2(0x191424, 0.016);

  // Ciel
  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 vP; void main(){ float h=normalize(vP).y;
      vec3 zen=vec3(.012,.018,.06), mid=vec3(.09,.05,.16), hor=vec3(.55,.2,.14);
      vec3 c=mix(mid,zen,smoothstep(.08,.6,h)); c=mix(hor,c,smoothstep(-.02,.2,h));
      float g=pow(max(0.,1.-abs(h)*3.),3.); c+=vec3(.5,.16,.05)*g*.6; gl_FragColor=vec4(c,1.); }`,
  }));
  scene.add(sky);
  const sp = new Float32Array(700 * 3);
  for (let i = 0; i < 700; i++) {
    const a = Math.random() * TAU, e = 0.12 + Math.random() * 1.35;
    sp[i * 3] = Math.cos(a) * Math.cos(e) * 400; sp[i * 3 + 1] = Math.sin(e) * 400; sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 400;
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(16, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.6, 3.2), fog: false }));
  moon.position.set(-110, 120, -300); moon.lookAt(0, 0, 0); scene.add(moon);

  // Montagnes
  const mm = new THREE.MeshBasicMaterial({ color: 0x0b0a16, fog: false });
  const mm2 = new THREE.MeshBasicMaterial({ color: 0x241426, fog: false });
  for (let i = 0; i < 46; i++) {
    const far = i % 2, a = (i / 46) * TAU + Math.random() * 0.1, r = far ? 260 : 170 + Math.random() * 30, h = (far ? 34 : 14) + Math.random() * (far ? 50 : 26);
    const m = new THREE.Mesh(new THREE.ConeGeometry(h * (0.9 + Math.random() * 0.7), h, 5 + (i % 3)), far ? mm2 : mm);
    m.position.set(Math.cos(a) * r, h / 2 - 6, Math.sin(a) * r); m.rotation.y = Math.random() * 3; scene.add(m);
  }

  // Lumières
  scene.add(new THREE.HemisphereLight(0x7f8cff, 0x3a1a10, 0.75));
  const sun = new THREE.DirectionalLight(0xb4c6ff, 2.1);
  sun.position.set(-14, 26, -18); sun.castShadow = true;
  const sc = sun.shadow.camera; sc.left = sc.bottom = -25; sc.right = sc.top = 25; sc.near = 1; sc.far = 80;
  sun.shadow.mapSize.setScalar(mobile ? 1024 : 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(sun);

  // Arène
  const stone = new THREE.MeshStandardMaterial({ color: 0x4a4654, roughness: 0.85, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d1b24, roughness: 1, flatShading: true });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(24, 72).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: groundTexture(mobile ? 1024 : 2048), roughness: 0.78, metalness: 0.05 }));
  floor.receiveShadow = true; scene.add(floor);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(24, 25.5, 2.4, 72, 1, true), stone); rim.position.y = -1.2; scene.add(rim);
  const land = new THREE.Mesh(new THREE.CircleGeometry(260, 48).rotateX(-Math.PI / 2), dark); land.position.y = -2.2; scene.add(land);

  // Runes lumineuses
  const runes = [];
  const runeMat = () => new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const [a, b] of [[3.0, 3.12], [9.2, 9.3], [20.4, 20.62]]) {
    const m = new THREE.Mesh(new THREE.RingGeometry(a, b, 96).rotateX(-Math.PI / 2), runeMat()); m.position.y = 0.025; scene.add(m); runes.push(m);
  }
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 5.4).rotateX(-Math.PI / 2), runeMat());
    const a = (i / 12) * TAU; m.position.set(Math.cos(a) * 6.1, 0.025, Math.sin(a) * 6.1); m.rotation.y = -a + Math.PI / 2; scene.add(m); runes.push(m);
  }

  // Piliers en ruine
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + 0.22, h = 3 + Math.random() * 8, broken = Math.random() < 0.4;
    const p = new THREE.Group();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.95, h, 7), stone); col.position.y = h / 2; col.castShadow = true;
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 2.4), stone); base.position.y = 0.3; base.castShadow = true;
    p.add(col, base);
    if (!broken) { const cap = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 2.2), stone); cap.position.y = h + 0.25; cap.castShadow = true; p.add(cap); }
    else { col.rotation.z = (Math.random() - 0.5) * 0.14; }
    p.position.set(Math.cos(a) * 22.6, 0, Math.sin(a) * 22.6); p.rotation.y = Math.random() * 3; scene.add(p);
  }
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * TAU, r = 27 + Math.random() * 70, s = 0.8 + Math.random() * 4;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), dark);
    m.position.set(Math.cos(a) * r, -2.2 + s * 0.3, Math.sin(a) * r); m.rotation.set(Math.random() * 3, Math.random() * 3, 0); m.scale.y = 0.6 + Math.random(); scene.add(m);
  }

  // Braseros
  const braziers = [];
  for (let i = 0; i < 4; i++) {
    const a = i * (TAU / 4) + TAU / 8, x = Math.cos(a) * 21.3, z = Math.sin(a) * 21.3;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 1.6, 6), stone); foot.position.set(x, 0.8, z); foot.castShadow = true;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.45, 0.6, 8), stone); bowl.position.set(x, 1.9, z); bowl.castShadow = true;
    const coal = new THREE.Mesh(new THREE.CircleGeometry(0.85, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.4, 0.3) })); coal.position.set(x, 2.21, z);
    const light = new THREE.PointLight(0xff7a30, 90, 26, 1.8); light.position.set(x, 3.4, z);
    scene.add(foot, bowl, coal, light); braziers.push({ x, z, light, ph: Math.random() * 9 });
  }

  return {
    sun,
    update(t, dt, focus) {
      const pulse = 0.38 + Math.sin(t * 1.3) * 0.14;
      for (const r of runes) r.material.opacity = pulse;
      for (const b of braziers) {
        b.light.intensity = 85 + Math.sin(t * 11 + b.ph) * 14 + Math.sin(t * 23 + b.ph) * 8;
        for (let k = 0; k < 2; k++) fx.emit(b.x + (Math.random() - 0.5) * 1.1, 2.2, b.z + (Math.random() - 0.5) * 1.1,
          (Math.random() - 0.5) * 0.5, 1.6 + Math.random() * 2.2, (Math.random() - 0.5) * 0.5, 3.4, 1.1 + Math.random() * 0.6, 0.2, 0.75, 0.45 + Math.random() * 0.4, -1.5, 0.6);
      }
      // braises flottantes
      if (Math.random() < dt * 90) {
        const a = Math.random() * TAU, r = Math.random() * 24;
        fx.emit(focus.x + Math.cos(a) * r, Math.random() * 1.5, focus.z + Math.sin(a) * r,
          (Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 1.2, (Math.random() - 0.5) * 0.8, 3, 1 + Math.random(), 0.2, 0.13 + Math.random() * 0.1, 3 + Math.random() * 3, -0.1, 0.1);
      }
    },
  };
}
