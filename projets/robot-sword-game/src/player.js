// Robot : chargement du GLB, restylage Erathic, clips d'animation et lecture avec fondu.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { partGradient } from './shaders.js';
import { C, ANIMS } from './config.js';
import { BASEY, bounds, limeMat, greyMat, darkMat } from './materials.js';
import { b64ToBuffer } from './util.js';
import { resolveTransition } from './transitions.js';
import BOT_B64 from '../bot.b64.txt';
import JUMPS from '../jumps.json';
import FRANK from '../frank_clips.json';   // Frank RPG 2Handed (combo, coup reçu, mort), adapté au squelette du robot

// matériau par nom de matériau du GLB (le reste = Main)
const ROBOT_MATS = {
  Accent: () => limeMat(BASEY), Accent_Dark: () => limeMat(BASEY, { low:0.22, high:0.8, diagA:1, diagB:0.7 }),
  Blade: () => limeMat(BASEY), Blade_Edge: () => limeMat(BASEY, { low:0.7, high:1.3, power:0.8 }),
  Main: () => greyMat(BASEY), Material: () => greyMat(BASEY, C.gris, '#FFFFFF'), Black: () => darkMat(BASEY),
};
function styleRobot(model) {
  const cache = {}; const mk = n => (cache[n] = cache[n] || bounds((ROBOT_MATS[n] || ROBOT_MATS.Main)(), 0, 2.5));
  model.traverse(o => {
    if (!o.isMesh) return;
    const n = o.material.name; o.frustumCulled = false;
    if (/^(Accent|Accent_Dark|Blade|Blade_Edge)$/.test(n)) partGradient(o, new THREE.Matrix4());
    else { o.geometry = o.geometry.clone(); o.geometry.setAttribute('aDiag', new THREE.BufferAttribute(new Float32Array(o.geometry.attributes.position.count), 1)); }
    o.material = mk(n);
  });
}

// clip depuis le format JSON compact { dur, tracks:[{ n, t, v }] }
function clipFromJson(name, j) {
  const tr = j.tracks.map(t => t.n.endsWith('.quaternion') ? new THREE.QuaternionKeyframeTrack(t.n, t.t, t.v) : new THREE.VectorKeyframeTrack(t.n, t.t, t.v));
  return new THREE.AnimationClip(name, j.dur, tr);
}

export function createPlayer(ctx, { onReady, onError }) {
  const { S } = ctx, { scene } = ctx.stage;
  const group = new THREE.Group(); scene.add(group);
  const pl = { group, mixer:null, acts:{}, baseTs:{}, ready:false, last:null, play };

  new GLTFLoader().parse(b64ToBuffer(BOT_B64), '', gltf => {
    const model = gltf.scene; group.add(model);
    model.updateMatrixWorld(true);
    styleRobot(model);
    // échelle : tête vers 1,9 unité, robot centré sur son point d'appui
    const head = model.getObjectByName('Head'); const hp = new THREE.Vector3(); head.getWorldPosition(hp);
    const sc = 1.9 / hp.y; group.scale.setScalar(sc);
    group.updateMatrixWorld(true); const hw = new THREE.Vector3(); model.getObjectByName('Hips').getWorldPosition(hw); model.position.x -= hw.x / sc; model.position.z -= hw.z / sc;
    // animations (table ANIMS de config.js)
    pl.mixer = new THREE.AnimationMixer(model);
    const add = (key, clip, loop, ts) => { const a = pl.mixer.clipAction(clip); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop; a.timeScale = ts; pl.acts[key] = a; pl.baseTs[key] = ts; };
    ANIMS.native.forEach(([key, name, loop, ts]) => add(key, gltf.animations.find(a => a.name === name), loop, ts));
    ANIMS.frank.forEach(([key, name, loop, ts]) => add(key, clipFromJson(name, FRANK[name]), loop, ts));
    ANIMS.jumps.forEach(([key, name, loop, ts]) => add(key, clipFromJson(name, JUMPS[name]), loop, ts));
    play('idle');
    pl.ready = true; onReady && onReady();
  }, err => onError && onError(err));

  // lecture d'un clip : fondu et synchronisation de phase lus dans la table de transitions (fadeOverride force la durée)
  function play(key, fadeOverride) {
    if (S.cur === key || !pl.acts[key]) return;
    const next = pl.acts[key], prev = pl.acts[S.cur];
    const tr = resolveTransition(S.cur, key); const fade = fadeOverride ?? tr.fade;
    next.timeScale = pl.baseTs[key];                 // un warp précédent peut avoir modifié la vitesse : on la rétablit
    next.reset().play(); if (prev) next.crossFadeFrom(prev, fade, tr.sync);
    pl.last = { from:S.cur, to:key, fade, sync:tr.sync }; S.cur = key;
  }
  return pl;
}
