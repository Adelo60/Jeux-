import * as THREE from 'three';

// Animations stockées comme rotations « monde » relatives à la pose en T : elles se
// réappliquent à n'importe quel squelette humanoïde (mêmes noms d'os, même pose de repos).
const PARENT = { Hips: null, Spine: 'Hips', Spine1: 'Spine', Spine2: 'Spine1', Neck: 'Spine2', Head: 'Neck',
  LeftShoulder: 'Spine2', LeftArm: 'LeftShoulder', LeftForeArm: 'LeftArm', LeftHand: 'LeftForeArm',
  RightShoulder: 'Spine2', RightArm: 'RightShoulder', RightForeArm: 'RightArm', RightHand: 'RightForeArm',
  LeftUpLeg: 'Hips', LeftLeg: 'LeftUpLeg', LeftFoot: 'LeftLeg', LeftToeBase: 'LeftFoot',
  RightUpLeg: 'Hips', RightLeg: 'RightUpLeg', RightFoot: 'RightLeg', RightToeBase: 'RightFoot' };

function b64(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; }
export function unpackAnims(pack) {
  const out = {};
  for (const k in pack.clips) { const c = pack.clips[k]; out[k] = { fps: c.fps, n: c.n, q: new Int16Array(b64(c.q)), h: new Float32Array(b64(c.h)) }; }
  return { canon: pack.canon, clips: out };
}

// À appeler sur le modèle au repos (pose en T), avant toute mise à l'échelle.
export function prepRig(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), bones = {}, bindW = {}, m = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3();
  root.traverse(n => { const r = /^mixamorig\d*:?(.+)$/.exec(n.name); if (r && r[1] in PARENT && !bones[r[1]]) bones[r[1]] = n; });
  for (const k in bones) { const q = new THREE.Quaternion(); m.multiplyMatrices(inv, bones[k].matrixWorld).decompose(p, q, s); bindW[k] = q; }
  const hp = bones.Hips.parent, hipsParentInv = new THREE.Matrix4().multiplyMatrices(inv, hp.matrixWorld), hpQ = new THREE.Quaternion();
  hipsParentInv.decompose(p, hpQ, s); hipsParentInv.invert();
  const hipsBind = new THREE.Vector3().setFromMatrixPosition(m.multiplyMatrices(inv, bones.Hips.matrixWorld));
  return { bones, bindW, hipsParentInv, hipsParentQ: hpQ, hipsBind };
}

// Construit un AnimationClip pour ce squelette. opts : { from, to (secondes), rootXZ (garder le déplacement), name }
export function makeClip(pack, name, rig, opts = {}) {
  const a = pack.clips[name], C = pack.canon, nb = C.length;
  const f0 = Math.max(0, Math.round((opts.from || 0) * a.fps)), f1 = Math.min(a.n - 1, opts.to ? Math.round(opts.to * a.fps) : a.n - 1), n = f1 - f0 + 1;
  const times = new Float32Array(n), vals = {}, W = {}, q = new THREE.Quaternion(), pi = new THREE.Quaternion(), v = new THREE.Vector3();
  const used = C.filter(c => rig.bones[c]); for (const c of used) vals[c] = new Float32Array(n * 4);
  const hips = new Float32Array(n * 3), H = rig.hipsBind.y;
  for (let f = 0; f < n; f++) {
    times[f] = f / a.fps; const src = f0 + f;
    for (let i = 0; i < nb; i++) {
      const c = C[i]; if (!rig.bones[c]) continue; const k = (src * nb + i) * 4;
      q.set(a.q[k], a.q[k + 1], a.q[k + 2], a.q[k + 3]).normalize();
      const w = (W[c] = W[c] || new THREE.Quaternion()).copy(q).multiply(rig.bindW[c]);
      const par = PARENT[c]; pi.copy(par ? W[par] : rig.hipsParentQ).invert();
      q.copy(pi).multiply(w); vals[c].set([q.x, q.y, q.z, q.w], f * 4);
    }
    v.set(opts.rootXZ ? a.h[src * 3] * H : rig.hipsBind.x, a.h[src * 3 + 1] * H, opts.rootXZ ? a.h[src * 3 + 2] * H : rig.hipsBind.z).applyMatrix4(rig.hipsParentInv);
    hips.set([v.x, v.y, v.z], f * 3);
  }
  const tracks = used.map(c => new THREE.QuaternionKeyframeTrack(rig.bones[c].name + '.quaternion', times, vals[c]));
  tracks.push(new THREE.VectorKeyframeTrack(rig.bones.Hips.name + '.position', times, hips));
  return new THREE.AnimationClip(opts.name || name, times[n - 1], tracks);
}
