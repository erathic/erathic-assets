// Perte puis restauration du contexte WebGL : le jeu doit afficher un message, puis reprendre le rendu sans erreur.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 520 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await p.goto('file://' + require('path').resolve(process.argv[2] || 'index.html')); await p.waitForFunction('window.__game&&window.__game.ready()', { timeout: 90000 });
  await p.evaluate(() => window.__game.step(30));
  const msg = () => p.evaluate(() => [...document.body.children].find(e => e.tagName === 'DIV' && e.textContent.startsWith('CONTEXTE'))?.style.display);
  await p.evaluate(() => { const g = window.__game.renderer.getContext(); window.__ext = g.getExtension('WEBGL_lose_context'); window.__ext.loseContext(); });
  await p.waitForTimeout(300); const during = await msg(); await p.evaluate(() => window.__game.step(5));    // pas de plantage pendant la perte
  await p.evaluate(() => window.__ext.restoreContext()); await p.waitForTimeout(500);
  const after = await msg(); const r = await p.evaluate(() => { window.__game.step(10); return window.__game.bench(5).calls; });
  const px = await p.evaluate(() => { const c = document.createElement('canvas'); const s = document.querySelector('canvas'); c.width = s.width; c.height = s.height; const x = c.getContext('2d'); x.drawImage(s, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let lit = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] > 60) lit++; return lit; });
  const checks = { 'message pendant la perte': during === 'flex', 'message retiré après restauration': after === 'none', 'rendu repris (appels > 0)': r > 0, 'image non vide': px > 20 };
  console.log(JSON.stringify(checks), 'calls', r, 'pixels clairs', px); console.log(errs.join('|') || 'no errors'); await b.close();
  if (!Object.values(checks).every(Boolean) || errs.length) process.exitCode = 1;
})();
