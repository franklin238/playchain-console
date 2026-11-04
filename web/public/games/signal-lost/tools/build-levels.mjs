// Builds levels.js from handmade ASCII layouts + curated generator seeds.
// Every level is solved by the engine's solver, which sets par. Run: node tools/build-levels.mjs
import '../engine.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const SL = globalThis.SL;
const here = dirname(fileURLToPath(import.meta.url));

// Glyphs describe the SOLVED layout. Options say which tiles go to inventory, which are locked,
// and the scramble applied to rotatable fixed tiles.
const G = {
  '│': ['straight', 0], '─': ['straight', 1],
  '└': ['corner', 0], '┌': ['corner', 1], '┐': ['corner', 2], '┘': ['corner', 3],
  '┬': ['tee', 0], '┤': ['tee', 1], '┴': ['tee', 2], '├': ['tee', 3],
  'B': ['booster', 0], 'b': ['booster', 1],
  'A': ['tuner', 0, 'amber'], 'a': ['tuner', 1, 'amber'], 'V': ['tuner', 0, 'violet'], 'v': ['tuner', 1, 'violet'],
  'E': ['tuner', 0, 'teal'], 'e': ['tuner', 1, 'teal'],
  '┼': ['bridge', 0],
};
const RECV = { R: 'any', Q: 'amber', P: 'violet', O: 'teal' };

function fromAscii(id, rows, o = {}) {
  const H = rows.length, W = [...rows[0]].length;
  const lv = { id, size: [W, H], tower: null, receivers: [], decoys: [], static: [], fixed: [], inventory: {}, par: null, seed: null };
  const rng = SL.mulberry32(SL.hashStr(id));
  const inv = (o.inv || []).map(p => p.join(','));
  const lock = (o.lock || []).map(p => p.join(','));
  const keep = (o.keep || []).map(p => p.join(','));
  const rotSet = o.rot || {};
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const k = x + ',' + y;
    if (ch === 'T') lv.tower = { x, y, edges: o.edges || ['E'], freq: o.freq || 'teal', strength: o.strength || 6 };
    else if (RECV[ch]) lv.receivers.push({ x, y, freq: RECV[ch] });
    else if (ch === 'X') lv.decoys.push({ x, y });
    else if (ch === '#') lv.static.push([x, y]);
    else if (ch === 'S' || ch === 's') {
      const r = rotSet[k] ?? 0;
      lv.fixed.push({ x, y, type: 'dish', rot: r, pair: ch === 'S' ? 'a' : 'b', ...(o.dishLock ? { rotatable: false } : {}) });
    } else if (G[ch]) {
      const [type, r, freq] = G[ch];
      if (o.allInv && !keep.includes(k) || inv.includes(k)) { const key = SL.keyOf(type, freq); lv.inventory[key] = (lv.inventory[key] || 0) + 1; return; }
      const per = SL.PERIOD[type];
      let r0 = r;
      if (k in rotSet) r0 = rotSet[k];
      else if (!lock.includes(k) && !keep.includes(k) && per > 1) r0 = (r + 1 + Math.floor(rng() * (per - 1))) % per;
      const f = { x, y, type, rot: r0 };
      if (freq) f.freq = freq;
      if (lock.includes(k)) f.rotatable = false;
      lv.fixed.push(f);
    }
  }));
  for (const [k, n] of Object.entries(o.extraInv || {})) lv.inventory[k] = (lv.inventory[k] || 0) + n;
  for (const d of o.distract || []) lv.fixed.push({ x: d[0], y: d[1], type: d[2], rot: d[3] || 0 });
  return lv;
}

