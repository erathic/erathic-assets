// Zombies : chargement du modèle (découpé par membre), apparition, IA (apparaître, poursuivre, mordre, mourir), séparation.
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { splitSkinned } from './gore.js';
import { HALF, ZOMBIE } from './config.js';
import { zMat } from './materials.js';
import { angleLerp, b64ToBuffer, rand, hyp } from './util.js';
import { createShadows } from './shadows.js';
import ZOM_B64 from '../zombie.b64.txt';

// modèle source : un maillage par membre, mis à l'échelle (1,9 unité), pieds au sol, centré sur les hanches
export function loadZombieSource() {
  const o = new FBXLoader().parse(b64ToBuffer(ZOM_B64), '');
  o.traverse(n => { if (n.isMesh) { n.frustumCulled = false; n.material = zMat;
    n.geometry.setAttribute('aDiag', new THREE.BufferAttribute(new Float32Array(n.geometry.attributes.position.count), 1)); } });
  o.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(o, true); const scale = ZOMBIE.height / (box.max.y - box.min.y);
  const hw = new THREE.Vector3(); o.getObjectByName('Hips').getWorldPosition(hw);
  const offset = new THREE.Vector3(-hw.x * scale, -box.min.y * scale, -hw.z * scale);
  const clips = {};
  o.animations.forEach(a => { const k = /Walk/.test(a.name) ? 'walk' : /Bite/.test(a.name) ? 'bite' : /Idle/.test(a.name) ? 'idle' : null; if (k) clips[k] = a; });
  const sk = []; o.traverse(n => { if (n.isSkinnedMesh) sk.push(n); }); sk.forEach(m => splitSkinned(m, zMat, { keepWhole:true }));
  return { o, scale, offset, clips };
}

