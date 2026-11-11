import * as THREE from 'three';

// ---------- Particules (pool unique, additif, HDR pour le bloom) ----------
export class Particles {
  constructor(scene, max = 2600) {
    this.max = max; this.cur = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.base = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.bsize = new Float32Array(max);
    this.life = new Float32Array(max);
    this.mlife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: `attribute float aSize; attribute vec3 color; varying vec3 vC; uniform float uScale;
        void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=aSize*uScale/max(.1,-mv.z); }`,
      fragmentShader: `varying vec3 vC; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d); gl_FragColor=vec4(vC*a*a,1.); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.geo = g;
  }
  emit(x, y, z, vx, vy, vz, r, g, b, size, life, grav = 0, drag = 0) {
    const i = this.cur; this.cur = (i + 1) % this.max; const j = i * 3;
    this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z;
    this.vel[j] = vx; this.vel[j + 1] = vy; this.vel[j + 2] = vz;
    this.base[j] = r; this.base[j + 1] = g; this.base[j + 2] = b;
    this.bsize[i] = size; this.life[i] = this.mlife[i] = life; this.grav[i] = grav; this.drag[i] = drag;
  }
  burst(x, y, z, n, c, speed, size = 0.35, life = 0.5, grav = 9, up = 0.5) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.283, e = Math.random() * 2 - 1 + up, s = speed * (0.3 + Math.random() * 0.7);
      const h = Math.sqrt(Math.max(0, 1 - Math.min(1, e * e)));
      this.emit(x, y, z, Math.cos(a) * h * s, e * s, Math.sin(a) * h * s, c[0], c[1], c[2],
        size * (0.5 + Math.random()), life * (0.5 + Math.random() * 0.8), grav, 2.5);
    }
  }
  update(dt) {
    const { pos, vel, col, base, size, bsize, life, mlife, grav, drag } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) continue;
      const j = i * 3;
      life[i] -= dt;
      if (life[i] <= 0) { size[i] = 0; continue; }
      const k = life[i] / mlife[i], d = Math.max(0, 1 - drag[i] * dt);
      vel[j + 1] -= grav[i] * dt;
      vel[j] *= d; vel[j + 1] *= d; vel[j + 2] *= d;
      pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
      if (pos[j + 1] < 0.03 && grav[i] > 0) { pos[j + 1] = 0.03; vel[j + 1] *= -0.35; }
      col[j] = base[j] * k; col[j + 1] = base[j + 1] * k; col[j + 2] = base[j + 2] * k;
      size[i] = bsize[i] * (0.35 + 0.65 * k);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
}

// ---------- Traînée d'épée ----------
export class Trail {
  constructor(scene, n = 14, color = [1.3, 0.45, 0.09]) {
    this.n = n; this.color = color;
    this.p = new Float32Array(n * 6); this.c = new Float32Array(n * 6); this.pw = new Float32Array(n); this.tm = new Float32Array(n);
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.c, 3));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 4;
    scene.add(this.mesh);
  }
  push(a, b, power, now = 0) {
    const { p, pw, n, tm } = this;
    p.copyWithin(6, 0, (n - 1) * 6); pw.copyWithin(1, 0, n - 1); tm.copyWithin(1, 0, n - 1); tm[0] = now;
    p[0] = a.x; p[1] = a.y; p[2] = a.z; p[3] = b.x; p[4] = b.y; p[5] = b.z; pw[0] = power;
    for (let i = 0; i < n; i++) {
      const k = pw[i] * (1 - i / (n - 1)) * Math.max(0, 1 - (now - tm[i]) / 0.17);
      for (let v = 0; v < 2; v++) {
        const j = i * 6 + v * 3, m = v ? k * k : 0;
        this.c[j] = this.color[0] * m; this.c[j + 1] = this.color[1] * m; this.c[j + 2] = this.color[2] * m;
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }
}

// ---------- Anneaux d'onde de choc + télégraphes d'attaque ----------
const ringGeo = new THREE.RingGeometry(0.86, 1, 56).rotateX(-Math.PI / 2);
const discGeo = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
const rectGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
const addMat = (color, op) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });

let _soft = null;
function softTex() {
  if (_soft) return _soft;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.55, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); return (_soft = new THREE.CanvasTexture(c));
}

export class GroundFx {
  constructor(scene) { this.scene = scene; this.items = []; }
  ring(x, z, r0, r1, dur, color = 0xff8a3c, intensity = 2.5) {
    const m = new THREE.Mesh(ringGeo, addMat(color, 1));
    m.material.color.multiplyScalar(intensity);
    m.position.set(x, 0.06, z); this.scene.add(m);
    this.items.push({ m, t: 0, dur, kind: 'ring', r0, r1 });
  }
  circle(x, z, r, dur) {
    const g = new THREE.Group();
    const out = new THREE.Mesh(discGeo, addMat(0xff1a2a, 0.16)); out.scale.setScalar(r);
    const edge = new THREE.Mesh(ringGeo, addMat(0xff2a3a, 0.9)); edge.scale.setScalar(r); edge.material.color.multiplyScalar(2);
    const fill = new THREE.Mesh(discGeo, addMat(0xff3020, 0.3)); fill.position.y = 0.01;
    g.add(out, edge, fill); g.position.set(x, 0.05, z); this.scene.add(g);
    const it = { m: g, t: 0, dur, kind: 'tele', fill, r }; this.items.push(it); return it;
  }
  rect(x, z, ang, w, l, dur) {
    const g = new THREE.Group();
    const out = new THREE.Mesh(rectGeo, addMat(0xff1a2a, 0.2)); out.scale.set(w, 1, l);
    const fill = new THREE.Mesh(rectGeo, addMat(0xff3020, 0.35)); fill.position.y = 0.01;
    g.add(out, fill); g.position.set(x, 0.05, z); g.rotation.y = ang; this.scene.add(g);
    const it = { m: g, t: 0, dur, kind: 'rect', fill, w, l }; this.items.push(it); return it;
  }
  scorch(x, z, r) {
    const g = new THREE.Group(), tex = softTex();
    const dark = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true, opacity: 0.75, depthWrite: false })); dark.scale.setScalar(r);
    const glow = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(3, 0.9, 0.15), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); glow.scale.setScalar(r * 0.75); glow.position.y = 0.005;
    g.add(dark, glow); g.position.set(x, 0.035, z); this.scene.add(g);
    this.items.push({ m: g, t: 0, dur: 8, kind: 'scorch', dark, glow });
  }
  cancel(it) { if (it) it.t = it.dur; }
  clear() { for (const it of this.items) this.scene.remove(it.m); this.items.length = 0; }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.t += dt; const k = Math.min(1, it.t / it.dur);
      if (it.kind === 'ring') {
        const e = 1 - (1 - k) * (1 - k);
        it.m.scale.setScalar(it.r0 + (it.r1 - it.r0) * e); it.m.material.opacity = 1 - k;
      } else if (it.kind === 'scorch') { it.dark.material.opacity = 0.75 * (1 - k * k); it.glow.material.opacity = Math.max(0, 1 - it.t / 1.8) * 0.7; }
      else if (it.kind === 'tele') it.fill.scale.setScalar(Math.max(0.01, it.r * k));
      else it.fill.scale.set(it.w, 1, Math.max(0.01, it.l * k));
      if (k >= 1) {
        this.scene.remove(it.m);
        it.m.traverse(o => o.material && o.material.dispose());
        this.items.splice(i, 1);
      }
    }
  }
}

// ---------- Étalonnage final : aberration chromatique, teinte ciné, vignette, grain ----------
export const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uFx: { value: 0 }, uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uFx,uTime; varying vec2 vUv;
    void main(){ vec2 d=vUv-.5; float r2=dot(d,d); vec2 o=d*r2*(.014+.04*uFx);
      vec3 c=vec3(texture2D(tDiffuse,vUv+o).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-o).b);
      float l=dot(c,vec3(.299,.587,.114));
      c=mix(vec3(l),c,1.04-.5*uFx);
      c*=mix(vec3(.94,.98,1.1),vec3(1.08,1.,.9),smoothstep(0.,.9,l));
      c+=vec3(.08,.3,.55)*uFx*.05;
      c*=1.-r2*(.75+uFx*.9);
      float n=fract(sin(dot(vUv*vec2(1920.,1080.)+uTime*61.,vec2(12.9898,78.233)))*43758.5453); c*=1.+(n-.5)*.05;
      gl_FragColor=vec4(max(c,0.),1.); }`,
};
