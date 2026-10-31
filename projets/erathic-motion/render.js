// Usage : node render.js <gabarit.html> <sortie.mp4> [--config c.json] [--size 1920x1080] [--fps 30] [--stills 0,2.5,4]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function arg(name, def) { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; }

(async () => {
  const html = process.argv[2], out = process.argv[3];
  const [W, H] = arg('size', '1920x1080').split('x').map(Number);
  const FPS = +arg('fps', 30), cfgPath = arg('config'), stills = arg('stills');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.addInitScript(({ cfg, W, H }) => { if (cfg) window.CONFIG = cfg; window.__W = W; window.__H = H; },
    { cfg: cfgPath ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : null, W, H });
  await page.goto('file://' + path.resolve(html));
  await page.evaluate(() => window.__ready);
  const dur = await page.evaluate(() => window.DUR);

  if (stills) {
    for (const t of stills.split(',')) {
      await page.evaluate(t => window.render(t), +t);
      await page.screenshot({ path: `still_${t}.png` });
    }
    await browser.close(); return;
  }
  const n = Math.round(dur * FPS);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < n; i++) {
    await page.evaluate(t => window.render(t), i / FPS);
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('ok', out, n, 'images');
})();