const R = [];
// ---------------- Region 1: The Outskirts ----------------
R.push([
  // 1-1: tower, one receiver, two straights turned the wrong way (spec 9, teaching without text)
  fromAscii('1-1', [
    '.....',
    '.....',
    'T──R.',
    '.....',
    '.....'], { rot: { '1,2': 0, '2,2': 0 } }),
  // 1-2: corners
  fromAscii('1-2', [
    '.....',
    '.┌─┐.',
    'T┘.│.',
    '...R.',
    '.....']),
  // 1-3: place a relay from the inventory into the gap
  fromAscii('1-3', [
    '.....',
    '.....',
    'T───R',
    '.....',
    '.....'], { inv: [[2, 2]], keep: [[1, 2], [3, 2]] }),
  // 1-4: strength: the short route is the only one that reaches
  // 1-4: strength fades per relay; the long loop dies, the short line reaches
  fromAscii('1-4', [
    '......',
    '.┌──┐.',
    '.│..│.',
    'T────R',
    '......'], { strength: 5, inv: [[2, 3], [3, 3]], keep: [[1, 3], [4, 3]], distract: [] }),
]);
// ---------------- Region 2: Junction Town ----------------
R.push([
  fromAscii('2-1', [
    '.....',
    '..R..',
    'T─┤..',
    '..R..',
    '.....'], { rot: { '2,2': 0 } }),
  fromAscii('2-2', [
    '..R...',
    '..│...',
    'T─┤.R.',
    '..└─┘.',
    '......']),
  fromAscii('2-3', [
    '......',
    '.R..R.',
    '.│..│.',
    'T┴──┘.',
    '......'], { inv: [[1, 3]] }),
]);
// ---------------- Region 3: Static Fields ----------------
R.push([
  fromAscii('3-1', [
    '.....',
    '.┌─┐.',
    'T┘#└R',
    '.....',
    '.....']),
  fromAscii('3-2', [
    '.......',
    '.......',
    'T──b──R',
    '.......',
    '.......'], { strength: 3, rot: { '3,2': 0 } }),
  fromAscii('3-3', [
    '.......',
    '.┌─b─┐.',
    'T┘###└R',
    '.......',
    '.......'], { strength: 4, inv: [[3, 1]] }),
]);
// ---------------- Region 4: Frequency Bay ----------------
R.push([
  fromAscii('4-1', [
    '.....',
    '.....',
    'T─a─Q',
    '.....',
    '.....'], { rot: { '2,2': 0 } }),
  fromAscii('4-2', [
    '...R..',
    '...│..',
    'T──┤..',
    '...└aQ',
    '......']),
  fromAscii('4-3', [
    '......',
    '.O..Q.',
    '.│..│.',
    'T┴─a┘.',
    '......'], { inv: [[3, 3]] }),
]);
// ---------------- Region 5: Overpass ----------------
R.push([]);

// 5-x handmade: tower emits two edges (E and S) so lines cross on a bridge.
R[4].push(fromAscii('5-1', [
  '..R..',
  '..│..',
  'T─┼─R',
  '│.│..',
  '└─┘..'], { edges: ['E', 'S'], strength: 8, keep: [[2, 2]] }));
R[4].push(fromAscii('5-2', [
  '...R..',
  '...│..',
  'T──┼─R',
  '│..│..',
  '└──┘..'], { edges: ['E', 'S'], strength: 9, inv: [[3, 2]] }));
R[4].push(fromAscii('5-3', [
  '...Q..',
  '...A..',
  'T──┼─R',
  '│..│..',
  '└──┘..'], { edges: ['E', 'S'], strength: 9, inv: [[3, 2]] }));

// ---------------- Region 6: Ghost Lines (decoys) ----------------
const R6 = [
  fromAscii('6-1', [
    '.....',
    '..X..',
    'T─┐..',
    '..└─R',
    '.....']),
  fromAscii('6-2', [
    '..R...',
    '..│...',
    'T─┤.X.',
    '..└─┐.',
    '....R.']),
  fromAscii('6-3', [
    '..X...',
    '......',
    'T─┬─┐.',
    'X.│.R.',
    '..R...'], { inv: [[2, 2]] }),
];
// ---------------- Region 7: Orbit (satellite pairs) ----------------
const R7 = [
  fromAscii('7-1', [
    '.....',
    'T─S..',
    '#####',
    '..S─R',
    '.....'], { rot: { '2,1': 0, '2,3': 0 } }),
  fromAscii('7-2', [
    '......',
    'T─S.#.',
    '######',
    '.#S──R',
    '......'], { rot: { '2,1': 0, '2,3': 2 } }),
  fromAscii('7-3', [
    'T─S#s─R',
    '...#...',
    '#######',
    '.......',
    '.S──s..',
    '.......'], { rot: { '2,0': 1, '1,4': 2, '4,4': 0, '4,0': 3 }, strength: 8 }),
];

// ---------------- generator recipes per region ----------------
const recipes = {
  1: { w: 6, h: 6, strength: 7, receivers: 1, minLen: 5, maxLen: 8, invRatio: 0.15, lockRatio: 0.1, distract: 2, minMoves: 5 },
  2: { w: 6, h: 6, strength: 7, receivers: 2, minLen: 4, maxLen: 6, minLen2: 2, maxLen2: 4, invRatio: 0.2, distract: 2, minMoves: 6 },
  3: { w: 7, h: 7, strength: 5, receivers: 2, minLen: 6, maxLen: 9, minLen2: 2, maxLen2: 4, invRatio: 0.2, boosters: 2, needBooster: true, static: 5, distract: 2, minMoves: 6 },
  4: { w: 7, h: 7, strength: 7, receivers: 2, minLen: 5, maxLen: 7, minLen2: 3, maxLen2: 4, invRatio: 0.2, tuners: ['amber', 'violet'], static: 3, distract: 2, minMoves: 7 },
  5: { w: 7, h: 7, strength: 10, receivers: 2, minLen: 6, maxLen: 9, minLen2: 4, maxLen2: 6, invRatio: 0.2, bridges: true, bridgeInv: true, invTypes: [], static: 2, distract: 2, minMoves: 7 },
  6: { w: 7, h: 7, strength: 8, receivers: 2, minLen: 5, maxLen: 8, minLen2: 3, maxLen2: 4, invRatio: 0.25, decoys: 3, static: 2, distract: 2, minMoves: 7 },
};
const counts = { 1: 10, 2: 8, 3: 8, 4: 8, 5: 8, 6: 6 };
const handmade = { 1: R[0], 2: R[1], 3: R[2], 4: R[3], 5: R[4], 6: R6 };

