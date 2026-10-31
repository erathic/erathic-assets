// Zombies : chargement du modèle (découpé par membre), apparition, IA (apparaître, poursuivre, mordre, mourir), séparation.
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { splitSkinned } from './gore.js';
import { HALF, ZOMBIE } from './config.js';
import { zMat } from './materials.js';
import { angleLerp, b64ToBuffer } from './util.js';
import ZOM_B64 from '../zombie.b64.txt';

// modèle source : un maillage par membre, mis à l'échelle (1,9 unité), pieds au sol, centré sur les hanches
function loadSource() {
  const o = new FBXLoader().parse(b64ToBuffer(ZOM_B64), '');
  o.traverse(n => { if (n.isMesh) { n.frustumCulled = false; n.material = zMat;
    n.geometry.setAttribute('aDiag', new THREE.BufferAttribute(new Float32Array(n.geometry.attributes.position.count), 1)); } });
  o.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(o, true); const scale = ZOMBIE.height / (box.max.y - box.min.y);
  const hw = new THREE.Vector3(); o.getObjectByName('Hips').getWorldPosition(hw);
  const offset = new THREE.Vector3(-hw.x * scale, -box.min.y * scale, -hw.z * scale);
  const clips = {};
  o.animations.forEach(a => { const k = /Walk/.test(a.name) ? 'walk' : /Bite/.test(a.name) ? 'bite' : /Idle/.test(a.name) ? 'idle' : null; if (k) clips[k] = a; });
  const sk = []; o.traverse(n => { if (n.isSkinnedMesh) sk.push(n); }); sk.forEach(m => splitSkinned(m, zMat));
  return { o, scale, offset, clips };
}

