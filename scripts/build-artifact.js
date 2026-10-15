// Empaqueta el modo local (motor + tablero + controles) en un solo HTML.
// Uso: npm run build:artifact   (requiere esbuild: npm i -D esbuild)
//      ESBUILD=/ruta/a/esbuild node scripts/build-artifact.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const esbuild = await import(process.env.ESBUILD ? pathToFileURL(path.join(process.env.ESBUILD, 'lib', 'main.js')).href : 'esbuild');
const build = esbuild.build || esbuild.default.build;

// Incrusta personajes y logo como data URIs para que el artefacto no dependa del servidor.
const imagesPlugin = {
  name: 'inline-images',
  setup(b) {
    b.onLoad({ filter: /public[\\/]js[\\/]images\.js$/ }, () => {
      const uri = (f, mime) => `data:${mime};base64,${fs.readFileSync(path.join(ROOT, 'public', f)).toString('base64')}`;
      const chars = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`c${i + 1}`, uri(`img/chars/c${i + 1}.webp`, 'image/webp')]));
      return {
        contents: `export const CHAR_SRC = ${JSON.stringify(chars)};\nexport const PEMOL_LOGO = ${JSON.stringify(uri('img/pemol-logo.png', 'image/png'))};`,
        loader: 'js',
      };
    });
  },
};

const res = await build({
  plugins: [imagesPlugin],
  entryPoints: [path.join(ROOT, 'artifact', 'entry.js')],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  minify: true,
  write: false,
  legalComments: 'none',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync(path.join(ROOT, 'public', 'css', 'game.css'), 'utf8')
  + '\n' + fs.readFileSync(path.join(ROOT, 'artifact', 'local.css'), 'utf8');
const tpl = fs.readFileSync(path.join(ROOT, 'artifact', 'template.html'), 'utf8');
const out = tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
// 1) fragmento para publicar como Artifact (sin <html>/<head>/<body>)
fs.writeFileSync(path.join(ROOT, 'dist', 'artifact-fragment.html'), out);
// 2) página completa que se abre directo en el navegador (doble clic)
const full = `<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${out}\n</body>\n</html>\n`;
const file = path.join(ROOT, 'dist', 'michelsons-arcade.html');
fs.writeFileSync(file, full);
console.log(`Listo: ${path.relative(ROOT, file)} (${(full.length / 1024).toFixed(0)} KB)`);
