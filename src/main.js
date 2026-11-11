import { loadAssets } from './assets.js';

// Charge les modèles 3D puis démarre le jeu.
const bar = document.getElementById('loadbar'), box = document.getElementById('load');
loadAssets(p => { if (bar) bar.style.transform = `scaleX(${p})`; })
  .then(() => import('./game.js'))
  .then(() => { if (box) box.classList.add('hidden'); })
  .catch(e => { if (box) box.querySelector('p').textContent = 'Erreur de chargement : ' + (e && e.message ? e.message : e); console.error(e); });
