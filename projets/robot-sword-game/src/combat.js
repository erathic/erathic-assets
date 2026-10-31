// Combat : coup d'épée (portée et cône), dégâts reçus par le robot, mort d'un zombie (sang, démembrement, relance).
import * as THREE from 'three';
import { LIMBS } from './gore.js';
import { HALF, ZOMBIE } from './config.js';
import { zMat } from './materials.js';
import { rand, hyp } from './util.js';

export function createCombat(ctx) {
  const { S, pl, world } = ctx;

  function swordHit(c) {
    const p = pl.group.position, fx = Math.sin(S.yaw), fz = Math.cos(S.yaw);
    ctx.zombies.list.forEach(z => { if (z.dead || z.state === 'spawn') return;
      const dx = z.g.position.x - p.x, dz = z.g.position.z - p.z, d = hyp(dx, dz);
      if (d < c.range && (dx * fx + dz * fz) / Math.max(d, 1e-3) > c.cos) killZombie(z); });
  }

  function damagePlayer() {
    if (S.inv > 0 || S.over) return; S.hp--; S.inv = 1.2; ctx.ui.hud();
    if (S.hp <= 0) { S.over = true; S.state = 'dead'; S.deadT = 0; pl.play('death'); world.slash.visible = false; S.queued = false; return; }
    S.state = 'hurt'; S.queued = false; S.hurtT = 0.4; pl.play('hit'); world.slash.visible = false;
  }

  function killZombie(z) {
    if (z.dead) return; z.dead = true; z.state = 'dead'; z.t = 0; S.kills++;
    const d = new THREE.Vector3().subVectors(z.g.position, pl.group.position).setY(0).normalize(); z.push = d;   // recul
    ctx.zombies.explode(z, d);
    if (S.kills % ZOMBIE.respawnEvery === 0) ctx.zombies.randomSpawn();   // tous les N éliminés, un nouveau apparaît
    ctx.ui.hud(); if (ctx.zombies.alive() === 0) setTimeout(() => ctx.ui.finish(true), 900);
  }
  return { swordHit, damagePlayer, killZombie };
}
