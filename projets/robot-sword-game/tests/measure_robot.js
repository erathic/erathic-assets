// Mesures sur le robot, pour régler les armes et les combos : repère de l'épée d'origine dans le point d'attache « Weapon »,
// orientation d'une arme à feu dans la pose de visée, instants de pic de vitesse (instant du coup) des clips de combat.
// Usage : node tests/measure_robot.js [index.lab.html]   (construire d'abord avec : bash build.sh lab)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(process.argv[2] || 'index.lab.html')); await p.waitForFunction('window.__lab && window.__lab.obj', { timeout: 90000 });
  const out = await p.evaluate(async () => {
    const L = window.__lab, T = L.THREE, R = await L.loadRobot(); L.setObject(R); const root = R.root, anim = L.anim;
    const bone = n => root.getObjectByName(n); const res = {};
    // 1. épée d'origine : points du maillage dans le repère local de « Weapon », pose de repos
    anim.pause(true); root.updateMatrixWorld(true); const weapon = bone('Weapon'), invW = weapon.matrixWorld.clone().invert(), pts = [], v = new T.Vector3();
    R.sword.traverse(m => { if (m.isSkinnedMesh) { const n = m.geometry.attributes.position.count; for (let i = 0; i < n; i++) { m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld).applyMatrix4(invW); pts.push(v.clone()); } } });
    const c = new T.Vector3(); pts.forEach(q => c.add(q)); c.multiplyScalar(1 / pts.length);
    let ax = new T.Vector3(1, 0.3, 0.2).normalize(); for (let it = 0; it < 30; it++) { const nx = new T.Vector3(); pts.forEach(q => { const d = q.clone().sub(c); nx.addScaledVector(d, d.dot(ax)); }); ax = nx.normalize(); }
    let lo = 1e9, hi = -1e9; pts.forEach(q => { const t = q.clone().sub(c).dot(ax); lo = Math.min(lo, t); hi = Math.max(hi, t); });
    const wq = new T.Quaternion(); weapon.getWorldQuaternion(wq);
    res.epee = { points: pts.length, centre_local: c.toArray().map(x => +x.toFixed(4)), axe_local: ax.toArray().map(x => +x.toFixed(4)), min: +lo.toFixed(4), max: +hi.toFixed(4), longueur: +(hi - lo).toFixed(4),
      echelle_monde: root.scale.x, hauteur_monde: +(new T.Box3().setFromObject(root, true).getSize(new T.Vector3()).y).toFixed(3) };
    // 2. arme à feu en pose de visée : repère local qui met le canon (+z) dans l'axe de l'avant-bras, le dessus (+y) vers le haut
    const gun = R.clips.find(c => c.name === 'Idle_Gun_Pointing'); anim.play(gun, { fade: 0 }); anim.setTime(0.2); L.viewer.renderer.render(L.viewer.scene, L.viewer.camera);
    root.updateMatrixWorld(true); const hand = new T.Vector3(), elbow = new T.Vector3(); bone('HandR').getWorldPosition(hand); bone('LowerArmR').getWorldPosition(elbow);
    const D = hand.clone().sub(elbow).normalize(); const up = new T.Vector3(0, 1, 0), X = new T.Vector3().crossVectors(up, D).normalize(), Y = new T.Vector3().crossVectors(D, X).normalize();
    const Rw = new T.Matrix4().makeBasis(X, Y, D), Qrw = new T.Quaternion().setFromRotationMatrix(Rw), Qw = new T.Quaternion(); weapon.getWorldQuaternion(Qw);
    const Ql = Qw.clone().invert().multiply(Qrw); const E = new T.Euler().setFromQuaternion(Ql);
    const rootQ = new T.Quaternion(); root.getWorldQuaternion(rootQ); const fwd = new T.Vector3(0, 0, 1).applyQuaternion(rootQ);
    res.visee = { avant_bras_monde: D.toArray().map(x => +x.toFixed(3)), quaternion_local: Ql.toArray().map(x => +x.toFixed(4)), euler_local: [E.x, E.y, E.z].map(x => +x.toFixed(4)), angle_avec_avant_robot_deg: +(Math.acos(Math.min(1, D.dot(fwd))) * 180 / Math.PI).toFixed(1) };
    // 3. instants de pic de vitesse des extrémités sur les clips de combat
    const eff = ['HandR', 'HandL', 'FootR', 'FootL'], names = ['Punch_Left', 'Punch_Right', 'Kick_Left', 'Kick_Right', 'Sword_Slash', 'Sword_Attack', 'Combo01_1', 'Combo01_2', 'Combo01_3', 'Combo01_4', 'Gun_Shoot', 'Idle_Gun_Shoot', 'Run_Shoot', 'Hit01', 'HitRecieve', 'Death', 'Idle_Neutral', 'Idle_Gun_Pointing', 'Idle_Sword', 'Roll'];
    res.clips = {};
    for (const nm of names) { const it = R.clips.find(c => c.name === nm); if (!it) { res.clips[nm] = null; continue; }
      anim.play(it, { fade: 0, loop: false }); const dur = it.clip.duration, N = Math.max(8, Math.round(dur * 60)), prev = {}, best = {};
      eff.forEach(e => { best[e] = { v: 0, t: 0 }; });
      for (let i = 0; i <= N; i++) { const t = dur * i / N; anim.setTime(t); root.updateMatrixWorld(true);
        eff.forEach(e => { const q = new T.Vector3(); bone(e).getWorldPosition(q); if (prev[e]) { const sp = q.distanceTo(prev[e]) / (dur / N); if (sp > best[e].v) best[e] = { v: sp, t }; } prev[e] = q; }); }
      const top = eff.map(e => [e, best[e]]).sort((a, b) => b[1].v - a[1].v)[0];
      res.clips[nm] = { duree: +dur.toFixed(3), pic: { os: top[0], t: +top[1].t.toFixed(3), vitesse: +top[1].v.toFixed(2) }, par_os: Object.fromEntries(eff.map(e => [e, +best[e].t.toFixed(3)])) }; }
    return res;
  });
  fs.writeFileSync('/tmp/robot_mesures.json', JSON.stringify(out, null, 1)); console.log(JSON.stringify(out.epee), '\n', JSON.stringify(out.visee));
  Object.entries(out.clips).forEach(([k, v]) => console.log(k.padEnd(18), v ? `${v.duree}s  pic ${v.pic.os} à ${v.pic.t}s (${v.pic.vitesse} u/s)` : 'absent')); console.log(errs.join('|') || 'no errors'); await b.close();
})();
