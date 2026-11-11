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
  warrok: { idle: ['midle', 0, 2.6], run: ['mrun'], walk: ['mwalk'], slam: ['mjump', 0.9, 2.7], roar: ['mroar', 0.7, 2.5], die: ['mdie', 0.3, 2.7] },
};

function bytes(b64) { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }
function image(url) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }); }

// Carte de relief (normal map) calculée à partir de la photo
function normalFrom(img, strength) {
  const w = img.width, h = img.height, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const src = g.getImageData(0, 0, w, h), d = src.data, L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
  const out = g.createImageData(w, h), o = out.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const xl = (x + w - 1) % w, xr = (x + 1) % w, yu = ((y + h - 1) % h) * w, yd = ((y + 1) % h) * w, i = y * w + x;
    let nx = (L[y * w + xl] - L[y * w + xr]) * strength, ny = (L[yd + x] - L[yu + x]) * strength; const l = 1 / Math.hypot(nx, ny, 1);
    o[i * 4] = (nx * l * 0.5 + 0.5) * 255; o[i * 4 + 1] = (ny * l * 0.5 + 0.5) * 255; o[i * 4 + 2] = (l * 0.5 + 0.5) * 255; o[i * 4 + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}

export async function loadAssets(progress = () => {}) {
  const pack = unpackAnims(A.anims), loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  // Force le chargement des textures par <img> (compatible avec toutes les politiques de sécurité)
  const cib = window.createImageBitmap; let n = 0;
  for (const name of ['paladin', 'mutant', 'warrok']) {
    try { window.createImageBitmap = undefined; } catch (e) { /* lecture seule */ }
    const p = new Promise((res, rej) => loader.parse(bytes(A[name]), '', res, rej));
    try { window.createImageBitmap = cib; } catch (e) { /* ignore */ }
    const gltf = await p, scene = gltf.scene;
    scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.material.envMapIntensity = 1; if (o.material.map) o.material.map.anisotropy = 4; } });
    const rig = prepRig(scene), clips = {};
    for (const k in CLIPS[name]) { const [src, from, to] = CLIPS[name][k]; clips[k] = makeClip(pack, src, rig, { from, to, name: k }); }
    const box = new THREE.Box3().setFromObject(scene);
    assets[name] = { scene, clips, height: box.max.y - box.min.y };
    progress(++n / 4);
  }
  for (const k of ['floor', 'wall']) {
    const img = await image(A[k]), t = new THREE.Texture(img);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.needsUpdate = true;
    assets[k] = t; assets[k + 'N'] = normalFrom(img, k === 'floor' ? 5 : 4);
  }
  progress(1);
}
