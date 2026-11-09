// Test-only: bundles the local React 19 build as window.React / window.ReactDOM globals,
// standing in for the cdnjs React 18 UMD scripts when Playwright renders the page offline.
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire('/opt/npm-tools/node_modules/');
const esbuild = require('esbuild');

const res = await esbuild.build({
  stdin: {
    contents: "window.React = require('react'); window.ReactDOM = Object.assign({}, require('react-dom'), require('react-dom/client'));",
    resolveDir: '/opt/npm-tools/node_modules',
  },
  bundle: true,
  format: 'iife',
  write: false,
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
});
fs.writeFileSync('/home/claude/banthom/build/react-shim.js', res.outputFiles[0].text);
console.log('shim bytes', res.outputFiles[0].text.length);
