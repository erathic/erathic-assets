// Niveau de survie : vagues, super zombies, drops dans l'ordre, armes, points de vie, collisions, fin de partie.
// Usage : node tests/survie.js [index.survie.html]
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const checks = {}; const ok = (k, v) => { checks[k] = !!v; };
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 600 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await p.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.survie.html')); await p.waitForFunction('window.__game && window.__game.ready()', { timeout: 90000 });
  const E = (f, a) => p.evaluate(f, a);
  const fresh = () => E(() => { const g = window.__game; g.seed(7); g.restart(); g.S.inv = 1e9; });
  const killReady = () => E(() => { const g = window.__game; g.zombies.slice().forEach(z => { if (!z.dead && z.state !== 'spawn' && z.kind === 'normal') g.combat.damageZombie(z, 999, new g.THREE.Vector3(1, 0, 0)); }); });   // les supers sont épargnés
  try {
  await fresh();
  ok('départ : mains nues, 7 points de vie', await E(() => window.__game.S.weapon === 'fists' && window.__game.S.hp === 7 && window.__game.S.supers === 0));

  // ---- vagues ----
  await E(() => window.__game.step(70)); ok('vague 1 annoncée après 2 s', await E(() => window.__game.waves.wave === 1));
  await E(() => window.__game.step(110)); ok('vague 1 : 6 zombies', await E(() => window.__game.alive() === 6));
  await killReady(); await E(() => window.__game.step(20)); ok('vague terminée : pause', await E(() => window.__game.waves.state === 'pause'));
  await E(() => window.__game.step(110)); ok('vague 2 : 9 zombies prévus, 3 s de pause', await E(() => window.__game.waves.wave === 2 && window.__game.wavesApi.waveCount(2) === 9 && window.__game.wavesApi.waveCount(3) === 12));

  // ---- super zombie au 10e tué ----
  let kills = await E(() => window.__game.S.kills); let guard = 0;
  while (kills < 10 && guard++ < 40) { await E(() => window.__game.step(30)); await killReady(); kills = await E(() => window.__game.S.kills); }
  await E(() => window.__game.step(3));
  const sup = await E(() => { const g = window.__game, z = g.zombies.find(z => z.kind === 'super'), n = g.zombies.find(z => z.kind === 'normal'); return z ? { base: z.base, hp: z.hp, speed: z.speed, normal: n ? n.speed : null, kills: g.S.kills, shader: !!z.mat.userData.U, sameMatAsNormal: n ? n.mat === z.mat : null } : null; });
  console.log('super', JSON.stringify(sup)); ok('un super zombie apparaît au 10e zombie tué', sup && sup.kills >= 10 && sup.kills < 14);
  ok('super : 1,25x plus grand, 16 PV, shader jaune', sup && sup.base === 1.25 && sup.hp === 16 && sup.shader === true && sup.sameMatAsNormal === false);

  // ---- drops dans l'ordre fixe ----
  const order = []; const supers0 = await E(() => window.__game.S.supers);
  for (let i = 0; i < 6; i++) {
    for (let t = 0; t < 80; t++) { const has = await E(() => window.__game.zombies.some(z => z.kind === 'super' && !z.dead && z.state !== 'spawn')); if (has) break; await E(() => window.__game.step(10)); await killReady(); }
    await E(() => { const g = window.__game, z = g.zombies.find(z => z.kind === 'super' && !z.dead && z.state !== 'spawn'); g.combat.damageZombie(z, 999, new g.THREE.Vector3(1, 0, 0)); g.step(2); });
    order.push(await E(() => { const g = window.__game, d = g.pickups[g.pickups.length - 1]; return d ? (d.kind === 'weapon' ? d.id : 'heal') : null; }));
    await E(() => { const g = window.__game; g.pickups.slice().forEach(x => g.player.position.set(x.root.position.x, 0, x.root.position.z)); g.step(3); });
  }
  console.log('ordre des drops', order.join(', '));
  ok('drops dans l\'ordre : épée, épée 2 mains, pistolet, mitrailleuse, canon laser, puis soin', JSON.stringify(order) === JSON.stringify(['sword1', 'sword2', 'pistol', 'mg', 'laser', 'heal']));
  ok('arme ramassée équipée', await E(() => window.__game.S.weapon === 'laser')); ok('soin plafonné à 7', await E(() => window.__game.S.hp <= 7));

  // ---- armes : dégâts réels sur des zombies immobiles ----
  await E(() => { const c = window.__game.colliders; window.__bk = { circles: c.circles.slice(), segments: c.segments.slice() }; c.circles.length = 0; c.segments.length = 0; });   // terrain dégagé pour mesurer les dégâts
  const arena = (weapon, targets) => E(([weapon, targets]) => { const g = window.__game; g.waves.state = 'pause'; g.waves.pauseT = 1e9; g.zombies.slice().forEach(z => { z.g.visible = false; z.dead = true; z.gone = true; z.state = 'dead'; z.push = new g.THREE.Vector3(); });
    g.step(2); g.pickups.length = 0; g.combat.clear(); g.equip(weapon); Object.assign(g.S, { state: 'ground', yaw: 0, over: false, fireCd: 0, fireT: 0, step: 0, queued: false, atk: false, jump: false, inv: 1e9 }); g.player.position.set(2.6, 0, -1.8); g.keys.j = false;
    return targets.map(([dx, dz, hp]) => { const z = g.spawnAt(2.6 + dx, -1.8 + dz, { hp }); z.state = 'chase'; z.speed = 0; z.g.visible = true; z.g.position.y = 0; return z.id; }); }, [weapon, targets]);
  const hps = ids => E(ids => window.__game.zombies.filter(z => ids.includes(z.id)).map(z => z.hp), ids);
  const noBite = () => E(() => window.__game.zombies.forEach(z => { z.dmgT = 99; }));
  let ids = await arena('fists', [[0, 1.4, 6]]); await noBite(); await E(() => { window.__game.atk(); window.__game.step(12); }); ok('mains nues : coup de poing = 1 dégât', (await hps(ids))[0] === 5);
  ids = await arena('sword1', [[0, 1.5, 9]]); await noBite(); await E(() => { window.__game.atk(); window.__game.step(10); }); ok('épée : 2 dégâts', (await hps(ids))[0] === 7);
  ids = await arena('sword2', [[0, 1.5, 12], [1.6, 0.9, 12], [-1.6, 0.9, 12]]); await noBite(); await E(() => { window.__game.atk(); window.__game.step(14); }); const h2 = await hps(ids); ok('épée à deux mains : 3 dégâts, plusieurs zombies touchés (arc large)', h2[0] === 9 && h2[1] === 9 && h2[2] === 9);
  ids = await arena('pistol', [[0, 6, 9]]); await noBite(); await E(() => { window.__game.atk(); window.__game.step(20); }); const hpPistol = (await hps(ids))[0]; console.log('pistolet', hpPistol, '| épée 2 mains', JSON.stringify(h2)); ok('pistolet : une balle, 2 dégâts', hpPistol === 7);
  ids = await arena('mg', [[0, 6, 40]]); await noBite(); await E(() => { window.__game.keys.j = true; window.__game.step(30); window.__game.keys.j = false; }); const hm = (await hps(ids))[0]; console.log('mitrailleuse', 40 - hm, 'dégâts en 1 s'); ok('mitrailleuse : tir en continu (au moins 6 balles en 1 s)', 40 - hm >= 6 && 40 - hm <= 11);
  ids = await arena('laser', [[0, 2.5, 20], [0, 5, 20], [0, 8, 20]]); await noBite(); await E(() => { window.__game.atk(); window.__game.step(5); }); const hl = await hps(ids); ok('canon laser : le rayon traverse, 6 dégâts à chacun', hl.every(h => h === 14));
  ids = await arena('laser', [[0, 4, 20]]); await noBite(); await E(() => { window.__game.atk(); window.__game.step(40); window.__game.atk(); window.__game.step(5); }); ok('canon laser : cadence de 1,1 s entre deux tirs', (await hps(ids))[0] === 8);

  // ---- collisions : logo central et bord de l'île ----
  await E(() => { const c = window.__game.colliders; window.__bk.circles.forEach(x => c.circles.push(x)); window.__bk.segments.forEach(x => c.segments.push(x)); });
  const col = await E(() => { const g = window.__game, c = g.colliders, s = c.segments[0], p = { x: 0.1, z: 0.1 }; c.constrain(p, 0.45); const out = []; for (const q of [{ x: 0, z: 0 }, { x: 9, z: 0 }, { x: 0, z: -9 }]) { c.constrain(q, 0.45); out.push(Math.hypot(q.x, q.z)); } return { pushed: Math.hypot(p.x, p.z), border: out.slice(1), circles: c.circles.length, segR: s.r }; });
  ok('le logo est un obstacle solide', col.pushed > 0.4); ok('le robot reste dans l\'île', col.border.every(d => d <= 5.5 - 0.45 + 1e-6));
  const walk = await E(() => { const g = window.__game; g.step(2); Object.assign(g.S, { state: 'ground', over: false, inv: 1e9 }); g.player.position.set(0.8, 0, 3.0); let min = 9; const s = g.colliders.segments[0];
    for (let i = 0; i < 90; i++) { g.stick.x = -0.7; g.stick.y = -0.7; g.step(1); const p = g.player.position, ex = s.bx - s.ax, ez = s.bz - s.az; let t = ((p.x - s.ax) * ex + (p.z - s.az) * ez) / (ex * ex + ez * ez); t = Math.max(0, Math.min(1, t)); min = Math.min(min, Math.hypot(p.x - (s.ax + ex * t), p.z - (s.az + ez * t))); } g.stick.x = g.stick.y = 0; return { min, r: s.r }; });
  ok('marcher vers le logo : pas de traversée', walk.min >= walk.r + 0.4);

  // ---- points de vie, fin de partie, rejouer ----
  await fresh(); await E(() => { const g = window.__game; g.S.inv = 0; g.waves.state = 'pause'; g.waves.pauseT = 1e9; g.S.hp = 2; const z = g.spawnAt(g.player.position.x + 1.0, g.player.position.z, { hp: 99 }); z.state = 'bite'; z.dmgT = 0.1; z.speed = 0; z.g.visible = true; z.g.position.y = 0; });
  await E(() => window.__game.step(20)); ok('une morsure retire 1 point de vie', await E(() => window.__game.S.hp === 1));
  await E(() => window.__game.step(170)); ok('0 point de vie : fin de partie', await E(() => window.__game.S.over === true && document.getElementById('end').style.display === 'flex'));
  ok('l\'écran de fin affiche vague, éliminés, temps', (await p.textContent('#endS')).includes('VAGUE'));
  ok('meilleur score affiché (record ou meilleur)', /RECORD|MEILLEUR/.test(await p.textContent('#endB')));
  await E(() => document.getElementById('bRe').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await E(() => window.__game.step(2)); ok('rejouer : 7 PV, mains nues, partie remise à zéro', await E(() => { const g = window.__game; return g.S.hp === 7 && g.S.weapon === 'fists' && g.S.kills === 0 && g.waves.wave === 0 && g.alive() === 0; }));
  } catch (e) { errs.push('EXCEPTION ' + String(e.message).split('\n')[0]); }
  console.log(JSON.stringify(checks, null, 1)); console.log(errs.join('\n') || 'no errors'); await b.close(); if (!Object.values(checks).every(Boolean) || errs.length) process.exitCode = 1;
})();
