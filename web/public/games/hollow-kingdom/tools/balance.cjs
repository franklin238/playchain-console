// Balance check for Hollow Kingdom: plays every kingdom with a simple "sensible player" bot over several seeds.
// Run: node tools/balance.cjs   (prints win rate, minutes at 1x speed, days, crowns, breaches and losses)
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || require('path').join(__dirname, '..', 'index.html'), 'utf8');
const a = html.indexOf('const CONTENT = {');
const b = html.indexOf('/* =====================================================================\n   AUDIO');
const sim = html.slice(a, b);
const bot = `
function plan(G) {
  const K = KINGDOM[G.kingdom], km = K.mod;
  const both = !km.oneSide && G.day > CONTENT.night.oneSideUntil;
  // everyone idle, then assign
  G.vill.forEach(v => { if (!v.sell && !v.wounded) v.job = 'idle'; });
  const people = G.vill.filter(v => !v.sell && !v.wounded).length;
  const perSide = Math.min(4, 1 + Math.floor(G.day / 2.5));
  let guardsR = perSide, guardsL = both ? perSide : 0;
  if (guardsR + guardsL > people - 2) { guardsR = Math.max(1, Math.floor((people - 2) / (both ? 2 : 1))); guardsL = both ? guardsR : 0; }
  for (let i = 0; i < guardsR; i++) assign(G, 'wall', 1, 1);
  for (let i = 0; i < guardsL; i++) assign(G, 'wall', 1, -1);
  const upkeep = Math.ceil(G.vill.length * (km.upkeep || 1) / (lit(G, 'kitchen') ? 2 : 1));
  const farmers = G.res.grain < upkeep * 2.5 ? 2 : G.res.grain < upkeep * 4 ? 1 : 0;
  for (let i = 0; i < farmers; i++) assign(G, 'fields', 1);
  const h = nextGoal(G);
  if (G.building) { assign(G, 'build', 1); assign(G, 'build', 1); }
  let need = { stone: 0, timber: 0 };
  if (h) { const c = hallCost(G, h); need.stone = Math.max(0, (c.st || 0) - G.res.stone); need.timber = Math.max(0, (c.tb || 0) - G.res.timber); }
  while (idleCount(G) > 0) {
    const job = need.stone >= need.timber ? 'quarry' : 'wood';
    assign(G, job, 1);
    if (job === 'quarry') need.stone -= 40; else need.timber -= 40;
  }
}
function tryBuild(G) {
  const h = nextGoal(G);
  if (h && !G.building && startRestore(G, h.id)) { assign(G, 'quarry', -1) || assign(G, 'wood', -1); assign(G, 'build', 1); assign(G, 'quarry', -1) || assign(G, 'wood', -1); assign(G, 'build', 1); }
  if (G.building === null) G.vill.forEach(v => { if (v.job === 'build') v.job = G.res.stone < G.res.timber ? 'quarry' : 'wood'; });
  // ember/coin halls: trade if market lit and short of coin
  if (h && lit(G, 'market')) { const c = hallCost(G, h); if ((c.co || 0) > G.res.coin && G.res.stone > 40) trade(G, 3); }
}
function powers(G) {
  const alive = W.en.filter(e => e.hp > 0 && e.st !== 'gone' && e.st !== 'dead');
  if (!alive.length) return;
  const near = alive.filter(e => Math.abs(e.x) < 1100);
  if (near.length >= 3) { const x = near[0].x; castPower(G, 'light', x); }
  if (alive.some(e => e.st === 'attack' || e.st === 'onwall')) castPower(G, 'rally');
  if (Math.min(G.walls.L.hp / G.walls.L.max, G.walls.R.hp / G.walls.R.max) < 0.4) castPower(G, 'mend');
  if (near.length >= 2) castPower(G, 'flare', near[0].x);
}
function play(kid, seed, maxDays) {
  const G = newGame(1, seed, kid); resetTransient(G);
  let seconds = 0, result = null, lastDay = 0;
  for (let step = 0; step < 30 * 60 * 400; step++) {
    if (G.phase === 'day' && G.day !== lastDay) { lastDay = G.day; plan(G); }
    if (G.phase === 'day' && step % 30 === 0) tryBuild(G);
    if (G.phase === 'night' && step % 15 === 0) powers(G);
    const r = simStep(G); seconds += STEP; FX.length = 0;
    if (r === 'dawn') {
      doDawn(G);
      if (G.event) { const ev = EVENTS.find(e => e.id === G.event); const i = ev.choices.findIndex(c => !c.ok || c.ok(G)); chooseEvent(G, i); }
      const k = kingdomCheck(G);
      if (k) { result = k; break; }
      if (G.day > maxDays) { result = 'timeout'; break; }
    }
  }
  return { result, day: G.day, minutes: +(seconds / 60).toFixed(1), restored: restoredCount(G), crowns: result === 'won' ? crownsFor(G) : 0, breach: G.kst.breach, lost: G.kst.lost, vill: G.vill.length };
}
const out = {};
for (const K of KINGDOMS) {
  out[K.id] = [];
  for (let s = 1; s <= 6; s++) out[K.id].push(play(K.id, s * 7919, K.goal.nights + 14));
}
return out;`;
const res = new Function(sim + bot)();
for (const k in res) {
  const rs = res[k], won = rs.filter(r => r.result === 'won');
  const avg = f => won.length ? (won.reduce((a, r) => a + r[f], 0) / won.length).toFixed(1) : '-';
  console.log(k.padEnd(10), 'won', won.length + '/' + rs.length, 'avg min', avg('minutes'), 'avg day', avg('day'), 'avg crowns', avg('crowns'), '|', rs.map(r => `${r.result[0]}:${r.minutes}m d${r.day} h${r.restored} b${r.breach} l${r.lost}`).join(' '));
}
