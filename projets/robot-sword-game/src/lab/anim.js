// Atelier : lecture des clips, curseur de temps, mesure de l'écart de pose et test de transition entre deux clips.
import * as THREE from 'three';
import { resolveTransition } from '../transitions.js';

const deg = Math.PI / 180;
export function suggestFade(m) { return m < 15 ? 0.06 : m < 30 ? 0.10 : m < 45 ? 0.15 : 0.20; }   // mêmes seuils que outils/transitions/pose_gap.mjs

export function createAnim() {
  let mixer = null, root = null, items = [], cur = null, pending = null;     // cur = { item, action }
  const bones = () => { const b = []; root && root.traverse(o => { if (o.isBone) b.push(o); }); return b; };

  function set(newRoot, newItems) { if (mixer) mixer.stopAllAction(); root = newRoot; items = newItems; cur = null; pending = null; mixer = items.length ? new THREE.AnimationMixer(root) : null; }
  const actionOf = it => mixer.clipAction(it.clip);

  // lecture d'un clip avec fondu depuis le clip courant
  function play(it, { fade = 0.2, loop = true, sync = false } = {}) {
    if (!mixer) return; const a = actionOf(it); a.reset(); a.enabled = true; a.paused = false;
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop; a.play();
    if (cur && cur.action !== a && fade > 0) a.crossFadeFrom(cur.action, fade, sync); else if (cur && cur.action !== a) cur.action.stop();
    cur = { item:it, action:a };
  }
  function setLoop(loop) { if (cur) { cur.action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); cur.action.clampWhenFinished = !loop; } }
  const pause = p => { if (cur) cur.action.paused = p; };
  const speed = v => { if (mixer) mixer.timeScale = v; };
  function setTime(t) { if (!cur) return; cur.action.paused = true; cur.action.time = Math.max(0, Math.min(t, cur.item.clip.duration)); mixer.update(0); }
  const time = () => (cur ? cur.action.time : 0);
  function update(dt) {
    if (!mixer) return; mixer.update(dt);
    if (pending) { pending.t += dt * mixer.timeScale; if (pending.t >= pending.hold) { const p = pending; pending = null; play(p.B, { fade:p.fade, loop:true, sync:p.sync }); } }
  }

  // pose (rotations locales de tous les os) d'un clip à l'instant t
  function snapshot(it, t) {
    const keep = cur && { item:cur.item, time:cur.action.time, paused:cur.action.paused };
    mixer.stopAllAction(); const a = actionOf(it); a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.play(); a.time = t; mixer.update(0);
    const pose = {}; bones().forEach(b => { pose[b.name] = b.quaternion.clone(); }); a.stop();
    if (keep) { const k = actionOf(keep.item); k.reset(); k.enabled = true; k.play(); k.time = keep.time; k.paused = keep.paused; cur = { item:keep.item, action:k }; mixer.update(0); }
    return pose;
  }
  // écart moyen (degrés) entre la pose de A à tA et le début de B
  function gap(A, tA, B) {
    if (!mixer) return null; const pa = snapshot(A, tA), pb = snapshot(B, 0); let sum = 0, n = 0, worst = 0, wn = '';
    for (const k in pa) { if (!pb[k]) continue; const d = Math.abs(pa[k].dot(pb[k])), a = 2 * Math.acos(Math.min(1, d)) / deg; sum += a; n++; if (a > worst) { worst = a; wn = k; } }
    const mean = n ? sum / n : 0; return { mean:+mean.toFixed(1), worst:+worst.toFixed(0), bone:wn, suggested:suggestFade(mean), bonesCompared:n };
  }
  // fondu proposé par la table du jeu pour la paire (clés de jeu), sinon valeur par défaut
  function gameFade(A, B) { return A.key && B.key ? resolveTransition(A.key, B.key) : null; }
  function transition(A, B, { tA = 0, hold = 0.4, fade = 0.2, sync = false } = {}) {
    if (!mixer) return; mixer.stopAllAction(); cur = null; play(A, { fade:0, loop:false }); cur.action.time = tA; mixer.update(0);
    pending = { B, hold, fade, sync, t:0 };
  }
  return { set, play, setLoop, pause, speed, setTime, time, update, gap, gameFade, transition,
    get current() { return cur ? cur.item : null; }, get paused() { return cur ? cur.action.paused : true; }, get duration() { return cur ? cur.item.clip.duration : 0; }, get pending() { return !!pending; } };
}
