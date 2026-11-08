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
  // mixers: K = open N,E,S; k = E,S,W; J = S,W,N; j = W,N,E
  'K': ['mixer', 0], 'k': ['mixer', 1], 'J': ['mixer', 2], 'j': ['mixer', 3],
};
const RECV = { R: 'any', Q: 'amber', P: 'violet', O: 'teal', W: 'white' };

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
// Solve with the full budget so par is proven, and refuse levels that start solved.
function proven(lv) {
  const s = SL.solve(lv, { maxNodes: 2e6 });
  if (!s.ok || s.status !== 'ok') throw new Error('unsolvable or unproven ' + lv.id + ' ' + s.status);
  const L = SL.compile(lv);
  if (SL.walk(L, L.tiles0).solved) throw new Error('starts solved ' + lv.id);
  lv.par = { relays: s.relays, moves: s.moves };
  return lv;
}

// ---------------- v1 campaign (51 levels): rebuilt exactly as shipped ----------------
const legacy = {};
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
    }
    g.level.id = `${reg}-${list.length + 1}`;
    crop(g.level);
    console.error('gen', g.level.id, 'tries', tries, 'seed', seed - 1);
    list.push(g.level);
  }
  legacy[reg] = list;
}
for (const lv of R7) proven(lv);

// v2 inserts Spectrum Labs (mixers) as region 6, so Ghost Lines moves to 7 and Orbit to 8 (spec 4.1).
const renumber = (list, reg) => list.map((lv, i) => ({ ...lv, id: `${reg}-${i + 1}` }));
const regions = { 1: legacy[1], 2: legacy[2], 3: legacy[3], 4: legacy[4], 5: legacy[5], 6: [], 7: renumber(legacy[6], 7), 8: renumber(R7, 8), 9: [] };

// ---------------- Region 6: Spectrum Labs (mixers), first three handmade ----------------
const keepAll61 = [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [1, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3]];
regions[6].push(
  // 6-1: everything is set except the mixer, which faces the wrong way
  fromAscii('6-1', [
    '.......',
    '.┌─a─┐.',
    'T┤...KW',
    '.└───┘.',
    '.......'], { strength: 9, keep: keepAll61, rot: { '5,2': 2 } }),
  // 6-2: the same network, but the mixer comes from the inventory
  fromAscii('6-2', [
    '.......',
    '.┌─a─┐.',
    'T┤...KW',
    '.└───┘.',
    '.......'], { strength: 9, inv: [[5, 2]] }),
  // 6-3: amber and violet make white; the straight shortcut runs into a decoy
  fromAscii('6-3', [
    '.........',
    '.┌──a─┐..',
    'T┤..X.K─W',
    '.└─v──┘..',
    '.........'], { strength: 10 }),
);
regions[6].forEach(proven);

