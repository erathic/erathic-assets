// Test de non-régression déterministe : aléatoire figé, scénario scripté, trace compacte de l'état du jeu.
// Usage : node tests/trace.js [index.html] > trace.txt   (deux builds au comportement identique donnent des traces identiques)
const { chromium } = require('playwright');
(async () => {
  const file = require('path').resolve(process.argv[2] || 'index.html');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 520 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.requestAnimationFrame = () => 0; });   // boucle temps réel coupée : seul __game.step fait avancer le jeu
  await p.goto('file://' + file);
  await p.waitForFunction('window.__game&&window.__game.ready()', { timeout: 90000 });
  await p.evaluate(() => { window.__game.seed(123456789); window.__game.restart(); });   // graine du jeu, puis nouvelle partie : séquence aléatoire reproductible
  const snap = () => p.evaluate(() => { const g = window.__game, S = g.S, f = x => +x.toFixed(3);
    return [S.state, S.cur, S.step, S.hp, S.kills, f(S.y), ...g.pos().map(f), g.alive(), g.zombies.length, g.gore.pieces(),
      g.zombies.map(z => z.state[0] + f(z.g.position.x) + ',' + f(z.g.position.z)).join(';')].join('|'); });
  const out = [];
  await p.evaluate(() => window.__game.step(70)); out.push('spawn ' + await snap());
  for (let i = 0; i < 24; i++) {
    await p.evaluate(i => { const g = window.__game, S = g.S, pp = g.player.position;
      const live = g.zombies.filter(z => !z.dead && z.state !== 'spawn').sort((a, b) => a.g.position.distanceTo(pp) - b.g.position.distanceTo(pp));
      if (live.length) { const z = live[0]; S.yaw = Math.atan2(z.g.position.x - pp.x, z.g.position.z - pp.z); }
      if (i % 5 === 3) g.jump(); g.stick.x = i % 3 === 0 ? 0.8 : 0; g.stick.y = i % 4 === 0 ? -0.7 : 0;
      g.atk(); g.step(14); }, i);
    out.push(i + ' ' + await snap());
  }
  await p.evaluate(() => window.__game.step(200)); out.push('fin ' + await snap());
  out.push('overlay ' + await p.evaluate(() => document.getElementById('end').style.display + ' ' + document.getElementById('endT').textContent));
  console.log(out.join('\n')); if (errs.length) console.log('ERREURS', errs.join('|'));
  await b.close();
})();
