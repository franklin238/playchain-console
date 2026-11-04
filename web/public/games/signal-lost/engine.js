/* Signal Lost rules engine, solver and generator.
   Pure and deterministic: state in, lit cells out. No DOM, no Math.random.
   Loaded by index.html as a classic script, by tools/verify-levels.mjs via import,
   and by the solver Web Worker (built from SL_ENGINE_FACTORY.toString()). */
function SL_ENGINE_FACTORY() {
  'use strict';
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0], DN = ['N', 'E', 'S', 'W'];
  var SHAPES = {
    straight: [1, 0, 1, 0], corner: [1, 1, 0, 0], tee: [0, 1, 1, 1],
    booster: [1, 0, 1, 0], tuner: [1, 0, 1, 0], bridge: [1, 1, 1, 1], dish: [1, 0, 0, 0]
  };
  var PERIOD = { straight: 2, corner: 4, tee: 4, booster: 2, tuner: 2, bridge: 1, dish: 4 };
  var FREQS = ['teal', 'amber', 'violet', 'white'];
  var K_EMPTY = 0, K_STATIC = 1, K_BLOCK = 2, K_TOWER = 3, K_RECV = 4, K_DECOY = 5;

  function fIndex(name) { var i = FREQS.indexOf(name); return i < 0 ? 0 : i; }
  function isOpen(t, r, s) { return SHAPES[t][(s - r + 8) & 3] === 1; }
  function rotCost(t, from, to) {
    var p = PERIOD[t]; var d = (((to - from) % p) + p) % p; return Math.min(d, p - d);
  }
  function sides(t, r) { var o = []; for (var s = 0; s < 4; s++) if (isOpen(t, r, s)) o.push(s); return o; }
  function parseKey(k) { var i = k.indexOf(':'); return i < 0 ? { t: k, f: null } : { t: k.slice(0, i), f: k.slice(i + 1) }; }
  function keyOf(t, f) { return t === 'tuner' ? 'tuner:' + (f || 'amber') : t; }

  /* ---------- seeded rng ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return h >>> 0;
  }

  /* ---------- compile a level JSON into fast arrays ---------- */
  function compile(level) {
    var W = level.size[0], H = level.size[1], N = W * H;
    var kind = new Uint8Array(N), recvIdx = new Int16Array(N).fill(-1), decIdx = new Int16Array(N).fill(-1);
    var tw = level.tower, tc = tw.y * W + tw.x;
    kind[tc] = K_TOWER;
    var tower = {
      c: tc, x: tw.x, y: tw.y, f: fIndex(tw.freq || 'teal'), S: tw.strength || 6,
      edges: (tw.edges || ['E']).map(function (e) { return DN.indexOf(e); })
    };
    var receivers = (level.receivers || []).map(function (r, i) {
      var c = r.y * W + r.x; kind[c] = K_RECV; recvIdx[c] = i;
      return { c: c, x: r.x, y: r.y, f: r.freq || 'any' };
    });
    var decoys = (level.decoys || []).map(function (d, i) {
      var c = d.y * W + d.x; kind[c] = K_DECOY; decIdx[c] = i; return { c: c, x: d.x, y: d.y };
    });
    (level.static || []).forEach(function (p) { kind[p[1] * W + p[0]] = K_STATIC; });
    (level.blocked || []).forEach(function (p) { kind[p[1] * W + p[0]] = K_BLOCK; });
    var tiles0 = new Array(N).fill(null), hasDish = false, boostAny = false;
    var pairs = {};
    (level.fixed || []).forEach(function (f) {
      var c = f.y * W + f.x;
      var t = { t: f.type, r: (f.rot || 0) & 3, r0: (f.rot || 0) & 3, f: f.freq || null, fx: true, rot: f.rotatable !== false, p: -1 };
      if (f.type === 'dish') { hasDish = true; var id = f.pair || 'a'; (pairs[id] = pairs[id] || []).push(c); }
      if (f.type === 'booster') boostAny = true;
      tiles0[c] = t;
    });
    Object.keys(pairs).forEach(function (id) {
      var p = pairs[id]; if (p.length === 2) { tiles0[p[0]].p = p[1]; tiles0[p[1]].p = p[0]; }
    });
    var inv0 = {};
    Object.keys(level.inventory || {}).forEach(function (k) {
      if (level.inventory[k] > 0) inv0[k] = level.inventory[k];
      if (parseKey(k).t === 'booster' && level.inventory[k] > 0) boostAny = true;
    });
    return {
      id: level.id, W: W, H: H, N: N, kind: kind, recvIdx: recvIdx, decIdx: decIdx, tower: tower,
      receivers: receivers, decoys: decoys, tiles0: tiles0, inv0: inv0, hasDish: hasDish, boostAny: boostAny, src: level
    };
  }

  function cloneTiles(tiles) {
    return tiles.map(function (t) { return t ? { t: t.t, r: t.r, r0: t.r0, f: t.f, fx: t.fx, rot: t.rot, p: t.p } : null; });
  }

  function freqOK(req, f) { return req === 'any' || FREQS.indexOf(req) === f; }

  /* ---------- the signal walk ----------
     Priority: highest strength first, then first-in. Booster restores to tower strength.
     If `undec` is given (solver mode) the walk accepts emissions into undecided cells and
     stops with {need} when the first such arrival is popped. */
  function run(L, tiles, undec) {
    var N = L.N, W = L.W, H = L.H, S = L.tower.S, kind = L.kind;
    var pw = new Int8Array(N * 2), pf = new Int8Array(N * 2), pin = new Int8Array(N * 2).fill(-1), pord = new Int16Array(N * 2).fill(-1);
    var rx = L.receivers.map(function () { return { lit: false, v: 0, f: -1, side: -1, wrong: false, ord: -1 }; });
    var dec = L.decoys.map(function () { return { lit: false, side: -1 }; });
    var leaks = [], order = [];
    var buckets = []; for (var b = 0; b <= S; b++) buckets.push([]);
    var heads = new Int32Array(S + 1);
    var top = S, relays = 0, fail = false;

    function push(c, side, v, f, from) { if (v > S) v = S; buckets[v].push([c, side, v, f, from]); if (v > top) top = v; }
    function emit(c, d, v, f) {
      if (v <= 0) return;
      var x = c % W + DX[d], y = (c / W | 0) + DY[d];
      if (x < 0 || y < 0 || x >= W || y >= H) { leaks.push({ c: c, d: d, v: v, f: f, into: 'wall' }); if (undec) fail = true; return; }
      var n = y * W + x, side = (d + 2) & 3, k = kind[n];
      if (k === K_STATIC || k === K_BLOCK) { leaks.push({ c: c, d: d, v: v, f: f, into: k === K_STATIC ? 'static' : 'wall' }); if (undec) fail = true; return; }
      if (k === K_TOWER) {
        if (L.tower.edges.indexOf(side) < 0) { leaks.push({ c: c, d: d, v: v, f: f, into: 'tile' }); if (undec) fail = true; }
        return;
      }
      if (k === K_RECV || k === K_DECOY) { push(n, side, v, f, c); return; }
      if (undec && undec[n]) { push(n, side, v, f, c); return; }
      var t = tiles[n];
      if (!t) { leaks.push({ c: c, d: d, v: v, f: f, into: 'empty' }); if (undec) fail = true; return; }
      if (!isOpen(t.t, t.r, side)) { leaks.push({ c: c, d: d, v: v, f: f, into: 'tile' }); if (undec) fail = true; return; }
      push(n, side, v, f, c);
    }

    function needRet(c, side, v, f) {
      var pend = [[c, side, v, f]];
      for (var bb = S; bb > 0; bb--) for (var q = heads[bb]; q < buckets[bb].length; q++) pend.push(buckets[bb][q]);
      return { need: { c: c, side: side, v: v, f: f }, pending: pend, pw: pw, rx: rx, relays: relays };
    }
    var T = L.tower;
    for (var e = 0; e < T.edges.length; e++) emit(T.c, T.edges[e], S, T.f);
    if (fail) return { fail: true };

    while (true) {
      while (top > 0 && heads[top] >= buckets[top].length) top--;
      if (top <= 0) break;
      var it = buckets[top][heads[top]++];
      var c = it[0], side = it[1], v = it[2], f = it[3];
      var k = kind[c];
      if (k === K_RECV) {
        var ri = L.recvIdx[c], r = rx[ri];
        if (!r.lit) {
          if (freqOK(L.receivers[ri].f, f)) { r.lit = true; r.v = v; r.f = f; r.side = side; r.ord = order.length; order.push([c, 0, v, f, side]); }
          else { r.wrong = true; r.f = f; r.side = side; }
        }
        continue;
      }
      if (k === K_DECOY) {
        var di = L.decIdx[c]; if (!dec[di].lit) { dec[di].lit = true; dec[di].side = side; order.push([c, 0, v, f, side]); }
        if (undec) return { fail: true };
        continue;
      }
      if (undec && undec[c]) return needRet(c, side, v, f);
      var t = tiles[c];
      var ch = t.t === 'bridge' ? (side & 1) : 0;
      var idx = c * 2 + ch;
      if (pw[idx] > 0) continue;
      if (pw[c * 2] === 0 && pw[c * 2 + 1] === 0) relays++;
      pw[idx] = v; pf[idx] = f; pin[idx] = side; pord[idx] = order.length; order.push([c, ch, v, f, side]);
      var outV = t.t === 'booster' ? S : v - 1;
      var outF = t.t === 'tuner' ? fIndex(t.f) : f;
      if (t.t === 'dish') {
        var p = t.p;
        if (p >= 0 && pw[p * 2] === 0) {
          if (undec && undec[p]) return needRet(p, -2, v - 1, f);
          relays++;
          var pt = tiles[p];
          pw[p * 2] = Math.max(1, v - 1); pf[p * 2] = f; pin[p * 2] = -2; pord[p * 2] = order.length; order.push([p, 0, v - 1, f, -2]);
          emit(p, pt.r & 3, outV, outF);
        }
      } else if (t.t === 'bridge') {
        emit(c, (side + 2) & 3, outV, outF);
      } else {
        for (var s = 0; s < 4; s++) if (s !== side && isOpen(t.t, t.r, s)) emit(c, s, outV, outF);
      }
      if (fail) return { fail: true };
    }
    var solved = rx.every(function (r) { return r.lit; }) && dec.every(function (d) { return !d.lit; });
    return { pw: pw, pf: pf, pin: pin, pord: pord, rx: rx, dec: dec, leaks: leaks, order: order, relays: relays, solved: solved };
  }

  /* public walk: state in, lit cells out */
  function walk(L, tiles) { return run(L, tiles, null); }

  /* ---------- solver ----------
     Branch-and-bound over the decisions the signal actually reaches, iterative deepening on relays.
     Objective: fewest relays, then fewest moves, leak-free. Unreached tiles stay as they are. */
  function solve(level, opts) {
    opts = opts || {};
    var L = level.N ? level : compile(level);
    var maxNodes = opts.maxNodes || 300000;
    var N = L.N, W = L.W;
    var startTiles = opts.tiles ? cloneTiles(opts.tiles) : cloneTiles(L.tiles0);
    var tiles = cloneTiles(startTiles);
    var undec = new Uint8Array(N);
    for (var c = 0; c < N; c++) {
      if (L.kind[c] !== K_EMPTY) continue;
      var t = tiles[c];
      if (!t) undec[c] = 1;
      else if (t.fx && t.rot && PERIOD[t.t] > 1) undec[c] = 1;
    }
    var inv = {}; var src = opts.inv || L.inv0;
    Object.keys(src).forEach(function (k) { if (src[k] > 0) inv[k] = src[k]; });
    var nodes = 0, best = null, R = 0, TIMEOUT = {};
    var reqF = L.receivers.map(function (r) { return r.f === 'any' ? -1 : fIndex(r.f); });

    function lowerBound(res) {
      var pend = res.pending, h = 0;
      for (var i = 0; i < L.receivers.length; i++) {
        if (res.rx[i].lit) continue;
        var rc = L.receivers[i].c, rx_ = rc % W, ry = rc / W | 0, md = 1e9, okS = false;
        for (var j = 0; j < pend.length; j++) {
          var q = pend[j][0];
          if (q !== rc && (res.pw[q * 2] > 0 || res.pw[q * 2 + 1] > 0) && tiles[q] && tiles[q].t !== 'bridge') continue;
          var d = Math.abs(q % W - rx_) + Math.abs((q / W | 0) - ry);
          if (d < md) md = d;
          if (pend[j][2] - d >= 1) okS = true;
        }
        if (md === 1e9) return 1e9;
        if (!L.hasDish) { if (!okS && !L.boostAny) return 1e9; if (md > h) h = md; }
      }
      return h;
    }

    function dfs(moves) {
      if (++nodes > maxNodes) throw TIMEOUT;
      var res = run(L, tiles, undec);
      if (res.fail) return;
      if (best && moves >= best.moves) return;
      if (res.need) {
        if (res.relays + lowerBound(res) > R) return;
        var c = res.need.c, side = res.need.side, choices = [], t0 = tiles[c];
        if (t0) {
          for (var r = 0; r < PERIOD[t0.t]; r++) if (side === -2 || isOpen(t0.t, r, side)) choices.push({ r: r, cost: rotCost(t0.t, t0.r0, r) });
        } else {
          var keys = Object.keys(inv);
          for (var i = 0; i < keys.length; i++) {
            if (inv[keys[i]] <= 0) continue;
            var pk = parseKey(keys[i]);
            for (var r2 = 0; r2 < PERIOD[pk.t]; r2++) if (isOpen(pk.t, r2, side)) choices.push({ key: keys[i], t: pk.t, f: pk.f, r: r2, cost: 1 + rotCost(pk.t, 0, r2) });
          }
        }
        choices.sort(function (a, b) { return a.cost - b.cost; });
        for (var k = 0; k < choices.length; k++) {
          var ch = choices[k];
          undec[c] = 0;
          if (t0) { t0.r = ch.r; dfs(moves + ch.cost); t0.r = t0.r0; }
          else {
            inv[ch.key]--; tiles[c] = { t: ch.t, r: ch.r, r0: 0, f: ch.f, fx: false, rot: true, p: -1, k: ch.key };
            dfs(moves + ch.cost);
            tiles[c] = null; inv[ch.key]++;
          }
          undec[c] = 1;
        }
        return;
      }
      if (res.solved && res.leaks.length === 0 && res.relays <= R) {
        var sol = [];
        for (var cc = 0; cc < N; cc++) {
          var tt = tiles[cc];
          if (!tt) continue;
          var powered = res.pw[cc * 2] > 0 || res.pw[cc * 2 + 1] > 0;
          if (!tt.fx) sol.push({ x: cc % W, y: cc / W | 0, type: tt.t, rot: tt.r, freq: tt.f, place: true, key: tt.k });
          else if (powered && tt.rot && PERIOD[tt.t] > 1 && rotCost(tt.t, tt.r0, tt.r) > 0) sol.push({ x: cc % W, y: cc / W | 0, type: tt.t, rot: tt.r, place: false });
        }
        best = { relays: res.relays, moves: moves, solution: sol };
      }
    }

    // fixed tiles that start reached keep their start rotation unless reached; set r0 baseline
    for (var c2 = 0; c2 < N; c2++) if (tiles[c2] && tiles[c2].fx) tiles[c2].r0 = tiles[c2].r;
    var status = 'ok';
    try {
      for (R = 0; R <= N; R++) {
        dfs(0);
        if (best) break;
      }
    } catch (e) { if (e !== TIMEOUT) throw e; status = 'timeout'; }
    if (!best) return { ok: false, status: status === 'ok' ? 'unsolvable' : status, nodes: nodes };
    return { ok: true, status: status, relays: best.relays, moves: best.moves, solution: best.solution, nodes: nodes };
  }

  /* apply a solver solution to the start state and check it with the real walk */
  function checkSolution(level, sol) {
    var L = level.N ? level : compile(level);
    var tiles = cloneTiles(L.tiles0), moves = 0, inv = Object.assign({}, L.inv0);
    sol.solution.forEach(function (s) {
      var c = s.y * L.W + s.x;
      if (s.place) {
        var key = s.key || keyOf(s.type, s.freq);
        if (!(inv[key] > 0)) throw new Error('inventory misuse ' + key);
        inv[key]--; tiles[c] = { t: s.type, r: s.rot, r0: 0, f: s.freq || null, fx: false, rot: true, p: -1 };
        moves += 1 + rotCost(s.type, 0, s.rot);
      } else { moves += rotCost(tiles[c].t, tiles[c].r, s.rot); tiles[c].r = s.rot; }
    });
    var res = walk(L, tiles);
    return { solved: res.solved, leaks: res.leaks.length, relays: res.relays, moves: moves };
  }

  /* ---------- generator ---------- */
  function generate(seed, o) {
    var rng = mulberry32(seed >>> 0);
    function ri(a, b) { return a + Math.floor(rng() * (b - a + 1)); }
    function pick(a) { return a[Math.floor(rng() * a.length)]; }
    function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    var W = o.w, H = o.h;
    for (var attempt = 0; attempt < 400; attempt++) {
      var cells = new Array(W * H).fill(null); // {s:[4 bools], kind:'route'|'recv'|'tower', bridge}
      var ty = ri(1, H - 2);
      var tc = ty * W;
      cells[tc] = { kind: 'tower' };
      var start = tc + 1;
      var routes = [];
      var okAll = true;
      function inB(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }
      function walkFrom(c0, inSide, minLen, maxLen) {
        // self-avoiding random walk; returns list of cells including final receiver cell
        for (var tries = 0; tries < 60; tries++) {
          var path = [c0], used = {}; used[c0] = 1;
          var cur = c0, dirPrev = (inSide + 2) & 3, len = ri(minLen, maxLen), crossings = [];
          var good = true;
          for (var step = 0; step < len; step++) {
            var x = cur % W, y = cur / W | 0;
            var dirs = shuffle([0, 1, 2, 3]).sort(function (a, b) { return (b === dirPrev ? (o.straightBias || 0.5) : 0) - (a === dirPrev ? (o.straightBias || 0.5) : 0) + (rng() - 0.5) * 0.2; });
            var moved = false;
            for (var di = 0; di < 4; di++) {
              var d = dirs[di], nx = x + DX[d], ny = y + DY[d];
              if (!inB(nx, ny)) continue;
              var n = ny * W + nx;
              if (used[n]) continue;
              var occ = cells[n];
              if (occ && o.bridges && occ.kind === 'route' && !occ.bridge && occ.s.filter(Boolean).length === 2 && occ.s[(d + 1) & 3] && occ.s[(d + 3) & 3] && !occ.s[d] && step < len - 1) {
                var bx = nx + DX[d], by = ny + DY[d];
                if (!inB(bx, by)) continue;
                var bc = by * W + bx;
                if (cells[bc] || used[bc]) continue;
                crossings.push({ c: n, d: d });
                used[n] = 1; used[bc] = 1; path.push(n); path.push(bc); cur = bc; dirPrev = d; moved = true; step++; break;
              }
              if (occ) continue;
              used[n] = 1; path.push(n); cur = n; dirPrev = d; moved = true; break;
            }
            if (!moved) { good = false; break; }
          }
          if (good && path.length >= 2) return { path: path, crossings: crossings };
        }
        return null;
      }
      function commit(path, crossings, entrySide) {
        // mark sides along the path, final cell becomes receiver
        var cross = {}; crossings.forEach(function (x) { cross[x.c] = x.d; });
        var prevSide = entrySide;
        for (var i = 0; i < path.length; i++) {
          var c = path[i];
          if (cross[c] !== undefined) {
            var cl = cells[c]; cl.bridge = true; cl.s = [true, true, true, true];
            prevSide = (cross[c] + 2) & 3; continue;
          }
          if (i === path.length - 1) { cells[c] = { kind: 'recv', s: [false, false, false, false] }; cells[c].s[prevSide] = true; break; }
          var nxt = path[i + 1], d = dirBetween(c, nxt);
          var s = [false, false, false, false]; s[prevSide] = true; s[d] = true;
          cells[c] = { kind: 'route', s: s, route: routes.length };
          prevSide = (d + 2) & 3;
        }
      }
      function dirBetween(a, b) { var ax = a % W, ay = a / W | 0, bx = b % W, by = b / W | 0; return bx > ax ? 1 : bx < ax ? 3 : by > ay ? 2 : 0; }
      var w1 = walkFrom(start, 3, o.minLen, o.maxLen);
      if (!w1) continue;
      commit(w1.path, w1.crossings, 3); routes.push(w1.path);
      for (var rN = 1; rN < o.receivers && okAll; rN++) {
        // branch from a route cell with 2 sides into a free neighbour
        var cands = [];
        for (var c = 0; c < W * H; c++) {
          var cl = cells[c];
          if (!cl || cl.kind !== 'route' || cl.bridge || cl.s.filter(Boolean).length !== 2) continue;
          for (var d = 0; d < 4; d++) {
            if (cl.s[d]) continue;
            var nx = c % W + DX[d], ny = (c / W | 0) + DY[d];
            if (inB(nx, ny) && !cells[ny * W + nx]) cands.push([c, d, ny * W + nx]);
          }
        }
        if (!cands.length) { okAll = false; break; }
        var bp = pick(cands);
        var w2 = walkFrom(bp[2], (bp[1] + 2) & 3, o.minLen2 || 2, o.maxLen2 || 4);
        if (!w2) { okAll = false; break; }
        cells[bp[0]].s[bp[1]] = true;
        commit(w2.path, w2.crossings, (bp[1] + 2) & 3); routes.push(w2.path);
      }
      if (!okAll) continue;
      if (o.bridges && !cells.some(function (cl) { return cl && cl.bridge; })) continue;
      // build solved level
      var level = { id: o.id || 'gen', size: [W, H], tower: { x: 0, y: ty, edges: ['E'], freq: 'teal', strength: o.strength }, receivers: [], decoys: [], static: [], fixed: [], inventory: {}, par: null, seed: seed };
      var solTiles = [];
      for (var c3 = 0; c3 < W * H; c3++) {
        var cl3 = cells[c3]; if (!cl3) continue;
        var x3 = c3 % W, y3 = c3 / W | 0;
        if (cl3.kind === 'recv') { level.receivers.push({ x: x3, y: y3, freq: 'any' }); continue; }
        if (cl3.kind !== 'route') continue;
        if (cl3.bridge) { solTiles.push({ c: c3, x: x3, y: y3, type: 'bridge', rot: 0 }); continue; }
        var n3 = cl3.s.filter(Boolean).length, type, rot = 0;
        if (n3 === 3) { type = 'tee'; for (rot = 0; rot < 4; rot++) if (sides('tee', rot).every(function (s) { return cl3.s[s]; })) break; }
        else if ((cl3.s[0] && cl3.s[2]) || (cl3.s[1] && cl3.s[3])) { type = 'straight'; rot = cl3.s[0] ? 0 : 1; }
        else { type = 'corner'; for (rot = 0; rot < 4; rot++) if (sides('corner', rot).every(function (s) { return cl3.s[s]; })) break; }
        solTiles.push({ c: c3, x: x3, y: y3, type: type, rot: rot, route: cl3.route });
      }
      // tuners: give some receivers a frequency, put a tuner on a straight of the path that only feeds it
      if (o.tuners) {
        var freqs = o.tuners.slice();
        var recvs = shuffle(level.receivers.map(function (r, i) { return i; }));
        var tunedAny = false;
        for (var q = 0; q < recvs.length && freqs.length; q++) {
          var rIdx = recvs[q], rr = level.receivers[rIdx];
          // walk the route backwards from receiver to find straights until a tee
          var routeIdx = routes.findIndex(function (p) { var e = p[p.length - 1]; return e === rr.y * W + rr.x; });
          var p = routes[routeIdx], straights = [];
          for (var k = p.length - 2; k >= 0; k--) {
            var st = solTiles.find(function (s) { return s.c === p[k]; });
            if (!st) break;
            if (st.type === 'tee') break;
            if (st.type === 'straight' && st.route === routeIdx) straights.push(st);
            if (routeIdx === 0 && o.receivers > 1) break; // trunk feeds other branches: only tune near the end
          }
          if (!straights.length) continue;
          var fr = freqs.shift(), tun = pick(straights);
          tun.type = 'tuner'; tun.freq = fr; rr.freq = fr; tunedAny = true;
        }
        if (!tunedAny) continue;
      }
      if (o.colorAny === false) level.receivers.forEach(function (r) { if (r.freq === 'any') r.freq = 'teal'; });
      // strength / boosters
      var Lt = compile(Object.assign({}, level, { fixed: solTiles.map(function (s) { return { x: s.x, y: s.y, type: s.type, rot: s.rot, freq: s.freq }; }) }));
      var res = walk(Lt, Lt.tiles0);
      if (!res.solved && o.boosters) {
        // turn straights into boosters greedily along the longest route
        var strs = solTiles.filter(function (s) { return s.type === 'straight'; });
        shuffle(strs);
        for (var bi = 0; bi < Math.min(o.boosters, strs.length) && !res.solved; bi++) {
          strs[bi].type = 'booster';
          Lt = compile(Object.assign({}, level, { fixed: solTiles.map(function (s) { return { x: s.x, y: s.y, type: s.type, rot: s.rot, freq: s.freq }; }) }));
          res = walk(Lt, Lt.tiles0);
        }
      }
      if (!res.solved || res.leaks.length) continue;
      if (o.needBooster && !solTiles.some(function (s) { return s.type === 'booster'; })) continue;
      // puzzle-ify
      var invMandatory = o.invTypes || [];
      solTiles.forEach(function (s) {
        var toInv = rng() < (o.invRatio || 0) || invMandatory.indexOf(s.type) >= 0;
        if (s.type === 'bridge' && !o.bridgeInv) toInv = false;
        if (toInv) { var key = keyOf(s.type, s.freq); level.inventory[key] = (level.inventory[key] || 0) + 1; }
        else {
          var per = PERIOD[s.type];
          var locked = rng() < (o.lockRatio || 0) && s.type !== 'tee';
          var r0 = s.rot;
          if (!locked && per > 1) { r0 = (s.rot + ri(1, per - 1)) & 3; if (PERIOD[s.type] === 2) r0 = (s.rot + 1) & 3; }
          var fx = { x: s.x, y: s.y, type: s.type, rot: r0 };
          if (s.freq) fx.freq = s.freq;
          if (locked) fx.rotatable = false;
          level.fixed.push(fx);
        }
      });
      var empties = [];
      for (var c4 = 0; c4 < W * H; c4++) if (!cells[c4]) empties.push(c4);
      shuffle(empties);
      var adj = function (c) { var x = c % W, y = c / W | 0; for (var d = 0; d < 4; d++) { var nx = x + DX[d], ny = y + DY[d]; if (inB(nx, ny) && cells[ny * W + nx] && cells[ny * W + nx].kind === 'route') return true; } return false; };
      var nStatic = o.static || 0, nDis = o.distract || 0, nDec = o.decoys || 0;
      var ei = 0;
      empties.sort(function (a, b) { return (adj(b) ? 1 : 0) - (adj(a) ? 1 : 0) + (rng() - 0.5) * 1.2; });
      for (; ei < empties.length && nDec > 0; ei++, nDec--) level.decoys.push({ x: empties[ei] % W, y: empties[ei] / W | 0 });
      for (; ei < empties.length && nStatic > 0; ei++, nStatic--) level.static.push([empties[ei] % W, empties[ei] / W | 0]);
      for (; ei < empties.length && nDis > 0; ei++, nDis--) {
        var dt = pick(o.distractTypes || ['straight', 'corner']);
        level.fixed.push({ x: empties[ei] % W, y: empties[ei] / W | 0, type: dt, rot: ri(0, 3) & (PERIOD[dt] - 1 || 3) });
      }
      // starting state must not already be solved
      var Ls = compile(level);
      if (walk(Ls, Ls.tiles0).solved) continue;
      var sol = solve(Ls, { maxNodes: o.maxNodes || 120000 });
      if (!sol.ok) continue;
      if (sol.moves < (o.minMoves || 1)) continue;
      if (o.maxMoves && sol.moves > o.maxMoves) continue;
      level.par = { relays: sol.relays, moves: sol.moves };
      return { level: level, sol: sol, attempts: attempt + 1 };
    }
    return null;
  }

  /* daily signal options by weekday, seed = UTC date */
  function dailyLevel(dateStr) {
    var seed = hashStr('signal-lost:' + dateStr);
    var rng = mulberry32(seed);
    var variants = [
      { w: 6, h: 6, strength: 7, receivers: 2, minLen: 4, maxLen: 6, invRatio: 0.35, static: 3, distract: 2, minMoves: 6 },
      { w: 7, h: 6, strength: 6, receivers: 2, minLen: 4, maxLen: 7, invRatio: 0.3, static: 4, boosters: 1, distract: 2, minMoves: 6 },
      { w: 6, h: 6, strength: 7, receivers: 2, minLen: 4, maxLen: 6, invRatio: 0.25, tuners: ['amber'], static: 3, distract: 2, minMoves: 6 },
      { w: 7, h: 7, strength: 8, receivers: 3, minLen: 4, maxLen: 6, invRatio: 0.25, static: 4, distract: 3, minMoves: 7 }
    ];
    var v = Object.assign({}, variants[Math.floor(rng() * variants.length)]);
    v.id = 'daily-' + dateStr; v.maxNodes = 80000;
    for (var k = 0; k < 6; k++) {
      var g = generate((seed + k * 7919) >>> 0, v);
      if (g) { g.level.daily = dateStr; return g; }
    }
    return null;
  }

  return {
    DX: DX, DY: DY, DN: DN, SHAPES: SHAPES, PERIOD: PERIOD, FREQS: FREQS,
    K_EMPTY: K_EMPTY, K_STATIC: K_STATIC, K_BLOCK: K_BLOCK, K_TOWER: K_TOWER, K_RECV: K_RECV, K_DECOY: K_DECOY,
    fIndex: fIndex, isOpen: isOpen, rotCost: rotCost, sides: sides, parseKey: parseKey, keyOf: keyOf,
    mulberry32: mulberry32, hashStr: hashStr, compile: compile, cloneTiles: cloneTiles,
    walk: walk, solve: solve, checkSolution: checkSolution, generate: generate, dailyLevel: dailyLevel
  };
}
globalThis.SL = SL_ENGINE_FACTORY();
globalThis.SL_ENGINE_FACTORY = SL_ENGINE_FACTORY;
