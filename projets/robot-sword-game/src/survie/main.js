// Niveau de survie « Île Erathic » : point d'entrée. Assemble le socle du jeu (scène, robot, zombies, sang) et les modules de survie
// (niveau, armes, combat, vagues, ramassage, interface). Expose window.__game pour les tests.
import * as THREE from 'three';
import { createGore } from '../gore.js';
import { BLOOD } from '../config.js';
import { createState, resetState } from '../state.js';
import { createStage } from '../stage.js';
import { createInput } from '../input.js';
import { createPlayer } from '../player.js';
import { createZombies } from '../zombies.js';
import { createPerf } from '../perf.js';
import { seed } from '../util.js';
import { bounds, limeMat } from '../materials.js';
import { ARENA, HP_MAX, ANIMS_S, WEAPONS, HEAL } from './config.js';
import { createLevel } from './level.js';
import { createColliders } from './colliders.js';
import { createFx } from './fx.js';
import { createController } from './controller.js';
import { createCombat } from './combat.js';
import { createLoadout } from './weapons.js';
import { createPickups } from './pickups.js';
import { createWaves } from './waves.js';
import { createUI } from './ui.js';

const ctx = {};
const S = ctx.S = createState(); Object.assign(S, { weapon: 'fists', fireCd: 0, fireT: 0, fireReq: false, supers: 0, wave: 0, time: 0, hp: HP_MAX });
ctx.perf = createPerf();
ctx.stage = createStage(document.getElementById('app'), { view: ARENA.view, orbit: true });
ctx.level = createLevel(ctx.stage.scene);
ctx.colliders = createColliders({ circles: ctx.level.circles, segments: ctx.level.segments, playR: ARENA.playR });
ctx.world = createFx(ctx.stage.scene);
ctx.input = createInput({ onJump: () => { S.jump = true; }, onAttack: () => { S.atk = true; } });
let levelReady = false; ctx.level.ready().then(() => { levelReady = true; });
ctx.pl = createPlayer(ctx, { anims: ANIMS_S, initial: 'i_fists',
  onReady: () => { init(); const l = document.getElementById('load'); l.style.opacity = 0; setTimeout(() => l.remove(), 500); },
  onError: err => { document.getElementById('load').textContent = 'ERREUR ' + err; } });
ctx.gore = createGore({ scene: ctx.stage.scene, half: 7, palette: BLOOD });
ctx.zombies = createZombies(ctx, { constrain: (p, r) => ctx.colliders.constrain(p, r + 0.15) });
ctx.combat = createCombat(ctx);
ctx.pickups = createPickups(ctx);
const superMat = bounds(limeMat({ uIslandY: { value: 0 } }, { low: 0.30, high: 1.2 }), 0, 3.2); superMat.side = THREE.DoubleSide;   // super zombie : shader jaune
ctx.waves = createWaves(ctx, { superMat });
ctx.ui = createUI(ctx);
ctx.controller = createController(ctx);
ctx.loadout = createLoadout(ctx);

function equip(id) {                                                  // arme ramassée : remplace l'arme actuelle
  const w = WEAPONS[id]; S.weapon = id; ctx.loadout.equip(w); S.step = 0; S.queued = false; S.fireCd = 0; S.fireT = 0;
  if (S.state === 'attack') { S.state = 'ground'; ctx.world.slash.visible = false; } ctx.pl.restart(w.idle); ctx.ui.banner(w.nom, 1.6); ctx.ui.hud();
}
function collect(p) { if (p.kind === 'weapon') equip(p.id); else { S.hp = Math.min(HP_MAX, S.hp + HEAL); ctx.ui.banner('SOIN +' + HEAL, 1.4); ctx.ui.hud(); } }
function init() {                                                     // départ ou nouvelle partie
  resetState(S, HP_MAX); Object.assign(S, { weapon: 'fists', fireCd: 0, fireT: 0, fireReq: false, supers: 0, wave: 0, time: 0, swung: false });
  ctx.zombies.clear(); ctx.gore.clear(); ctx.pickups.clear(); ctx.combat.clear(); ctx.waves.reset();
  ctx.pl.group.position.set(0, 0, 2.6); S.cur = ''; ctx.loadout.equip(WEAPONS.fists); ctx.pl.play('i_fists'); ctx.ui.hide(); ctx.ui.hud();
}
ctx.restart = init;

let T = 0;
function step(dt) {
  if (!ctx.pl.ready) return; T += dt;
  if (!S.over) S.time += dt;
  ctx.waves.update(dt); ctx.controller.update(dt);
  if (!S.over || S.state === 'dead') ctx.zombies.update(dt);
  ctx.combat.update(dt); ctx.pickups.update(dt, ctx.pl.group.position, collect); ctx.gore.update(dt);
  ctx.level.update(T); ctx.ui.tick(dt); if (Math.floor(S.time * 4) !== S.tq) { S.tq = Math.floor(S.time * 4); ctx.ui.hud(); }
  ctx.stage.follow(ctx.pl.group.position, dt);
}
let last = performance.now(), frozen = false;
ctx.stage.renderer.setAnimationLoop(() => { const n = performance.now(); const dt = Math.min((n - last) / 1000, 0.05); last = n; if (!frozen) step(dt); ctx.stage.render(); });

window.__game = { S, stick: ctx.input.stick, zombies: ctx.zombies.list, gore: ctx.gore, waves: ctx.waves.st, pickups: ctx.pickups.list, wavesApi: ctx.waves, combat: ctx.combat, colliders: ctx.colliders, level: ctx.level,
  restart: init, equip, seed, step: (n, dt = 1 / 30) => { frozen = true; for (let i = 0; i < n; i++) step(dt); ctx.stage.render(); },
  jump: () => { S.jump = true; }, atk: () => { S.atk = true; }, pos: () => ctx.pl.group.position.toArray(), ready: () => ctx.pl.ready && levelReady, player: ctx.pl.group, pl: ctx.pl, THREE,
  spawnAt: (x, z, extra = {}) => ctx.zombies.spawn(x, z, 0, extra), keys: ctx.input.keys, alive: ctx.zombies.alive, hud: ctx.ui.hud, renderer: ctx.stage.renderer, cam: ctx.stage.cam, camCtl: ctx.stage.camCtl };
