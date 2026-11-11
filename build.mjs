// Construit le jeu en UN seul fichier index.html autonome (aucune dépendance réseau).
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const out = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none' });
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync('src/index.template.html', 'utf8').replace('<!--BUNDLE-->', () => `<script>${js}</script>`);
writeFileSync('index.html', html);
console.log(`index.html : ${(html.length / 1024).toFixed(0)} Ko`);
