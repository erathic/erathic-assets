// cli.js : node cli.js config.json out.json  (serveur http local requis : python3 -m http.server 8766 dans ce dossier)
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const cfg = JSON.parse(fs.readFileSync(process.argv[2])); const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try { const p = await b.newPage(); p.on('pageerror', (e) => console.log('ERR', e.message));
    await p.goto('http://localhost:8766/driver.html'); await p.waitForFunction('window.__ready');
    const r = await p.evaluate(async (c) => { try { return await window.retarget(c); } catch (e) { return { err: String(e.stack || e) }; } }, cfg);
    if (r.err) { console.log(r.err); process.exitCode = 1; } else { fs.writeFileSync(process.argv[3], JSON.stringify(r.clips)); console.log('k', r.k.toFixed(4), Object.entries(r.clips).map(([n, c]) => n + ':' + c.dur + 's/' + c.tracks.length + 'tr').join(' ')); }
  } finally { await b.close(); }
})();