export function createZombies(ctx) {
  const { S, pl } = ctx, { scene } = ctx.stage, { blobTex } = ctx.world;
  const src = loadSource();
  const list = [];
  const shadowGeo = new THREE.PlaneGeometry(2.1, 2.1);

  function zplay(z, key, fade = 0.2) {
    if (z.cur === key) return; const n = z.A[key], p = z.A[z.cur];
    n.reset().play(); if (p) n.crossFadeFrom(p, fade, false); z.cur = key;
  }
  function spawn(x, z0, delay = 0) {
    const g = new THREE.Group(); g.rotation.order = 'YXZ';
    const model = skClone(src.o); model.scale.setScalar(src.scale); model.position.copy(src.offset); g.add(model);
    const mx = new THREE.AnimationMixer(model); const A = {};
    ZOMBIE.anims.forEach(([k, ts]) => { const a = mx.clipAction(src.clips[k], model); a.timeScale = ts; a.time = Math.random() * src.clips[k].duration; A[k] = a; });
    const sh = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ map:blobTex, transparent:true, depthWrite:false, opacity:0 }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.012; sh.renderOrder = 1;
    const z = { g, mx, A, sh, model, cur:'', state:'spawn', t:-delay, speed:ZOMBIE.speedMin + Math.random() * ZOMBIE.speedRange, dmgT:0, yaw:0, dead:false };
    g.position.set(x, -2.2, z0); g.visible = false; sh.visible = false; scene.add(g); scene.add(sh); zplay(z, 'idle', 0); list.push(z); return z;
  }
  // apparition à au moins 5 unités du robot
  function randomSpawn() {
    const pp = pl.group.position; let x = 0, z = 0;
    for (let i = 0; i < 40; i++) { x = (Math.random() * 2 - 1) * (HALF - 0.9); z = (Math.random() * 2 - 1) * (HALF - 0.9);
      if (Math.hypot(x - pp.x, z - pp.z) > 5) break; }
    return spawn(x, z);
  }
  const alive = () => list.filter(z => !z.dead).length;
  function startWave() { ZOMBIE.wave.forEach(([x, z], i) => spawn(x, z, i * ZOMBIE.waveDelay)); ctx.ui.hud(); }
  function clear() { list.forEach(z => { scene.remove(z.g); scene.remove(z.sh); }); list.length = 0; }

  function updateOne(z, dt) {
    const g = z.g, pp = pl.group.position;
    if (z.state === 'spawn') {                                    // sort du sol
      z.t += dt; if (z.t < 0) return; g.visible = true; z.sh.visible = true;
      const k = Math.min(1, z.t / 0.9), e = 1 - Math.pow(1 - k, 3); g.position.y = -2.2 * (1 - e); z.sh.material.opacity = e;
      z.yaw = Math.atan2(pp.x - g.position.x, pp.z - g.position.z); g.rotation.y = z.yaw;
      if (k >= 1) { z.state = 'chase'; z.sh.material.opacity = 1; }
      z.mx.update(dt); return;
    }
    if (z.state === 'dead') {                                     // bascule, recule, rétrécit puis disparaît
      z.t += dt; const k = Math.min(1, z.t / 0.45), e = 1 - Math.pow(1 - k, 2);
      g.rotation.x = -1.5 * e; g.position.addScaledVector(z.push, 2.2 * (1 - k) * dt);
      if (z.t < 0.3) z.mx.update(dt);
      if (z.t > 1.1) { const s = Math.max(0, 1 - (z.t - 1.1) / 0.5); g.scale.setScalar(s); z.sh.material.opacity = s; }
      if (z.t > 1.65) { scene.remove(g); scene.remove(z.sh); z.gone = true; }
      z.sh.position.x = g.position.x; z.sh.position.z = g.position.z; return;
    }
    const dx = pp.x - g.position.x, dz = pp.z - g.position.z, d = Math.hypot(dx, dz);
    z.yaw = angleLerp(z.yaw, Math.atan2(dx, dz), 1 - Math.pow(0.001, dt)); g.rotation.y = z.yaw;
    if (z.state === 'chase') {
      if (d > 1.3) { g.position.x += dx / d * z.speed * dt; g.position.z += dz / d * z.speed * dt; zplay(z, 'walk', 0.2); }
      else { z.state = 'bite'; z.dmgT = 0.45; zplay(z, 'bite', 0.15); }
    } else if (z.state === 'bite') {
      if (d > 1.9) { z.state = 'chase'; zplay(z, 'walk', 0.2); }
      else { z.dmgT -= dt; if (z.dmgT <= 0) { z.dmgT = 1.1; if (S.y < 0.6) ctx.combat.damagePlayer(); } }
    }
    z.mx.update(dt);
  }
  // les zombies se repoussent, ne traversent pas le robot et restent sur la plateforme
  function separate() {
    const pp = pl.group.position;
    const live = list.filter(z => !z.dead && z.state !== 'spawn');
    for (let i = 0; i < live.length; i++) {
      const a = live[i].g.position;
      for (let j = i + 1; j < live.length; j++) { const b = live[j].g.position; const dx = b.x - a.x, dz = b.z - a.z; const d = Math.hypot(dx, dz);
        if (d < 0.95 && d > 1e-4) { const p = (0.95 - d) / 2 / d; a.x -= dx * p; a.z -= dz * p; b.x += dx * p; b.z += dz * p; } }
      const dx = a.x - pp.x, dz = a.z - pp.z, d = Math.hypot(dx, dz);
      if (d < 1.0 && d > 1e-4) { a.x = pp.x + dx / d * 1.0; a.z = pp.z + dz / d * 1.0; }
      a.x = Math.max(-HALF + 0.3, Math.min(HALF - 0.3, a.x)); a.z = Math.max(-HALF + 0.3, Math.min(HALF - 0.3, a.z));
    }
  }
  function update(dt) {
    list.forEach(z => updateOne(z, dt));
    separate();
    list.forEach(z => { if (!z.dead || !z.gone) { z.sh.position.x = z.g.position.x; z.sh.position.z = z.g.position.z; } });
    for (let i = list.length - 1; i >= 0; i--) if (list[i].gone) list.splice(i, 1);
  }
  return { list, spawn, randomSpawn, startWave, alive, clear, update };
}
