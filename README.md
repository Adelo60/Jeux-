# BRAISE — Le Dernier Gardien

Action-roguelite 3D pour mobile (et PC), jouable dans le navigateur, installable comme une app (PWA).

- **Combat** : combo en 3 coups, esquive avec ralenti sur « esquive parfaite », renvoi des projectiles, attaque de Fureur.
- **Compétences** : Lance de braise (tir perforant), Tourbillon (zone), Ruée foudroyante (charge), chacune avec son temps de recharge.
- **Son** : musique adaptative (menu / combat / boss), bruitages et réverbération entièrement synthétisés.
- **Contenu** : vagues infinies, 3 types d'ennemis, boss toutes les 5 vagues, 11 bénédictions à cumuler, forge d'améliorations permanentes.
- **Technique** : Three.js, ombres, bloom HDR, particules, sons synthétisés — aucun asset externe, un seul fichier `index.html`.

## Jouer
Ouvrir `index.html` (ou héberger le dépôt : GitHub Pages, Netlify…).
Mobile : joystick à gauche, boutons à droite. PC : ZQSD/flèches, J ou clic = attaque, Espace/K = esquive, L = fureur.

## Développer
```
npm install
npm run build   # src/ -> index.html
```
Code dans `src/` : `main.js` (jeu), `actors.js` (héros, ennemis, IA), `world.js` (décor), `fx.js` (effets), `audio.js`, `ads.js`.

## Monétisation
`src/ads.js` centralise les pubs récompensées (revivre, doubler les braises). C'est aujourd'hui une simulation :
pour encaisser de vrais revenus, emballer le jeu avec Capacitor (Android/iOS) et y brancher AdMob.
