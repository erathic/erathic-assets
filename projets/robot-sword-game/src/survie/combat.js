// Combat de survie : mêlée (cône), projectiles, rayon laser, dégâts avec points de vie, mort des zombies, dégâts reçus.
import * as THREE from 'three';
import { C } from '../config.js';
import { rand, hyp } from '../util.js';
import { SUPER } from './config.js';

export function createCombat(ctx) {
  const { S, pl, world } = ctx, { scene } = ctx.stage, Y = new THREE.Vector3(0, 1, 0);
  const alive = z => !z.dead && z.state !== 'spawn';

  // ---- projectiles : un seul maillage instancié ----
  const MAXB = 96, bGeo = new THREE.BoxGeometry(0.07, 0.07, 0.6), bMat = new THREE.MeshBasicMaterial({ color: C.lime });
  const bullets = new THREE.InstancedMesh(bGeo, bMat, MAXB); bullets.count = 0; bullets.frustumCulled = false; scene.add(bullets);
  const B = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pp = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  // ---- rayons laser : petit lot de maillages réutilisés ----
  const beams = []; for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: C.lime, transparent: true, opacity: 0.9, depthWrite: false })); m.visible = false; scene.add(m); beams.push({ m, life: 0 }); }
  const muzzle = new THREE.Vector3(), tmp = new THREE.Vector3();
  // origine des tirs : devant le robot, au niveau de la main ; le décalage latéral de la main est borné (la pose d'animation peut être en retard juste après un changement d'arme)
  function muzzlePos(w) {
    const p = pl.group.position, hand = pl.model.getObjectByName('Weapon'); hand.getWorldPosition(muzzle);
    const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw), rx = Math.cos(S.yaw), rz = -Math.sin(S.yaw), L = w.id === 'pistol' ? 0.9 : w.id === 'mg' ? 1.3 : 1.45;
    const lat = Math.max(-0.35, Math.min(0.35, (muzzle.x - p.x) * rx + (muzzle.z - p.z) * rz));
    muzzle.x = p.x + fx * L + rx * lat; muzzle.z = p.z + fz * L + rz * lat; muzzle.y = Math.max(0.6, Math.min(1.6, muzzle.y)); return muzzle;
  }

  function damageZombie(z, dmg, dir) {
    if (z.dead) return; z.hp -= dmg; z.flash = 0.12;
    if (z.hp <= 0) { killZombie(z, dir); return; }
    z.g.position.addScaledVector(dir, 0.12 / z.base);                                   // petit recul
    tmp.copy(z.g.position).setY(1.1); ctx.gore.burst(tmp, dir, 8, 1.5);
  }
  function killZombie(z, dir) {
    if (z.dead) return; z.dead = true; z.state = 'dead'; z.t = 0; S.kills++; z.push = dir.clone().setY(0).normalize();
    ctx.zombies.explode(z, z.push);
    if (z.kind === 'super') { S.supers++; ctx.waves.onSuperKilled(z); }
    if (S.kills % SUPER.every === 0) ctx.waves.spawnSuper();
    ctx.ui.hud();
  }

  // ---- mêlée ----
  function meleeHit(c) {
    const p = pl.group.position, fx = Math.sin(S.yaw), fz = Math.cos(S.yaw), dir = new THREE.Vector3();
    ctx.zombies.list.forEach(z => { if (!alive(z)) return;
      const dx = z.g.position.x - p.x, dz = z.g.position.z - p.z, d = hyp(dx, dz);
      if (d < c.range + 0.35 * (z.base - 1) && (dx * fx + dz * fz) / Math.max(d, 1e-3) > c.cos) damageZombie(z, c.dmg, dir.set(dx, 0, dz).normalize()); });
  }

  // ---- visée : zombie vivant le plus proche dans un cône de 40 degrés devant le robot ----
  function aimYaw(w) {
    const p = pl.group.position, fx = Math.sin(S.yaw), fz = Math.cos(S.yaw), reach = w.beam ? w.beamLen : w.range; let best = null, bd = 1e9;
    for (const z of ctx.zombies.list) { if (!alive(z)) continue; const dx = z.g.position.x - p.x, dz = z.g.position.z - p.z, d = hyp(dx, dz);
      if (d < reach && d > 0.2 && (dx * fx + dz * fz) / d > 0.77 && d < bd) { bd = d; best = Math.atan2(dx, dz); } }
    return best;
  }

  // ---- tir ----
  function fire(w) {
    const o = muzzlePos(w), yaw = S.yaw + (w.spread ? (rand() * 2 - 1) * w.spread : 0), dx = Math.sin(yaw), dz = Math.cos(yaw);
    if (w.beam) { const len = Math.min(w.beamLen, ctx.colliders.rayDistance(o.x, o.z, dx, dz, w.beamLen)); const dir = new THREE.Vector3(dx, 0, dz);
      ctx.zombies.list.forEach(z => { if (!alive(z)) return; const rx = z.g.position.x - o.x, rz = z.g.position.z - o.z, t = rx * dx + rz * dz, lat = Math.abs(rx * dz - rz * dx);
        if (t > -0.3 && t < len + 0.3 && lat < w.beamWidth / 2 + 0.35 * z.base) damageZombie(z, w.dmg, dir); });
      const b = beams.find(x => x.life <= 0) || beams[0]; b.life = 0.2; b.m.visible = true; b.m.scale.set(0.2, 0.2, len); b.m.position.set(o.x + dx * len / 2, o.y, o.z + dz * len / 2); b.m.rotation.y = yaw; return; }
    if (B.length < MAXB) B.push({ x: o.x, y: o.y, z: o.z, dx, dz, yaw, speed: w.speed, left: w.range, dmg: w.dmg });
  }
  function update(dt) {
    for (let i = B.length - 1; i >= 0; i--) { const b = B[i]; let dead = false; const total = b.speed * dt, n = Math.max(1, Math.ceil(total / 0.35)), step = total / n;
      for (let s = 0; s < n && !dead; s++) { b.x += b.dx * step; b.z += b.dz * step; b.left -= step;
        if (b.left <= 0 || ctx.colliders.blocked(b.x, b.z)) { dead = true; break; }
        for (const z of ctx.zombies.list) { if (!alive(z)) continue; if (hyp(z.g.position.x - b.x, z.g.position.z - b.z) < 0.5 * z.base + 0.1) { damageZombie(z, b.dmg, tmp.set(b.dx, 0, b.dz)); dead = true; break; } } }
      if (dead) { B[i] = B[B.length - 1]; B.pop(); } }
    bullets.count = B.length;
    for (let i = 0; i < B.length; i++) { const b = B[i]; q.setFromAxisAngle(Y, b.yaw); pp.set(b.x, b.y, b.z); m4.compose(pp, q, sc); bullets.setMatrixAt(i, m4); } bullets.instanceMatrix.needsUpdate = true;
    beams.forEach(b => { if (b.life > 0) { b.life -= dt; b.m.material.opacity = Math.max(0, b.life / 0.2) * 0.9; if (b.life <= 0) b.m.visible = false; } });
  }
  function clear() { B.length = 0; bullets.count = 0; beams.forEach(b => { b.life = 0; b.m.visible = false; }); }

  // ---- dégâts reçus ----
  function damagePlayer() {
    if (S.inv > 0 || S.over) return; S.hp--; S.inv = 1.2; ctx.ui.hud();
    if (S.hp <= 0) { S.over = true; S.state = 'dead'; S.deadT = 0; pl.play('death'); world.slash.visible = false; S.queued = false; return; }
    S.state = 'hurt'; S.queued = false; S.hurtT = 0.4; pl.play('hit'); world.slash.visible = false;
  }
  return { meleeHit, fire, aimYaw, damageZombie, killZombie, damagePlayer, update, clear };
}
