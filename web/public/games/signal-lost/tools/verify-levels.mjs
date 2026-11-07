// Verifies every campaign level: solvable, does not start solved, par matches the solver,
// and the solver's solution replays through the real signal walk. Also checks Daily Signal seeds.
// Run: node tools/verify-levels.mjs   (exit code 1 on any failure)
import '../engine.js';
import '../levels.js';
const SL = globalThis.SL, LEVELS = globalThis.SL_LEVELS;
let fail = 0;
const t0 = Date.now();
for (const lv of LEVELS) {
  const L = SL.compile(lv);
  const start = SL.walk(L, L.tiles0);
  const s = SL.solve(lv, { maxNodes: 2e6 });
  let msg = '';
  if (!s.ok) msg = 'UNSOLVABLE (' + s.status + ')';
  else if (s.status !== 'ok') msg = 'solver timed out, par unproven';
  else if (!lv.par || lv.par.relays !== s.relays || lv.par.moves !== s.moves) msg = `PAR WRONG: file ${JSON.stringify(lv.par)} solver ${s.relays}/${s.moves}`;
  else {
    const c = SL.checkSolution(lv, s);
    if (!c.solved || c.leaks || c.relays !== s.relays || c.moves !== s.moves) msg = 'REPLAY MISMATCH ' + JSON.stringify(c);
  }
  if (!msg && start.solved) msg = 'starts solved';
  if (msg) { fail++; console.log('FAIL', lv.id, msg); }
  else console.log('ok  ', lv.id.padEnd(5), `${lv.size[0]}x${lv.size[1]}`, `par relays ${s.relays} moves ${s.moves}`, `(${s.nodes} nodes)`);
}
// Campaign shape: 9 regions, at least 200 levels, mixers taught in region 6, one final level.
const regionsSeen = new Set(LEVELS.map(l => l.id.split('-')[0]));
if (regionsSeen.size !== 9) { fail++; console.log('FAIL expected 9 regions, found', regionsSeen.size); }
if (LEVELS.length < 200) { fail++; console.log('FAIL expected at least 200 levels, found', LEVELS.length); }
if (LEVELS.filter(l => l.final).length !== 1 || !LEVELS[LEVELS.length - 1].final) { fail++; console.log('FAIL the last level must be the one final level'); }
for (const lv of LEVELS.filter(l => l.id.startsWith('6-'))) {
  const hasMixer = (lv.fixed || []).some(f => f.type === 'mixer') || (lv.inventory || {}).mixer > 0;
  if (!hasMixer) { fail++; console.log('FAIL', lv.id, 'Spectrum Labs level without a mixer'); }
}
// Daily Signal: next 30 UTC days must all generate a verified puzzle
const base = Date.UTC(2026, 10, 1);
for (let d = 0; d < 30; d++) {
  const date = new Date(base + d * 864e5).toISOString().slice(0, 10);
  const g = SL.dailyLevel(date);
  const g2 = SL.dailyLevel(date);
  if (!g) { fail++; console.log('FAIL daily', date, 'no puzzle'); continue; }
  if (JSON.stringify(g.level) !== JSON.stringify(g2.level)) { fail++; console.log('FAIL daily', date, 'not deterministic'); continue; }
  const c = SL.checkSolution(g.level, g.sol);
  if (!c.solved) { fail++; console.log('FAIL daily', date, 'solution does not replay'); }
}
console.log(`\n${LEVELS.length} levels, 30 daily seeds, ${fail} failures, ${Date.now() - t0} ms`);
process.exit(fail ? 1 : 0);