export function createZombies(ctx) {
  const { S, pl, perf } = ctx, { scene } = ctx.stage, { blobTex } = ctx.world;
  const src = loadZombieSource();
  const list = [];
  const shadows = createShadows(scene, blobTex);

  function zplay(z, key, fade = 0.2) {
    if (z.cur === key) return; const n = z.A[key], p = z.A[z.cur];
    n.reset().play(); if (p) n.crossFadeFrom(p, fade, false); z.cur = key;
  }
  function spawn(x, z0, delay = 0) {
    const g = new THREE.Group(); g.rotation.order = 'YXZ';
    const model = skClone(src.o); model.scale.setScalar(src.scale); model.position.copy(src.offset); g.add(model);
    const mx = new THREE.AnimationMixer(model); const A = {};
    ZOMBIE.anims.forEach(([k, ts]) => { const a = mx.clipAction(src.clips[k], model); a.timeScale = ts; a.time = rand() * src.clips[k].duration; A[k] = a; });
    const wholes = [], parts = []; model.traverse(n => { if (n.userData.whole) wholes.push(n); else if (n.userData.part) parts.push(n); });
    const z = { g, mx, A, id:uid++, mxDt:0, si:shadows.acquire(), shOp:0, model, wholes, parts, cur:'', state:'spawn', t:-delay, speed:ZOMBIE.speedMin + rand() * ZOMBIE.speedRange, dmgT:0, yaw:0, dead:false };
    g.position.set(x, -2.2, z0); g.visible = false; scene.add(g); zplay(z, 'idle', 0); list.push(z); return z;
  }
  // apparition à au moins 5 unités du robot
  function randomSpawn() {
    const pp = pl.group.position; let x = 0, z = 0;
    for (let i = 0; i < 40; i++) { x = (rand() * 2 - 1) * (HALF - 0.9); z = (rand() * 2 - 1) * (HALF - 0.9);
      if (hyp(x - pp.x, z - pp.z) > 5) break; }
    return spawn(x, z);
  }
  // à la mort : le maillage entier laisse la place aux pièces (membres détachables)
  function reveal(z) { z.wholes.forEach(m => { m.visible = false; }); z.parts.forEach(m => { m.visible = true; }); }
  const alive = () => { let n = 0; for (let i = 0; i < list.length; i++) if (!list[i].dead) n++; return n; };
  function startWave() { ZOMBIE.wave.forEach(([x, z], i) => spawn(x, z, i * ZOMBIE.waveDelay)); ctx.ui.hud(); }
  function clear() { list.forEach(z => { scene.remove(z.g); }); list.length = 0; shadows.clear(); }

  // animation : en foule, chaque zombie n'est mis à jour qu'une image sur N (échelonné par identifiant), avec le temps cumulé
  let frame = 0, every = 1, uid = 0;
  const mix = (z, dt) => {
    perf.begin('z.mixers');
    if (every === 1) z.mx.update(dt);
    else { z.mxDt += dt; if ((frame + z.id) % every === 0) { z.mx.update(z.mxDt); z.mxDt = 0; } }
    perf.end('z.mixers');
  };
  function updateOne(z, dt) {
    const g = z.g, pp = pl.group.position;
    if (z.state === 'spawn') {                                    // sort du sol
      z.t += dt; if (z.t < 0) return; g.visible = true;
      const k = Math.min(1, z.t / 0.9), e = 1 - Math.pow(1 - k, 3); g.position.y = -2.2 * (1 - e); z.shOp = e;
      z.yaw = Math.atan2(pp.x - g.position.x, pp.z - g.position.z); g.rotation.y = z.yaw;
      if (k >= 1) { z.state = 'chase'; z.shOp = 1; }
      mix(z, dt); return;
    }
    if (z.state === 'dead') {                                     // bascule, recule, rétrécit puis disparaît
      z.t += dt; const k = Math.min(1, z.t / 0.45), e = 1 - Math.pow(1 - k, 2);
      g.rotation.x = -1.5 * e; g.position.addScaledVector(z.push, 2.2 * (1 - k) * dt);
      if (z.t < 0.3) mix(z, dt);
      if (z.t > 1.1) { const s = Math.max(0, 1 - (z.t - 1.1) / 0.5); g.scale.setScalar(s); z.shOp = s; }
      if (z.t > 1.65) { scene.remove(g); shadows.release(z.si); z.si = -1; z.gone = true; }
      return;
    }
    const dx = pp.x - g.position.x, dz = pp.z - g.position.z, d = hyp(dx, dz);
    z.yaw = angleLerp(z.yaw, Math.atan2(dx, dz), 1 - Math.pow(0.001, dt)); g.rotation.y = z.yaw;
    if (z.state === 'chase') {
      if (d > 1.3) { g.position.x += dx / d * z.speed * dt; g.position.z += dz / d * z.speed * dt; zplay(z, 'walk', 0.2); }
      else { z.state = 'bite'; z.dmgT = 0.45; zplay(z, 'bite', 0.15); }
    } else if (z.state === 'bite') {
      if (d > 1.9) { z.state = 'chase'; zplay(z, 'walk', 0.2); }
      else { z.dmgT -= dt; if (z.dmgT <= 0) { z.dmgT = 1.1; if (S.y < 0.6) ctx.combat.damagePlayer(); } }
    }
    mix(z, dt);
  }
  const live = [];   // tampon réutilisé à chaque image
  // les zombies se repoussent, ne traversent pas le robot et restent sur la plateforme
  function separate() {
    const pp = pl.group.position;
    live.length = 0; for (let i = 0; i < list.length; i++) { const z = list[i]; if (!z.dead && z.state !== 'spawn') live.push(z); }
    for (let i = 0; i < live.length; i++) {
      const a = live[i].g.position;
      for (let j = i + 1; j < live.length; j++) { const b = live[j].g.position; const dx = b.x - a.x, dz = b.z - a.z; const d = hyp(dx, dz);
        if (d < 0.95 && d > 1e-4) { const p = (0.95 - d) / 2 / d; a.x -= dx * p; a.z -= dz * p; b.x += dx * p; b.z += dz * p; } }
      const dx = a.x - pp.x, dz = a.z - pp.z, d = hyp(dx, dz);
      if (d < 1.0 && d > 1e-4) { a.x = pp.x + dx / d * 1.0; a.z = pp.z + dz / d * 1.0; }
      a.x = Math.max(-HALF + 0.3, Math.min(HALF - 0.3, a.x)); a.z = Math.max(-HALF + 0.3, Math.min(HALF - 0.3, a.z));
    }
  }
  function update(dt) {
    frame++; every = 1; for (const [from, n] of ZOMBIE.lod) if (list.length >= from) every = n;
    perf.begin('z.ai'); list.forEach(z => updateOne(z, dt)); perf.end('z.ai');
    perf.begin('z.separate'); separate(); perf.end('z.separate');
    list.forEach(z => { if (z.si >= 0) shadows.set(z.si, z.g.position.x, z.g.position.z, z.shOp); });
    shadows.commit();
    for (let i = list.length - 1; i >= 0; i--) if (list[i].gone) list.splice(i, 1);
  }
  return { list, spawn, randomSpawn, startWave, alive, clear, update, reveal };
}
