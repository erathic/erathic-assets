// Atelier : parcours complet (objets, animations, transitions, tenue d'arme, démembrement, dépôt de fichier, captures).
// Usage : node tests/lab.js [index.lab.html]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const root = path.resolve(__dirname, '../../..'); const checks = {}; const ok = (k, v) => { checks[k] = !!v; };
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 760 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.lab.html')); await p.waitForFunction('window.__lab && window.__lab.obj', { timeout: 90000 });
  const L = f => p.evaluate(f);
  // robot
  ok('robot chargé', await L(() => __lab.obj.kind === 'robot' && __lab.obj.clips.length >= 30));
  ok('inventaire', (await p.textContent('#info')).includes('Triangles') && await L(() => __lab.inspect(__lab.obj.root).tris > 1000));
  const robotTris = await L(() => __lab.inspect(__lab.obj.root).tris);
  // animations
  await p.click('#clips .c:has-text("Walk")'); ok('clip Walk joué', await L(() => __lab.anim.current.name === 'Walk'));
  await p.fill('#tline', '0.3'); ok('curseur de temps', await L(() => Math.abs(__lab.anim.time() - 0.3) < 0.05 && __lab.anim.paused));
  await p.click('#bPlay'); ok('reprise', await L(() => !__lab.anim.paused));
  // matériaux
  const modes = []; for (const m of ['gris', 'normales', 'original', 'defaut']) { await p.selectOption('#matMode', m); modes.push(await L(() => __lab.obj.root.getObjectByProperty('isMesh', true).material.type)); }
  ok('modes de matériaux', modes.length === 4 && modes[1] === 'MeshNormalMaterial');
  await p.click('#bWire'); ok('filaire', await L(() => __lab.obj.root.getObjectByProperty('isMesh', true).material.wireframe)); await p.click('#bWire');
  await p.click('#bSkel'); await p.click('#bBox');
  // transition
  const ia = await L(() => __lab.obj.clips.findIndex(c => c.name === 'Idle_Sword')), ib = await L(() => __lab.obj.clips.findIndex(c => c.name === 'Run'));
  await p.selectOption('#tA', String(ia)); await p.selectOption('#tB', String(ib)); await p.click('#bGap');
  const gapTxt = await p.textContent('#gapRes'); ok('écart de pose mesuré', /écart moyen \d/.test(gapTxt) && /table du jeu 0.18/.test(gapTxt));
  await p.click('#bTrans'); await p.waitForTimeout(1800); ok('transition A vers B', await L(() => __lab.anim.current.name === 'Run'));
  // tenue d'arme
  await p.click('#bWAttach'); const w1 = JSON.parse(await p.inputValue('#wJson')); ok('arme accrochée à Weapon', w1.bone === 'Weapon' && w1.weapon.includes('démonstration'));
  await L(() => { const i = document.querySelector('#wCtl input'); i.value = i.max / 2; i.dispatchEvent(new Event('input')); }); const w2 = JSON.parse(await p.inputValue('#wJson')); ok('réglage appliqué', w2.position[0] !== w1.position[0]);
  await p.click('#bHideSword'); ok('épée du robot masquée', await L(() => __lab.obj.sword.visible === false)); await p.click('#bWDetach'); ok('arme retirée', await L(() => !__lab.wtool.attached));
  // épée isolée
  await p.click('#objBtns button[data-k=sword]'); await p.waitForFunction('__lab.obj.kind==="sword"'); const swordTris = await L(() => __lab.inspect(__lab.obj.root).tris); ok('épée isolée', swordTris > 0 && swordTris < robotTris);
  // zombie et démembrement
  await p.click('#objBtns button[data-k=zombie]'); await p.waitForFunction('__lab.obj.kind==="zombie"'); ok('zombie chargé', await L(() => __lab.obj.clips.length >= 3));
  await p.click('#goreBtns button:has-text("tête")'); await p.click('#goreBtns button:has-text("bras gauche")'); await p.waitForTimeout(600); ok('morceaux détachés', await L(() => __lab.gore.pieces() >= 2));
  await p.click('#goreBtns button:has-text("réinitialiser")'); await p.waitForTimeout(300); ok('réinitialisation', await L(() => __lab.gore.pieces() === 0 && __lab.obj.kind === 'zombie'));
  // dépôt de fichier : GLB, FBX, format refusé
  await p.setInputFiles('#file', path.join(root, 'personnages/bot_v1/Character-bot.glb')); await p.waitForFunction('__lab.obj.kind==="file"', { timeout: 30000 });
  ok('GLB déposé', await L(() => __lab.obj.name === 'Character-bot.glb' && __lab.obj.clips.length === 22 && __lab.obj.root.getObjectByProperty('isMesh', true).material.type !== 'MeshNormalMaterial'));
  ok('fichier : matériaux d\'origine par défaut', (await p.inputValue('#matMode')) === 'original');
  await p.setInputFiles('#file', path.join(root, 'personnages/zombie_quaternius_v1/Zombie.fbx')); await p.waitForFunction('__lab.obj.name==="Zombie.fbx"', { timeout: 30000 }); ok('FBX déposé', await L(() => __lab.obj.clips.length >= 3));
  // dérivé compressé en Meshopt par l'atelier local (si l'outil est installé) : doit se charger dans l'atelier avec le même nombre de triangles
  const tool = path.join(root, 'outils/atelier-mcp'); if (fs.existsSync(path.join(tool, 'node_modules'))) {
    const { execFileSync } = require('child_process'); const tmpRoot = fs.mkdtempSync('/tmp/atelier-lab-'); fs.mkdirSync(path.join(tmpRoot, 'p'), { recursive: true }); fs.copyFileSync(path.join(root, 'personnages/bot_v1/Character-bot.glb'), path.join(tmpRoot, 'p/bot.glb'));
    execFileSync('node', ['--no-warnings', path.join(tool, 'src/cli.js'), 'derive', 'p/bot.glb', '--nom', 'bot_meshopt', '--compresser', 'meshopt'], { env: { ...process.env, ATELIER_ROOTS: tmpRoot } });
    await p.setInputFiles('#file', path.join(tmpRoot, 'derives/bot_meshopt_v1/bot_meshopt_v1.glb')); await p.waitForFunction('__lab.obj.name==="bot_meshopt_v1.glb"', { timeout: 30000 });
    ok('dérivé Meshopt chargé', await L(() => __lab.obj.clips.length === 22 && __lab.inspect(__lab.obj.root).tris === 7520)); fs.rmSync(tmpRoot, { recursive: true, force: true }); }
  fs.writeFileSync('/tmp/mauvais.txt', 'x'); await p.setInputFiles('#file', '/tmp/mauvais.txt'); await p.waitForTimeout(300); ok('format refusé', (await p.textContent('#msg')).includes('Format'));
  // captures
  ok('capture de la vue', await L(() => __lab.viewer.capture().length > 2000));
  await p.click('#bSheet'); await p.waitForSelector('#shot img'); await p.waitForFunction(() => document.querySelector('#shot img').naturalWidth > 0);
  const [W, H, len] = await L(() => { const i = document.querySelector('#shot img'); return [i.naturalWidth, i.naturalHeight, i.src.length]; }); ok('planche 4 vues (carrée, 2x2) affichée dans la page', W === H && W >= 400 && len > 5000);
  await p.click('#shot button:has-text("fermer")'); ok('fenêtre fermée', await L(() => document.getElementById('shot').style.display === 'none'));
  await p.click('#bShot'); await p.waitForSelector('#shot img'); ok('image de la vue affichée', await L(() => document.querySelector('#shot img').src.startsWith('data:image/png')));
  ok('stats de rendu', await p.waitForFunction(() => /appels de rendu/.test(document.getElementById('hud').textContent), { timeout: 5000 }).then(() => true).catch(() => false));
  await p.screenshot({ path: '/tmp/atelier.png' });
  console.log(JSON.stringify(checks, null, 1)); console.log('robot tris', robotTris, 'épée tris', swordTris, 'planche', W + 'x' + H, '|', gapTxt); console.log(errs.join('\n') || 'no errors');
  await b.close(); if (!Object.values(checks).every(Boolean) || errs.length) process.exitCode = 1;
})();
