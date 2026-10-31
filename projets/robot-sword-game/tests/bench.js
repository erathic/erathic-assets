// Banc d'essai : coût par image avec N zombies (aléatoire figé, boucle temps réel coupée).
// Usage : node tests/bench.js [index.html] [N1,N2,...]   ex. node tests/bench.js index.html 4,25,50,100
// ATTENTION : le rendu se fait ici en logiciel (SwiftShader), donc "render" n'est PAS représentatif d'un vrai GPU.
// Les temps de logique (player, zombies, z.mixers, z.ai, z.separate, gore) mesurent le processeur et donnent l'ordre de grandeur ;
// calls / triangles / geometries sont exacts et indépendants du GPU.
const { chromium } = require('playwright');
(async () => {
  const file = require('path').resolve(process.argv[2] || 'index.html'); const counts = (process.argv[3] || '4,25,50,100').split(',').map(Number);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const rows = [];
  for (const n of counts) {
    const p = await b.newPage({ viewport: { width: 900, height: 520 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await p.goto('file://' + file); await p.waitForFunction('window.__game&&window.__game.ready()', { timeout: 90000 });
    await p.evaluate(n => { const g = window.__game; g.seed(987654321); g.restart(); g.S.hp = 1e9; if (n > 4) g.spawnMany(n - 4); g.step(90); }, n);   // tous sortis du sol et en train de poursuivre
    const r = await p.evaluate(() => window.__game.bench(150));
    // second passage : profileur d'allocations (CDP), volume alloué par image et principales fonctions responsables
    const cdp = await p.context().newCDPSession(p); await cdp.send('HeapProfiler.enable');
    await cdp.send('HeapProfiler.startSampling', { samplingInterval: 256, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    await p.evaluate(() => window.__game.bench(100));
    const prof = (await cdp.send('HeapProfiler.stopSampling')).profile; const by = {}; let tot = 0;
    (function walk(nd) { const f = nd.callFrame, k = (f.functionName || '(anonyme)') + ' ' + f.url.split('/').pop() + ':' + f.lineNumber; by[k] = (by[k] || 0) + nd.selfSize; tot += nd.selfSize; nd.children.forEach(walk); })(prof.head);
    r.allocKB = +(tot / 100 / 1024).toFixed(1); r.top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${(v / 100 / 1024).toFixed(1)} KB/img  ${k}`);
    r.n = n; r.alive = await p.evaluate(() => window.__game.alive()); r.errs = errs.join('|'); rows.push(r); await p.close();
  }
  const keys = ['player', 'zombies', 'z.ai', 'z.mixers', 'z.separate', 'gore', 'render'];
  console.log('N'.padStart(4), 'total'.padStart(7), ...keys.map(k => k.padStart(10)), 'calls'.padStart(6), 'tris'.padStart(8), 'geom'.padStart(5), 'prog'.padStart(5), 'KB/img'.padStart(7));
  rows.forEach(r => console.log(String(r.n).padStart(4), String(r.total).padStart(7), ...keys.map(k => String(r.ms[k] ?? '-').padStart(10)), String(r.calls).padStart(6), String(r.triangles).padStart(8), String(r.geometries).padStart(5), String(r.programs).padStart(5), String(r.allocKB).padStart(7), r.errs));
  const big = rows[rows.length - 1]; console.log(`\nPrincipales allocations par image à N=${big.n} (bundle minifié : noms de fonctions raccourcis) :`); big.top.forEach(t => console.log('  ' + t));
  console.log('(ms par image ; z.ai, z.mixers et z.separate sont inclus dans zombies ; z.mixers est inclus dans z.ai)');
  await b.close();
})();
