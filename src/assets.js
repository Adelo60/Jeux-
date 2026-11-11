import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { A } from './assets.gen.js';
import { unpackAnims, prepRig, makeClip } from './rig.js';

// Modèles, animations et textures embarqués dans le fichier (aucun téléchargement).
export const assets = {};

// [clip source, début, fin] en secondes
const CLIPS = {
  paladin: { idle: ['idle', 0, 3.6], run: ['run'], s0: ['slash1', 0.45, 1.2], s1: ['attack', 0.3, 1.0], s2: ['slash5', 0.9, 1.85], fury: ['slash5', 0.75, 1.95], thrust: ['gattack', 0.15, 0.9], jump: ['jump'], death: ['death', 0, 2.7] },
  mutant: { idle: ['midle', 0, 2.6], run: ['mrun'], walk: ['mwalk'], atk: ['mpunch'], cast: ['mroar', 0.7, 2.3], die: ['mdie', 0.3, 2.7] },
  ganfaul: { idle: ['midle', 0, 2.6], walk: ['mwalk'], cast: ['mroar', 0.7, 2.3], die: ['mdie', 0.3, 2.7] },
  ghoul: { idle: ['midle', 0, 2.6], run: ['mrun'], atk: ['mpunch'], die: ['mdie', 0.3, 2.7] },
  maw: { idle: ['midle', 0, 2.6], run: ['mrun'], walk: ['mwalk'], slam: ['mjump', 0.9, 2.7], roar: ['mroar', 0.7, 2.5], die: ['mdie', 0.3, 2.7] },
  warrok: { idle: ['midle', 0, 2.6], run: ['mrun'], walk: ['mwalk'], slam: ['mjump', 0.9, 2.7], roar: ['mroar', 0.7, 2.5], die: ['mdie', 0.3, 2.7] },
};

function bytes(b64) { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }
function image(url) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }); }

export async function loadAssets(progress = () => {}) {
  const pack = unpackAnims(A.anims), loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  // Force le chargement des textures par <img> (compatible avec toutes les politiques de sécurité)
  const cib = window.createImageBitmap, names = Object.keys(A.glb), total = names.length + 1; let n = 0;
  for (const name of names) {
    try { window.createImageBitmap = undefined; } catch (e) { /* lecture seule */ }
    const p = new Promise((res, rej) => loader.parse(bytes(A.glb[name]), '', res, rej));
    try { window.createImageBitmap = cib; } catch (e) { /* ignore */ }
    const gltf = await p, scene = gltf.scene;
    scene.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.isSkinnedMesh) o.frustumCulled = false; if (o.material.map) o.material.map.anisotropy = 4; } });
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene), size = box.getSize(new THREE.Vector3());
    if (CLIPS[name]) {
      const rig = prepRig(scene), clips = {};
      for (const k in CLIPS[name]) { const [src, from, to] = CLIPS[name][k]; clips[k] = makeClip(pack, src, rig, { from, to, name: k }); }
      assets[name] = { scene, clips, height: size.y };
    } else assets[name] = { scene, size, min: box.min.clone() };
    progress(++n / total);
  }
  for (const k in A.img) {
    const img = await image(A.img[k]), t = new THREE.Texture(img);
    if (!/_n$|_arm$/.test(k)) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.needsUpdate = true; assets[k] = t;
  }
  progress(1);
}