// ---------------- generated additions ----------------
function addGenerated(reg, target, seedBase, make) {
  const list = regions[reg], seen = new Set(list.map(l => JSON.stringify(l.fixed.slice(0, 3))));
  let seed = seedBase;
  const first = list.length;
  while (list.length < target) {
    const ramp = (list.length - first) / Math.max(1, target - first - 1);
    const { fn, rec } = make(ramp, list.length - first);
    rec.id = `${reg}-${list.length + 1}`;
    rec.maxNodes = 200000;
    let g = null, tries = 0;
    while (!g) {
      if (++tries > 400) throw new Error('generator stuck ' + reg + ' ' + JSON.stringify(rec));
      g = fn(seed++, rec);
      if (!g) continue;
      const sig = JSON.stringify(g.level.fixed.slice(0, 3));
      if (seen.has(sig)) { g = null; continue; }
      crop(g.level);
      g.level.id = rec.id;
      try { proven(g.level); } catch (e) { g = null; continue; }
      if (g.level.par.moves < rec.minMoves || g.level.par.moves > rec.maxMoves) { g = null; continue; }
      seen.add(sig);
    }
    console.error('gen', g.level.id, 'tries', tries, 'seed', seed - 1, 'par', g.level.par.relays, g.level.par.moves);
    list.push(g.level);
  }
}
const lerp = (a, b, u) => Math.round(a + (b - a) * u);
const tree = (rec) => ({ fn: SL.generate, rec });
addGenerated(1, 12, 51000, (u) => tree({ w: 7, h: 7, strength: 9, receivers: 1, minLen: 7, maxLen: 10, invRatio: 0.25, lockRatio: 0.1, distract: 3, minMoves: 8, maxMoves: 22 }));
addGenerated(2, 11, 52000, (u) => tree({ w: 7, h: 7, strength: 8, receivers: 3, minLen: 4, maxLen: 6, minLen2: 2, maxLen2: 4, invRatio: 0.25, distract: 3, minMoves: lerp(8, 10, u), maxMoves: 26 }));
addGenerated(3, 11, 53000, (u) => tree({ w: 8, h: 7, strength: 5, receivers: 2, minLen: 7, maxLen: 10, minLen2: 2, maxLen2: 4, invRatio: 0.25, boosters: 2, needBooster: true, static: 7, distract: 2, minMoves: lerp(8, 10, u), maxMoves: 26 }));
addGenerated(4, 11, 54000, (u) => tree({ w: 8, h: 7, strength: 8, receivers: 3, minLen: 5, maxLen: 7, minLen2: 2, maxLen2: 4, invRatio: 0.25, tuners: ['amber', 'violet'], static: 3, distract: 2, minMoves: lerp(8, 10, u), maxMoves: 26 }));
addGenerated(5, 11, 55000, (u) => tree({ w: 8, h: 8, strength: 11, receivers: 2, minLen: 6, maxLen: 9, minLen2: 4, maxLen2: 6, invRatio: 0.25, bridges: true, bridgeInv: true, static: 3, distract: 2, minMoves: lerp(8, 10, u), maxMoves: 28 }));
addGenerated(6, 11, 56000, (u) => ({
  fn: SL.generateMixer,
  rec: { w: lerp(7, 8, u), h: 7, wiggle: lerp(1, 3, u), outMin: 1, outMax: 3, both: u > 0.3, invRatio: 0.15 + 0.15 * u, static: lerp(0, 3, u), decoys: u > 0.6 ? 1 : 0, distract: lerp(1, 3, u), slack: 1, minMoves: lerp(6, 10, u), maxMoves: 30 },
}));
addGenerated(7, 11, 57000, (u) => tree({ w: 8, h: 7, strength: 8, receivers: 2, minLen: 5, maxLen: 8, minLen2: 3, maxLen2: 4, invRatio: 0.3, decoys: 4, static: 2, distract: 2, minMoves: lerp(8, 10, u), maxMoves: 26 }));
addGenerated(8, 11, 58000, (u) => ({
  fn: SL.generateOrbit,
  rec: { w: 7, h: lerp(7, 8, u), minLen: lerp(3, 4, u), maxLen: lerp(5, 7, u), minLen2: 3, maxLen2: lerp(4, 6, u), tuner: u > 0.4 ? (u > 0.7 ? 'violet' : 'amber') : null, invRatio: 0.2 + 0.1 * u, static: lerp(1, 3, u), decoys: u > 0.5 ? 1 : 0, distract: lerp(1, 3, u), slack: 1, minMoves: lerp(6, 9, u), maxMoves: 26 },
}));
// Region 9 mixes every rule; the kinds rotate so no two neighbours feel the same.
addGenerated(9, 11, 59000, (u, i) => {
  const kind = i % 3;
  if (kind === 0) return tree({ w: 8, h: 8, strength: 10, receivers: 2, minLen: 6, maxLen: 9, minLen2: 3, maxLen2: 5, invRatio: 0.3, tuners: ['amber'], bridges: true, bridgeInv: true, decoys: 2, static: 3, distract: 2, minMoves: 10, maxMoves: 30 });
  if (kind === 1) return { fn: SL.generateMixer, rec: { w: 8, h: 7, wiggle: 3, outMin: 2, outMax: 4, both: true, invRatio: 0.3, static: 3, decoys: 2, distract: 3, slack: 1, minMoves: 10, maxMoves: 32 } };
  return { fn: SL.generateOrbit, rec: { w: 8, h: 8, minLen: 4, maxLen: 7, minLen2: 4, maxLen2: 6, tuner: 'violet', invRatio: 0.3, static: 3, decoys: 2, distract: 3, slack: 1, minMoves: 9, maxMoves: 30 } };
});

