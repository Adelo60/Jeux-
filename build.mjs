// Construit le jeu en UN seul fichier index.html autonome (modèles, animations et textures inclus).
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const b64 = f => readFileSync('assets/' + f).toString('base64');
writeFileSync('src/assets.gen.js', `// Fichier généré par build.mjs — ne pas modifier.
export const A = {
  paladin: '${b64('paladin.glb')}',
  mutant: '${b64('mutant.glb')}',
  warrok: '${b64('warrok.glb')}',
  floor: 'data:image/webp;base64,${b64('floor.webp')}',
  wall: 'data:image/webp;base64,${b64('wall.webp')}',
  anims: ${readFileSync('assets/anims.json', 'utf8')},
};
`);
const out = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none' });
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync('src/index.template.html', 'utf8').replace('<!--BUNDLE-->', () => `<script>${js}</script>`);
writeFileSync('index.html', html);
console.log(`index.html : ${(html.length / 1024 / 1024).toFixed(1)} Mo`);
