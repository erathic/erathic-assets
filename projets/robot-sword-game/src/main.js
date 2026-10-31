// Point d'entrée : assemble les modules, lance la boucle de jeu et expose les accès de test.
import * as THREE from 'three';
import { createGore } from './gore.js';
import { HALF, BLOOD } from './config.js';
import { createState } from './state.js';
import { createStage } from './stage.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createController } from './controller.js';
import { createZombies } from './zombies.js';
import { createCombat } from './combat.js';
import { createUI } from './ui.js';
import { seed } from './util.js';
import { createPerf } from './perf.js';

// contexte partagé : chaque module y dépose son API ; les liens croisés (combat <-> zombies <-> ui) se résolvent à l'appel
const ctx = {};
const S = ctx.S = createState();
ctx.perf = createPerf();
ctx.stage = createStage(document.getElementById('app'));
ctx.world = createWorld(ctx.stage.scene);
ctx.input = createInput({ onJump: () => { S.jump = true; }, onAttack: () => { S.atk = true; } });
ctx.pl = createPlayer(ctx, {
  onReady: () => { const l = document.getElementById('load'); l.style.opacity = 0; setTimeout(() => l.remove(), 500); },
  onError: err => { document.getElementById('load').textContent = 'ERREUR ' + err; },
});
ctx.gore = createGore({ scene:ctx.stage.scene, half:HALF, palette:BLOOD });
ctx.zombies = createZombies(ctx);
ctx.combat = createCombat(ctx);
ctx.ui = createUI(ctx);
ctx.controller = createController(ctx);

// ---------- boucle de jeu ----------
function step(dt) {
  const perf = ctx.perf;
  if (!ctx.pl.ready) return;
  perf.begin('player'); ctx.controller.update(dt); perf.end('player');
  perf.begin('zombies'); if (!S.over || S.state === 'dead') ctx.zombies.update(dt); perf.end('zombies');
  perf.begin('gore'); ctx.gore.update(dt); perf.end('gore');
  ctx.stage.follow(ctx.pl.group.position, dt);
}
let last = performance.now(), frozen = false;
ctx.zombies.startWave();
ctx.stage.renderer.setAnimationLoop(() => { const n = performance.now(); const dt = Math.min((n - last) / 1000, 0.05); last = n; if (!frozen) step(dt); ctx.stage.render(); });

// accès pour les tests automatisés
window.__game = { S, stick:ctx.input.stick, zombies:ctx.zombies.list, gore:ctx.gore, restart:ctx.ui.restart,
  step: (n, dt = 1 / 30) => { frozen = true; for (let i = 0; i < n; i++) step(dt); ctx.stage.render(); },
  jump: () => { S.jump = true; }, atk: () => { S.atk = true; }, pos: () => ctx.pl.group.position.toArray(), ready: () => ctx.pl.ready,
  // banc d'essai : n images complètes (logique + rendu) avec chronomètres ; retourne ms par image et statistiques de rendu
  bench: (n, dt = 1 / 30) => { frozen = true; const perf = ctx.perf, r = ctx.stage.renderer; perf.enable(); perf.reset(); const t0 = performance.now();
    for (let i = 0; i < n; i++) { step(dt); perf.begin('render'); ctx.stage.render(); perf.end('render'); }
    const total = (performance.now() - t0) / n, info = r.info;
    return { total:+total.toFixed(2), ms:perf.report(n), calls:info.render.calls, triangles:info.render.triangles, geometries:info.memory.geometries, textures:info.memory.textures, programs:info.programs.length }; },
  clearZombies: ctx.zombies.clear,
  spawnMany: n => { for (let i = 0; i < n; i++) ctx.zombies.randomSpawn(); ctx.ui.hud(); },
  seed, renderer:ctx.stage.renderer,
  player:ctx.pl.group, pl:ctx.pl, THREE, alive:ctx.zombies.alive, hud:ctx.ui.hud };