// ---------------- 9-12: The Last Tower. Every rule at once; solving it plays the last transmission ----------------
// ---------------- Deep sectors: 100 more levels, harder takes on each region's own rule ----------------
// Appended after the v2 levels (which stay byte-for-byte the same), before the finale.
const deep = { w: 8, h: 8, invRatio: 0.35, distract: 3, maxMoves: 40 };
addGenerated(1, 23, 61000, (u) => tree({ ...deep, strength: 11, receivers: 1, minLen: 9, maxLen: 13, lockRatio: 0.1, static: 4, minMoves: lerp(11, 14, u) }));
addGenerated(2, 22, 62000, (u) => tree({ ...deep, strength: 9, receivers: 3, minLen: 5, maxLen: 7, minLen2: 3, maxLen2: 5, static: 3, minMoves: lerp(11, 14, u) }));
addGenerated(3, 22, 63000, (u) => tree({ ...deep, w: 9, strength: 5, receivers: 2, minLen: 8, maxLen: 12, minLen2: 3, maxLen2: 5, boosters: 3, needBooster: true, static: 9, minMoves: lerp(10, 13, u) }));
addGenerated(4, 22, 64000, (u) => tree({ ...deep, strength: 9, receivers: 3, minLen: 5, maxLen: 8, minLen2: 3, maxLen2: 4, tuners: ['amber', 'violet'], static: 4, decoys: u > 0.5 ? 1 : 0, minMoves: lerp(10, 13, u) }));
addGenerated(5, 22, 65000, (u) => tree({ ...deep, w: 9, strength: 12, receivers: 2, minLen: 7, maxLen: 10, minLen2: 4, maxLen2: 6, bridges: true, bridgeInv: true, static: 4, minMoves: lerp(10, 13, u) }));
addGenerated(6, 22, 66000, (u) => ({ fn: SL.generateMixer, rec: { w: lerp(8, 9, u), h: 8, wiggle: lerp(3, 5, u), outMin: 2, outMax: 4, both: true, invRatio: 0.35, static: lerp(3, 5, u), decoys: lerp(1, 2, u), distract: 3, slack: 1, minMoves: lerp(10, 13, u), maxMoves: 40 } }));
addGenerated(7, 22, 67000, (u) => tree({ ...deep, w: 9, strength: 9, receivers: 3, minLen: 5, maxLen: 8, minLen2: 3, maxLen2: 4, decoys: lerp(5, 7, u), static: 3, minMoves: lerp(10, 13, u) }));
addGenerated(8, 22, 68000, (u) => ({ fn: SL.generateOrbit, rec: { w: 8, h: 9, minLen: 5, maxLen: 8, minLen2: 4, maxLen2: 7, tuner: u > 0.5 ? 'violet' : 'amber', invRatio: 0.35, static: lerp(3, 5, u), decoys: lerp(1, 3, u), distract: 3, slack: 1, minMoves: lerp(10, 13, u), maxMoves: 40 } }));
addGenerated(9, 23, 69000, (u, i) => {
  const kind = i % 3;
  if (kind === 0) return tree({ ...deep, w: 9, strength: 11, receivers: 3, minLen: 6, maxLen: 9, minLen2: 3, maxLen2: 5, tuners: ['amber', 'violet'], bridges: true, bridgeInv: true, decoys: 3, static: 4, minMoves: 12 });
  if (kind === 1) return { fn: SL.generateMixer, rec: { w: 9, h: 8, wiggle: 5, outMin: 3, outMax: 5, both: true, invRatio: 0.38, static: 5, decoys: 3, distract: 4, slack: 1, minMoves: 12, maxMoves: 44 } };
  return { fn: SL.generateOrbit, rec: { w: 9, h: 9, minLen: 6, maxLen: 9, minLen2: 5, maxLen2: 8, tuner: 'violet', invRatio: 0.38, static: 5, decoys: 3, distract: 4, slack: 1, minMoves: 12, maxMoves: 44 } };
});

