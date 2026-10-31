// Vagues de zombies, super zombies et drops. Vague n : WAVES.first + WAVES.add x (n-1) zombies ; un super zombie tous les SUPER.every éliminés ;
// chaque super zombie lâche l'arme suivante de DROP_ORDER (puis des soins).
import { rand, hyp } from '../util.js';
import { WAVES, ZHP, SUPER, DROP_ORDER, HEAL, ARENA } from './config.js';
import { WEAPONS } from './config.js';

export function createWaves(ctx, { superMat }) {
  const { S } = ctx, st = { wave: 0, state: 'pause', pauseT: 2.0, toSpawn: 0, spawnT: 0, dropIdx: 0 };
  const waveCount = n => Math.min(WAVES.maxPerWave, WAVES.first + WAVES.add * (n - 1));
  const waveMul = () => Math.min(WAVES.speedMaxMul, 1 + WAVES.speedPerWave * (Math.max(1, st.wave) - 1));
  const tmp = { x: 0, z: 0 };

  // point libre de l'île, loin du robot (anneau entre le logo et le bord)
  function spawnPoint(minDist = 4) {
    const pp = ctx.pl.group.position; let x = 0, z = 0;
    for (let i = 0; i < 60; i++) { const a = rand() * Math.PI * 2, r = 1.9 + rand() * (ARENA.playR - 0.6 - 1.9); x = Math.cos(a) * r; z = Math.sin(a) * r;
      tmp.x = x; tmp.z = z; ctx.colliders.constrain(tmp, 0.5); if (hyp(tmp.x - x, tmp.z - z) > 0.05) continue; if (hyp(x - pp.x, z - pp.z) >= minDist) break; }
    return { x, z };
  }
  function spawnNormal() { const p = spawnPoint(); ctx.zombies.spawn(p.x, p.z, 0, { hp: ZHP + Math.floor((Math.max(1, st.wave) - 1) / WAVES.hpEvery), speedMul: waveMul(), kind: 'normal' }); }
  function spawnSuper() { const p = spawnPoint(5); ctx.zombies.spawn(p.x, p.z, 0, { hp: SUPER.hp + SUPER.hpAdd * S.supers, scale: SUPER.scale, speedMul: SUPER.speedMul * waveMul(), material: superMat, kind: 'super' }); ctx.ui.banner('SUPER ZOMBIE', 1.8); }
  function onSuperKilled(z) {
    const p = { x: z.g.position.x, z: z.g.position.z }; ctx.colliders.constrain(p, 0.6);
    const id = DROP_ORDER[st.dropIdx]; st.dropIdx++;
    if (id) ctx.pickups.drop('weapon', id, p.x, p.z); else ctx.pickups.drop('heal', 'heal', p.x, p.z);
  }
  const liveNormals = () => { let n = 0; for (const z of ctx.zombies.list) if (!z.dead && z.kind === 'normal') n++; return n; };

  function update(dt) {
    if (S.over) return;
    if (st.state === 'pause') { st.pauseT -= dt; if (st.pauseT <= 0) { st.wave++; S.wave = st.wave; st.toSpawn = waveCount(st.wave); st.state = 'spawning'; st.spawnT = 0; ctx.ui.banner('VAGUE ' + st.wave, 2.2); ctx.ui.hud(); } }
    else if (st.state === 'spawning') { st.spawnT -= dt;
      if (st.toSpawn > 0 && st.spawnT <= 0 && ctx.zombies.alive() < WAVES.cap) { spawnNormal(); st.toSpawn--; st.spawnT = WAVES.spawnEvery; ctx.ui.hud(); }
      if (st.toSpawn === 0) st.state = 'fighting'; }
    else if (st.state === 'fighting') { if (liveNormals() === 0) { st.state = 'pause'; st.pauseT = WAVES.pause; ctx.ui.banner('VAGUE ' + st.wave + ' TERMINÉE', 1.8); } }
  }
  function reset() { Object.assign(st, { wave: 0, state: 'pause', pauseT: 2.0, toSpawn: 0, spawnT: 0, dropIdx: 0 }); }
  return { st, update, reset, spawnSuper, spawnNormal, onSuperKilled, waveCount, spawnPoint };
}
