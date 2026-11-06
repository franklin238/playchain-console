// Level check for Neon Tide: plays every level headless with the built-in bot at five skill levels.
// Run: node tools/levels.cjs           prints result, time and score per level
//      node tools/levels.cjs --write   also writes the star scores into index.html (LEVEL_STARS)
// Stars: 1 = finish, 2 = 60% of the median bot score, 3 = 85% of the best bot score.
const fs = require('fs'), path = require('path');
const file = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const sim = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(x => x.includes('root.NT ='));
const host = {};
new Function('window', sim)(host);
const NT = host.NT;

function play(n, skill) {
  const L = NT.LEVELS[n], g = new NT.Game(NT.hashStr('neon-tide-level-' + (n + 1)), { level: L });
  for (let i = 0; i < 60 * 600 && !g.over; i++) { g.step(NT.botInput(g, skill)); g.ev.length = 0; }
  return { finished: g.finished, seconds: Math.round(g.tick / 60), score: Math.floor(g.score), splashes: g.splashes };
}
const round = v => Math.max(100, Math.round(v / 100) * 100);
const stars = [];
NT.LEVELS.forEach((L, n) => {
  const runs = [1, 0.9, 0.8, 0.7, 0.6].map(k => play(n, k));
  const scores = runs.map(r => r.score).sort((a, b) => a - b);
  const two = round(scores[2] * 0.6), three = Math.max(round(scores[4] * 0.85), two + 1000);
  stars.push([two, three]);
  const fin = runs.filter(r => r.finished).length;
  console.log(String(n + 1).padStart(2), L.name.padEnd(15), `${L.dist} m`.padStart(7), `finished ${fin}/5`, `time ${Math.min(...runs.map(r => r.seconds))}-${Math.max(...runs.map(r => r.seconds))} s`,
    `scores ${scores.join('/')}`, `stars ${two}/${three}`);
});
if (process.argv.includes('--write')) {
  const out = html.replace(/var LEVEL_STARS = \[[^\n]*\];/, 'var LEVEL_STARS = ' + JSON.stringify(stars) + ';');
  if (out === html) throw new Error('LEVEL_STARS not found');
  fs.writeFileSync(file, out);
  console.log('wrote LEVEL_STARS');
}