// ---------------- Master sectors: 70 more, the hardest takes on each region's rule ----------------
// Bigger boards, more decoys and static, longer solutions. Appended after the deep sectors, before the finale.
const master = { w: 9, h: 9, invRatio: 0.42, distract: 4, maxMoves: 50 };
addGenerated(1, 31, 71000, (u) => tree({ ...master, strength: 12, receivers: 1, minLen: 11, maxLen: 15, lockRatio: 0.12, static: 6, minMoves: lerp(14, 17, u) }));
addGenerated(2, 30, 72000, (u) => tree({ ...master, strength: 10, receivers: 4, minLen: 5, maxLen: 8, minLen2: 3, maxLen2: 5, static: 4, minMoves: lerp(14, 17, u) }));
addGenerated(3, 30, 73000, (u) => tree({ ...master, w: 10, strength: 5, receivers: 2, minLen: 10, maxLen: 14, minLen2: 4, maxLen2: 6, boosters: 4, needBooster: true, static: 11, minMoves: lerp(13, 16, u) }));
addGenerated(4, 30, 74000, (u) => tree({ ...master, strength: 10, receivers: 3, minLen: 6, maxLen: 9, minLen2: 3, maxLen2: 5, tuners: ['amber', 'violet'], static: 5, decoys: lerp(1, 2, u), minMoves: lerp(13, 16, u) }));
addGenerated(5, 30, 75000, (u) => tree({ ...master, w: 10, strength: 13, receivers: 3, minLen: 7, maxLen: 11, minLen2: 4, maxLen2: 6, bridges: true, bridgeInv: true, static: 5, minMoves: lerp(13, 16, u) }));
addGenerated(6, 30, 76000, (u) => ({ fn: SL.generateMixer, rec: { w: 9, h: 9, wiggle: lerp(5, 6, u), outMin: 3, outMax: 5, both: true, invRatio: 0.42, static: lerp(5, 7, u), decoys: lerp(2, 3, u), distract: 4, slack: 1, minMoves: lerp(13, 16, u), maxMoves: 50 } }));
addGenerated(7, 30, 77000, (u) => tree({ ...master, w: 10, strength: 10, receivers: 3, minLen: 6, maxLen: 9, minLen2: 3, maxLen2: 5, decoys: lerp(7, 9, u), static: 4, minMoves: lerp(13, 16, u) }));
addGenerated(8, 30, 78000, (u) => ({ fn: SL.generateOrbit, rec: { w: 9, h: 10, minLen: 6, maxLen: 9, minLen2: 5, maxLen2: 8, tuner: u > 0.4 ? 'violet' : 'amber', invRatio: 0.42, static: lerp(5, 7, u), decoys: lerp(2, 4, u), distract: 4, slack: 1, minMoves: lerp(13, 16, u), maxMoves: 50 } }));
addGenerated(9, 29, 79000, (u, i) => {
  const kind = i % 3;
  if (kind === 0) return tree({ ...master, w: 10, strength: 12, receivers: 3, minLen: 7, maxLen: 10, minLen2: 4, maxLen2: 6, tuners: ['amber', 'violet'], bridges: true, bridgeInv: true, decoys: 4, static: 6, minMoves: 16 });
  if (kind === 1) return { fn: SL.generateMixer, rec: { w: 10, h: 9, wiggle: 6, outMin: 3, outMax: 6, both: true, invRatio: 0.45, static: 7, decoys: 4, distract: 5, slack: 1, minMoves: 16, maxMoves: 54 } };
  return { fn: SL.generateOrbit, rec: { w: 10, h: 10, minLen: 7, maxLen: 10, minLen2: 6, maxLen2: 9, tuner: 'violet', invRatio: 0.45, static: 7, decoys: 4, distract: 5, slack: 1, minMoves: 16, maxMoves: 54 } };
});

// ---------------- The Last Tower finale, always the very last sector ----------------
const finale = fromAscii('9-12', [   // the original id keeps the original scramble; renamed below
  '...X.....',
  '.┌─ab─┐..',
  '.│....│..',
  'T┤..X.KS.',
  '.│....│..',
  '.└─v─b┘..',
  '#########',
  '.S───WX..',
  '.........'], { strength: 9, inv: [[6, 3], [3, 5]], rot: { '7,3': 0, '1,7': 2 } });
finale.final = true;
finale.id = `9-${regions[9].length + 1}`;
regions[9].push(proven(finale));

const out = [];
for (let reg = 1; reg <= 9; reg++) out.push(...regions[reg]);
for (const lv of out) console.log(lv.id.padEnd(5), lv.size.join('x'), 'par', lv.par.relays, lv.par.moves, 'inv', JSON.stringify(lv.inventory));
const js = '/* generated by tools/build-levels.mjs, curated; par set by the solver */\nglobalThis.SL_LEVELS = ' + JSON.stringify(out) + ';\n';
writeFileSync(join(here, '..', 'levels.js'), js);
console.log('levels', out.length, 'bytes', js.length);
