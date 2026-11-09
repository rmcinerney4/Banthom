// Extracts the Lucide icons the prototype uses from react-icons/lu into a compact data module.
const fs = require('fs');
const path = require('path');
// Resolve react-icons from a local install first, then from the global folder used originally.
const base = (() => { try { return path.dirname(require.resolve('react-icons/package.json')); } catch { return '/home/claude/.npm-global/lib/node_modules/react-icons'; } })();

// Stub react-icons' GenIcon so each export returns its raw SVG tree instead of a React element.
const libPath = require.resolve(path.join(base, 'lib'));
require.cache[libPath] = { id: libPath, filename: libPath, loaded: true, exports: { GenIcon: (data) => () => data } };
const lu = require(path.join(base, 'lu'));

const NAMES = `search bell bell-ring bell-plus bookmark star filter list-filter sliders-horizontal columns-3 download
link link-2 refresh-cw info external-link chevron-down chevron-right chevron-left chevron-up chevrons-up-down
sparkles shield shield-check shield-alert chart-line chart-column chart-spline layout-dashboard list table table-2
git-compare git-compare-arrows arrow-left-right file-text newspaper eye eye-off layout-grid panels-top-left
circle-help settings user user-round menu x plus check circle-check triangle-alert circle-alert clock calendar
calendar-days arrow-up-right arrow-down-right arrow-right arrow-left arrow-up arrow-down arrow-up-down ellipsis copy share-2
landmark vote globe trending-up trending-down activity wifi-off database scale book-open file-check history
layers panel-left panel-left-close panel-left-open command keyboard mail lock log-in trash-2 pencil radio
circle-dot gauge quote message-square send building-2 users briefcase flag timer hourglass percent coins
scan-search badge-check ban circle-dashed undo-2 save rotate-ccw grip-vertical sun moon monitor play pause
crosshair target radar circle-x equal-not rss inbox list-checks file-search microscope lightbulb network
workflow book-marked notebook-pen sticky-note layout-template panel-right gavel scroll-text unplug plug
circle-minus minus circle-plus arrow-right-left sigma calculator chart-bar signal waves split move-up move-down`
  .split(/\s+/).filter(Boolean);

const pascal = (s) => s.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
const compact = (node) => {
  const attr = { ...node.attr };
  const out = [node.tag, attr];
  if (node.child && node.child.length) out.push(node.child.map(compact));
  return out;
};

const icons = {};
const missing = [];
for (const n of NAMES) {
  const fn = lu['Lu' + pascal(n)];
  if (!fn) { missing.push(n); continue; }
  const tree = fn();
  icons[n] = (tree.child || []).map(compact);
}
if (missing.length) { console.error('Missing icons:', missing.join(', ')); process.exit(1); }
const out = '// Generated from react-icons/lu (Lucide, ISC licence). Do not edit by hand.\nexport const ICONS = ' + JSON.stringify(icons) + ';\n';
fs.writeFileSync(path.join(__dirname, '../src/icons.js'), out);
console.log('icons:', Object.keys(icons).length, 'bytes:', out.length);
