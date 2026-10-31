// Vérifie la table de transitions : fondu lu dans config.js, synchronisation walk<->run, vitesses rétablies après un warp.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 520 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await p.goto('file://' + require('path').resolve(process.argv[2] || 'index.html'));
  await p.waitForFunction('window.__game&&window.__game.ready()', { timeout: 90000 });
  await p.evaluate(() => { const g = window.__game; g.zombies.length = 0; g.step(5); });
  const seq = [['idle', 0, 0], ['walk', 0.4, 0.4], ['run', 0.9, 0.9], ['walk', 0.4, 0.4], ['run', 0.9, 0.9], ['idle', 0, 0]]; const ok = [];
  for (const [want, x] of seq) {
    const r = await p.evaluate(x => { const g = window.__game; g.stick.x = x; g.stick.y = 0; g.step(30); return { last: g.pl.last, cur: g.S.cur, ts: { walk: g.pl.acts.walk.timeScale, run: g.pl.acts.run.timeScale, idle: g.pl.acts.idle.timeScale } }; }, x);
    console.log(want.padEnd(5), JSON.stringify(r)); ok.push(r.cur === want);
  }
  const t = await p.evaluate(() => { const g = window.__game; const l = []; g.stick.x = 0.9; g.step(30); g.stick.x = 0.4; g.step(30); return g.pl.last; });
  const checks = { 'etats atteints': ok.every(Boolean), 'walk>run sync': t.sync === true && t.fade === 0.18, 'vitesses=1': await p.evaluate(() => ['walk', 'run', 'idle'].every(k => window.__game.pl.acts[k].timeScale === window.__game.pl.baseTs[k])) };
  await p.evaluate(() => { const g = window.__game; g.stick.x = 0; g.atk(); g.step(3); }); const a = await p.evaluate(() => window.__game.pl.last);
  checks['idle>f1 fondu 0.06 sans sync'] = a.to === 'f1' && a.fade === 0.06 && a.sync === false;
  console.log(JSON.stringify(checks)); console.log(errs.join('|') || 'no errors'); await b.close(); if (!Object.values(checks).every(Boolean)) process.exitCode = 1;
})();
