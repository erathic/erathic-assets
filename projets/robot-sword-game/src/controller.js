// Contrôleur du robot : machine à états (sol, saut, atterrissage, coup, blessé, mort), déplacement, combo, pose.
import * as THREE from 'three';
import { COMBO, SPEED, G, JV, LIM } from './config.js';
import { angleLerp } from './util.js';
import { BASEY } from './materials.js';

export function createController(ctx) {
  const { S, pl, input, world } = ctx, { slash, slashMat, shadow } = world;
  const fwd = new THREE.Vector3();

  const play = (k, f) => pl.play(k, f);

  function tryJump(grounded) {
    if (!S.jump) return; S.jump = false;
    if (grounded && S.state !== 'attack' && S.state !== 'hurt') { S.vy = JV; S.state = 'air'; play('jstart', 0.08); }
  }
  function tryAttack() {
    if (!S.atk) return; S.atk = false;
    if (S.state === 'attack') { if (S.step < COMBO.length - 1 && S.atkT > 0.05) S.queued = true; }      // mémorise le coup suivant (tampon d'entrée)
    else if (S.state !== 'air' && S.state !== 'hurt') { S.state = 'attack'; S.step = 0; S.queued = false; S.atkT = 0; S.swung = false; play(COMBO[0].key, 0.06); slash.visible = true; }
  }
  function move(dir, mag, dt) {
    const moveMul = S.state === 'attack' ? 0.18 : S.state === 'hurt' ? 0.4 : 1;
    const p = pl.group.position;
    if (mag > 0) {
      p.addScaledVector(dir, SPEED * (mag > 0.6 ? 1 : 0.55) * moveMul * dt);
      if (S.state !== 'attack') S.yaw = angleLerp(S.yaw, Math.atan2(dir.x, dir.z), 1 - Math.pow(0.0005, dt));
    }
    p.x = Math.max(-LIM, Math.min(LIM, p.x)); p.z = Math.max(-LIM, Math.min(LIM, p.z));
  }
  function vertical(dt) {
    if (S.state === 'air') {
      S.vy -= G * dt; S.y += S.vy * dt;
      if (S.y <= 0) { S.y = 0; S.vy = 0; S.state = 'land'; S.landT = 0; play('jland', 0.06); }
      else if (S.cur === 'jstart' && pl.acts.jstart.time > 0.35) play('jloop', 0.12);
    }
  }
  function timers(dt) {
    if (S.state === 'land') { S.landT += dt; if (S.landT > 0.28) S.state = 'ground'; }
    if (S.state === 'hurt') { S.hurtT -= dt; if (S.hurtT <= 0) S.state = 'ground'; }
    if (S.state === 'dead') { S.deadT += dt; if (S.deadT > 1.5 && !ctx.ui.endShown()) ctx.ui.finish(false); }
  }
  function attackTick(dt) {
    if (S.state !== 'attack') return;
    const c = COMBO[S.step]; S.atkT += dt;
    if (S.atkT < 0.32) pl.group.position.addScaledVector(fwd.set(Math.sin(S.yaw), 0, Math.cos(S.yaw)), c.lunge * dt);   // petit élan vers l'avant
    if (!S.swung && S.atkT > c.hit) { S.swung = true; ctx.combat.swordHit(c); }
    const k = (S.atkT - (c.hit - 0.04)) / 0.36; slash.visible = k > 0 && k < 1.2;
    slashMat.opacity = k > 0 ? Math.max(0, 0.85 * (1 - Math.max(0, k - 0.2))) : 0;
    slash.scale.setScalar((0.8 + 0.5 * Math.min(1, Math.max(0, k))) * c.sc);
    if (S.queued && S.atkT >= Math.min(c.cut, c.end - 0.05)) {                    // enchaîne le coup suivant
      S.step++; S.queued = false; S.atkT = 0; S.swung = false; play(COMBO[S.step].key, 0.06); slash.visible = true;
    } else if (S.atkT > c.end) { S.state = 'ground'; slash.visible = false; S.step = 0; }
  }
  function locomotion(mag) {
    if (S.state === 'ground') play(mag > 0 ? (mag > 0.6 ? 'run' : 'walk') : 'idle', 0.18);
  }
  function pose() {
    const p = pl.group.position;
    p.y = S.y; pl.group.rotation.y = S.yaw; BASEY.uIslandY.value = S.y;
    slash.position.set(p.x + Math.sin(S.yaw) * 0.55, 0.06, p.z + Math.cos(S.yaw) * 0.55); slash.rotation.z = S.yaw - Math.PI / 2;
    shadow.position.x = p.x; shadow.position.z = p.z;
    const hs = Math.max(0.45, 1 - S.y * 0.35); shadow.scale.setScalar(hs); shadow.material.opacity = Math.max(0.45, 1 - S.y * 0.4);
  }

  function update(dt) {
    let { dir, mag } = input.read();
    if (S.over) { mag = 0; S.jump = S.atk = false; }
    S.inv = Math.max(0, S.inv - dt);
    const grounded = S.y <= 0 && S.vy <= 0;
    tryJump(grounded); tryAttack(); move(dir, mag, dt); vertical(dt); timers(dt); attackTick(dt); locomotion(mag); pose();
    pl.mixer.update(dt);
  }
  return { update };
}
