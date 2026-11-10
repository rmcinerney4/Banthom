// Bundles src/ into one self-contained HTML page. React 18 UMD loads from cdnjs at runtime.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

// Prefer a local `npm install`; fall back to the tool folder used when this was first built.
let esbuild;
try { esbuild = createRequire(import.meta.url)('esbuild'); } catch { esbuild = createRequire('/opt/npm-tools/node_modules/')('esbuild'); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const minify = process.argv.includes('--min');

const globals = {
  name: 'react-globals',
  setup(b) {
    b.onResolve({ filter: /^react(-dom(\/client)?)?$/ }, (a) => ({ path: a.path, namespace: 'rg' }));
    b.onLoad({ filter: /.*/, namespace: 'rg' }, (a) => ({
      contents: a.path === 'react' ? 'module.exports = window.React;' : 'module.exports = window.ReactDOM;',
      loader: 'js',
    }));
  },
};

const result = await esbuild.build({
  entryPoints: [path.join(ROOT, 'src/main.jsx')],
  bundle: true,
  format: 'iife',
  write: false,
  minify,
  target: ['es2020'],
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  plugins: [globals],
  logLevel: 'warning',
  legalComments: 'none',
  charset: 'utf8',
});

const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const styleDir = path.join(ROOT, 'src/styles');
const css = fs.readdirSync(styleDir).filter((f) => f.endsWith('.css')).sort()
  .map((f) => fs.readFileSync(path.join(styleDir, f), 'utf8')).join('\n');

const html = `<title>Banthom</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<style>
${css}
</style>
<div id="root"><div class="boot" role="status">Loading Banthom…</div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>
${js}
</script>
`;

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/banthom.html'), html);
console.log(`built dist/banthom.html  ${(html.length / 1024).toFixed(1)} KB  (js ${(js.length / 1024).toFixed(1)} KB, css ${(css.length / 1024).toFixed(1)} KB)`);
