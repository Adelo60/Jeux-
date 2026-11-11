// Construit le jeu en UN seul fichier index.html autonome (modèles, animations et textures inclus).
import { build } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs';

const files = readdirSync('assets'), b64 = f => readFileSync('assets/' + f).toString('base64');
const glb = files.filter(f => f.endsWith('.glb')).map(f => `    ${f.slice(0, -4)}: '${b64(f)}',`).join('\n');
const img = files.filter(f => f.endsWith('.webp')).map(f => `    ${f.slice(0, -5)}: 'data:image/webp;base64,${b64(f)}',`).join('\n');
writeFileSync('src/assets.gen.js', `// Fichier généré par build.mjs — ne pas modifier.
export const A = {
  glb: {\n${glb}\n  },
  img: {\n${img}\n  },
  anims: ${readFileSync('assets/anims.json', 'utf8')},
};
`);
const out = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none' });
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync('src/index.template.html', 'utf8').replace('<!--BUNDLE-->', () => `<script>${js}</script>`);
writeFileSync('index.html', html);
// Copie pour l'application mobile (Capacitor)
mkdirSync('www', { recursive: true });
for (const f of ['index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png']) copyFileSync(f, 'www/' + f);
console.log(`index.html : ${(html.length / 1024 / 1024).toFixed(1)} Mo`);