// trim empty rows/cols, keeping a one-cell margin (tower column stays at x=0)
function crop(lv) {
  const pts = [[lv.tower.x, lv.tower.y], ...lv.receivers.map(r => [r.x, r.y]), ...lv.fixed.map(f => [f.x, f.y]), ...lv.decoys.map(d => [d.x, d.y])];
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const W = lv.size[0], H = lv.size[1];
  const y0 = Math.max(0, Math.min(...ys) - 1), y1 = Math.min(H - 1, Math.max(...ys) + 1);
  const x1 = Math.min(W - 1, Math.max(...xs) + 1);
  const inb = (x, y) => x <= x1 && y >= y0 && y <= y1;
  const sh = (o) => { o.y -= y0; return o; };
  lv.tower = sh(lv.tower); lv.receivers.forEach(sh); lv.fixed.forEach(sh); lv.decoys.forEach(sh);
  lv.static = lv.static.filter(p => inb(p[0], p[1])).map(p => [p[0], p[1] - y0]);
  lv.size = [x1 + 1, y1 - y0 + 1];
}
const out = [];
for (let reg = 1; reg <= 6; reg++) {
  const list = [];
  for (const lv of handmade[reg]) {
    const t0 = Date.now();
    const s = SL.solve(lv, { maxNodes: 2e6 });
    console.error('hand', lv.id, s.status, s.nodes, Date.now() - t0 + 'ms');
    if (!s.ok) throw new Error('unsolvable ' + lv.id + ' ' + s.status);
    const L = SL.compile(lv);
    if (SL.walk(L, L.tiles0).solved) throw new Error('starts solved ' + lv.id);
    lv.par = { relays: s.relays, moves: s.moves };
    list.push(lv);
  }
  let seed = 1000 * reg, n = list.length;
  const seen = new Set();
  while (list.length < counts[reg]) {
    n++;
    const rec = { ...recipes[reg], id: `${reg}-${n}` };
    // difficulty ramps within region
    const ramp = (list.length - handmade[reg].length) / Math.max(1, counts[reg] - handmade[reg].length);
    rec.maxMoves = Math.round(9 + ramp * 12);
    rec.minMoves = Math.max(rec.minMoves, Math.round(4 + ramp * 6));
    if (ramp > 0.5) { rec.w++; rec.h = rec.h + (reg > 2 ? 1 : 0); }
    let g = null, tries = 0;
    while (!g) {
      if (++tries > 300) throw new Error('generator stuck ' + reg + ' ' + JSON.stringify(rec));
      g = SL.generate(seed++, rec);
      if (g) { const sig = JSON.stringify(g.level.fixed.slice(0, 3)); if (seen.has(sig)) g = null; else seen.add(sig); }
      if (!g) n = n; // keep trying
    }
    g.level.id = `${reg}-${list.length + 1}`;
    crop(g.level);
    console.error('gen', g.level.id, 'tries', tries, 'seed', seed - 1);
    list.push(g.level);
  }
  out.push(...list);
}
for (const lv of R7) {
  const s = SL.solve(lv, { maxNodes: 2e6 });
  if (!s.ok) throw new Error('unsolvable ' + lv.id + ' ' + s.status);
  const L = SL.compile(lv);
  if (SL.walk(L, L.tiles0).solved) throw new Error('starts solved ' + lv.id);
  lv.par = { relays: s.relays, moves: s.moves };
  out.push(lv);
}
for (const lv of out) console.log(lv.id.padEnd(5), lv.size.join('x'), 'par', lv.par.relays, lv.par.moves, 'inv', JSON.stringify(lv.inventory));
const js = '/* generated by tools/build-levels.mjs, curated; par set by the solver */\nglobalThis.SL_LEVELS = ' + JSON.stringify(out) + ';\n';
writeFileSync(join(here, '..', 'levels.js'), js);
console.log('levels', out.length, 'bytes', js.length);
