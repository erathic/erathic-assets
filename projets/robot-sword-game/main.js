import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { fresnelMaterial, gradientMaterial, partGradient } from './shaders.js';
import BOT_B64 from './bot.b64.txt';
import JUMPS from './jumps.json';
import FRANK from './frank_clips.json';   // Frank RPG 2Handed (combo, coup reçu, mort), adapté au squelette du robot
import ZOM_B64 from './zombie.b64.txt';
import { createGore, splitSkinned, LIMBS } from './gore.js';

// ---------- charte ----------
const C = { noir:'#1E1F22', lime:'#DBFF00', blanc:'#FFFFFF', gris:'#F1F1F3', gris2:'#D9D9D9', anthra:'#2F2F33' };

// ---------- rendu ----------
const host = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false, preserveDrawingBuffer:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(C.noir, 1);
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const VIEW = 4.6, CAMOFF = new THREE.Vector3(9, 8.2, 9), camT = new THREE.Vector3();
const cam = new THREE.OrthographicCamera(-VIEW, VIEW, VIEW, -VIEW, 4, 40);
cam.position.copy(CAMOFF); cam.lookAt(0, 0.3, 0);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 2.6); sun.position.set(7, 9, 3); scene.add(sun);
const rim = new THREE.DirectionalLight(0xffffff, 1.0); rim.position.set(-7, 2, -4); scene.add(rim);
function resize() {
  const w = host.clientWidth, h = host.clientHeight, a = w / h;
  renderer.setSize(w, h, false);
  if (a >= 1) { cam.left = -VIEW * a; cam.right = VIEW * a; cam.top = VIEW; cam.bottom = -VIEW; }
  else { cam.left = -VIEW; cam.right = VIEW; cam.top = VIEW / a; cam.bottom = -VIEW / a; }
  cam.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

// ---------- matériaux Erathic ----------
const PLAT = { uIslandY: { value: 0 } };              // matériaux de la plateforme (repère fixe)
const BASEY = { uIslandY: { value: 0 } };             // matériaux du robot : suit sa hauteur
const limeMat = (shared, o = {}) => fresnelMaterial(C.lime, '#EEFF72', { power:1.05, low:0.34, high:1.10, diagA:1.18, diagB:0.5, shared, ...o });
const greyMat = (shared, hex = C.gris2, rimHex = '#FCFCFD') => fresnelMaterial(hex, rimHex, { power:1.6, low:0.30, high:1.20, shared });
const darkMat = (shared) => fresnelMaterial(C.anthra, '#7C7D87', { power:2.0, strength:0.7, low:0.85, high:1.15, shared });
const bounds = (m, lo, hi) => { m.userData.U.uYMin.value = lo; m.userData.U.uYMax.value = hi; return m; };

// ---------- plateforme carrée ----------
const HALF = 4.4, THICK = 0.7;
const platform = new THREE.Group(); scene.add(platform);
const top = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 0.12, HALF * 2), gradientMaterial('#62636C', '#17181B', HALF * 1.4, { gain:1.35 }));
top.position.y = -0.06; platform.add(top);
const body = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, THICK, HALF * 2), bounds(greyMat(PLAT, C.gris, '#FFFFFF'), -THICK - 0.12, 0));
body.position.y = -0.12 - THICK / 2; platform.add(body);
// liseré jaune sur le bord
const FR = 0.16, FH = 0.07, limePlat = bounds(limeMat(PLAT, { low:0.8, high:1.1 }), 0, 0.2);
[[0, HALF - FR / 2, HALF * 2, FR], [0, -HALF + FR / 2, HALF * 2, FR], [HALF - FR / 2, 0, FR, HALF * 2 - FR * 2], [-HALF + FR / 2, 0, FR, HALF * 2 - FR * 2]].forEach(([x, z, w, d]) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, FH, d), limePlat); m.position.set(x, FH / 2, z); platform.add(m);
});
// ombre douce sous le robot
const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(0,0,0,0.55)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), new THREE.MeshBasicMaterial({ map:blobTex, transparent:true, depthWrite:false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; shadow.renderOrder = 1; scene.add(shadow);
// arc du coup d'épée
const slashMat = new THREE.MeshBasicMaterial({ color:C.lime, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false });
const slash = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.9, 24, 1, -Math.PI * 0.55, Math.PI * 1.1), slashMat);
slash.rotation.x = -Math.PI / 2; slash.visible = false; slash.renderOrder = 2; scene.add(slash);

// ---------- robot ----------
const player = new THREE.Group(); scene.add(player);
const bin = Uint8Array.from(atob(BOT_B64), c => c.charCodeAt(0)).buffer;
let mixer = null, acts = {}, ready = false;
const S = { state:'ground', t:0, vy:0, y:0, yaw:Math.PI * 0.25, atkT:0, landT:0, cur:'', jump:false, atk:false, hp:6, step:0, queued:false, inv:0, hurtT:0, hit:false, over:false, kills:0, deadT:0 };
const HP_MAX = 6;
// combo à 4 coups (animations Frank RPG 2Handed : Combo01_1 à 4). hit = instant du coup, cut = début de la fenêtre d'enchaînement
const COMBO = [
  { key:'f1', hit:0.29, cut:0.52, end:0.74, range:2.4, cos:0.05, sc:1.0, lunge:1.2 },
  { key:'f2', hit:0.35, cut:0.58, end:0.88, range:2.7, cos:-0.2, sc:1.2, lunge:1.0 },
  { key:'f3', hit:0.42, cut:0.66, end:0.93, range:2.7, cos:-0.2, sc:1.2, lunge:1.0 },
  { key:'f4', hit:0.39, cut:9,    end:1.20, range:3.1, cos:-0.6, sc:1.6, lunge:2.0 },
];

new GLTFLoader().parse(bin, '', gltf => {
  const model = gltf.scene; player.add(model);
  model.updateMatrixWorld(true);
  const M = {
    Accent: () => limeMat(BASEY), Accent_Dark: () => limeMat(BASEY, { low:0.22, high:0.8, diagA:1, diagB:0.7 }),
    Blade: () => limeMat(BASEY), Blade_Edge: () => limeMat(BASEY, { low:0.7, high:1.3, power:0.8 }),
    Main: () => greyMat(BASEY), Material: () => greyMat(BASEY, C.gris, '#FFFFFF'), Black: () => darkMat(BASEY),
  };
  const cache = {}; const mk = n => (cache[n] = cache[n] || bounds((M[n] || M.Main)(), 0, 2.5));
  model.traverse(o => {
    if (!o.isMesh) return;
    const n = o.material.name; o.frustumCulled = false;
    if (/^(Accent|Accent_Dark|Blade|Blade_Edge)$/.test(n)) partGradient(o, new THREE.Matrix4());
    else { o.geometry = o.geometry.clone(); o.geometry.setAttribute('aDiag', new THREE.BufferAttribute(new Float32Array(o.geometry.attributes.position.count), 1)); }
    o.material = mk(n);
  });
  // échelle : tête vers 1,25 unité
  const head = model.getObjectByName('Head'); const hp = new THREE.Vector3(); head.getWorldPosition(hp);
  const sc = 1.9 / hp.y; player.scale.setScalar(sc);
  player.updateMatrixWorld(true); const hw = new THREE.Vector3(); model.getObjectByName('Hips').getWorldPosition(hw); model.position.x -= hw.x / sc; model.position.z -= hw.z / sc;   // centre le robot sur son point d'appui
  // animations
  mixer = new THREE.AnimationMixer(model);
  const find = n => gltf.animations.find(a => a.name === n);
  const mkJump = (name, ts = 1) => { const j = JUMPS[name];
    const tr = j.tracks.map(t => t.n.endsWith('.quaternion') ? new THREE.QuaternionKeyframeTrack(t.n, t.t, t.v) : new THREE.VectorKeyframeTrack(t.n, t.t, t.v));
    return new THREE.AnimationClip(name, j.dur, tr); };
  const add = (key, clip, loop, ts = 1) => { const a = mixer.clipAction(clip); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop; a.timeScale = ts; acts[key] = a; };
  add('idle', find('Idle_Sword'), true); add('walk', find('Walk'), true); add('run', find('Run'), true);
  const mkFrank = n => { const j = FRANK[n]; return new THREE.AnimationClip(n, j.dur, j.tracks.map(t => t.n.endsWith('.quaternion') ? new THREE.QuaternionKeyframeTrack(t.n, t.t, t.v) : new THREE.VectorKeyframeTrack(t.n, t.t, t.v))); };
  add('f1', mkFrank('Combo01_1'), false, 1.7); add('f2', mkFrank('Combo01_2'), false, 1.7); add('f3', mkFrank('Combo01_3'), false, 1.7); add('f4', mkFrank('Combo01_4'), false, 1.7);
  add('hit', mkFrank('Hit01'), false, 1.4); add('death', mkFrank('Death01'), false, 1);
  add('jstart', mkJump('Jump_Start'), false, 2.3); add('jloop', mkJump('Jump_Loop'), true, 1.2); add('jland', mkJump('Jump_Land'), false, 2.4);
  play('idle', 0);
  ready = true; const l = document.getElementById('load'); l.style.opacity = 0; setTimeout(() => l.remove(), 500);
}, err => { document.getElementById('load').textContent = 'ERREUR ' + err; });

function play(key, fade = 0.15) {
  if (S.cur === key || !acts[key]) return;
  const next = acts[key], prev = acts[S.cur];
  next.reset().play(); if (prev) next.crossFadeFrom(prev, fade, false); S.cur = key;
}

// ---------- entrées ----------
const keys = {}; const stick = { x:0, y:0 };
const dirOf = e => e.key.toLowerCase();
window.addEventListener('keydown', e => { const k = dirOf(e); if (k === ' ' || k === 'j' || k === 'enter' || k.startsWith('arrow')) e.preventDefault();
  if (!keys[k]) { if (k === ' ') S.jump = true; if (k === 'j' || k === 'enter') S.atk = true; } keys[k] = true; });
window.addEventListener('keyup', e => { keys[dirOf(e)] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
// joystick tactile / souris
const stickEl = document.getElementById('stick'), knob = stickEl.querySelector('.knob');
let stickId = null; const R = 52;
function stickMove(e) {
  const r = stickEl.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
  knob.style.transform = `translate(${dx}px,${dy}px)`; stick.x = dx / R; stick.y = dy / R;
}
stickEl.addEventListener('pointerdown', e => { stickId = e.pointerId; stickEl.setPointerCapture(e.pointerId); stickMove(e); e.preventDefault(); });
stickEl.addEventListener('pointermove', e => { if (e.pointerId === stickId) stickMove(e); });
const stickEnd = e => { if (e.pointerId !== stickId) return; stickId = null; stick.x = stick.y = 0; knob.style.transform = ''; };
stickEl.addEventListener('pointerup', stickEnd); stickEl.addEventListener('pointercancel', stickEnd);
// boutons
function bind(id, fn) { const el = document.getElementById(id);
  el.addEventListener('pointerdown', e => { el.classList.add('on'); fn(); e.preventDefault(); });
  const off = () => el.classList.remove('on'); el.addEventListener('pointerup', off); el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off); }
bind('bAtk', () => { S.atk = true; }); bind('bJmp', () => { S.jump = true; });
document.addEventListener('contextmenu', e => e.preventDefault());

// ---------- zombies ----------
const ZSH = { uIslandY: { value: 0 } };
const zMat = bounds(fresnelMaterial('#3A3B40', C.lime, { power:2.0, strength:0.55, low:0.55, high:1.2, shared:ZSH }), 0, 2.1);
zMat.side = THREE.DoubleSide;   // l'intérieur des membres coupés reste visible
// couleur du « sang » : jaune Erathic par défaut. Pour du rouge : ['#B3001B', '#7A0012', '#D9D9D9']
const BLOOD = ['#DBFF00', '#B9D600', '#F1F1F3'];
const gore = createGore({ scene, half:HALF, palette:BLOOD });
let zSrc = null, zScale = 1; const zOff = new THREE.Vector3(); const zClips = {};
(function loadZombie() {
  const o = new FBXLoader().parse(Uint8Array.from(atob(ZOM_B64), c => c.charCodeAt(0)).buffer, '');
  o.traverse(n => { if (n.isMesh) { n.frustumCulled = false; n.material = zMat;
    n.geometry.setAttribute('aDiag', new THREE.BufferAttribute(new Float32Array(n.geometry.attributes.position.count), 1)); } });
  o.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(o, true); zScale = 1.9 / (box.max.y - box.min.y);
  const hw = new THREE.Vector3(); o.getObjectByName('Hips').getWorldPosition(hw);
  zOff.set(-hw.x * zScale, -box.min.y * zScale, -hw.z * zScale);
  o.animations.forEach(a => { const k = /Walk/.test(a.name) ? 'walk' : /Bite/.test(a.name) ? 'bite' : /Idle/.test(a.name) ? 'idle' : null; if (k) zClips[k] = a; });
  const sk = []; o.traverse(n => { if (n.isSkinnedMesh) sk.push(n); }); sk.forEach(m => splitSkinned(m, zMat));   // un maillage par membre (démembrement)
  zSrc = o;
})();
const zombies = [];
const zShadowGeo = new THREE.PlaneGeometry(2.1, 2.1);
function zplay(z, key, fade = 0.2) {
  if (z.cur === key) return; const n = z.A[key], p = z.A[z.cur];
  n.reset().play(); if (p) n.crossFadeFrom(p, fade, false); z.cur = key;
}
function spawnZombie(x, z0, delay = 0) {
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const model = skClone(zSrc); model.scale.setScalar(zScale); model.position.copy(zOff); g.add(model);
  const mx = new THREE.AnimationMixer(model); const A = {};
  [['walk', 1.5], ['idle', 1], ['bite', 1.1]].forEach(([k, ts]) => { const a = mx.clipAction(zClips[k], model); a.timeScale = ts; a.time = Math.random() * zClips[k].duration; A[k] = a; });
  const sh = new THREE.Mesh(zShadowGeo, new THREE.MeshBasicMaterial({ map:blobTex, transparent:true, depthWrite:false, opacity:0 }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.012; sh.renderOrder = 1;
  const z = { g, mx, A, sh, model, cur:'', state:'spawn', t:-delay, speed:0.85 + Math.random() * 0.25, dmgT:0, yaw:0, dead:false };
  g.position.set(x, -2.2, z0); g.visible = false; sh.visible = false; scene.add(g); scene.add(sh); zplay(z, 'idle', 0); zombies.push(z); return z;
}
function randomSpawn() {
  let x = 0, z = 0;
  for (let i = 0; i < 40; i++) { x = (Math.random() * 2 - 1) * (HALF - 0.9); z = (Math.random() * 2 - 1) * (HALF - 0.9);
    if (Math.hypot(x - player.position.x, z - player.position.z) > 5) break; }
  return spawnZombie(x, z);
}
const alive = () => zombies.filter(z => !z.dead).length;
function startWave() { [[-3.2, -3.2], [3.2, -3.2], [-3.2, 3.2], [3.2, 3.2]].forEach(([x, z], i) => spawnZombie(x, z, i * 0.35)); hud(); }
function killZombie(z) {
  if (z.dead) return; z.dead = true; z.state = 'dead'; z.t = 0; S.kills++;
  const d = new THREE.Vector3().subVectors(z.g.position, player.position).setY(0).normalize(); z.push = d;   // recul
  // sang + démembrement
  z.g.updateMatrixWorld(true); const wp = new THREE.Vector3(), chest = z.model.getObjectByName('Spine1');
  if (chest) { chest.getWorldPosition(wp); gore.burst(wp, d, 60, 2.6); }
  const chance = { head:0.75, armL:0.5, armR:0.5, legL:0.22, legR:0.22 }; let any = false; const picks = [];
  for (const k in chance) if (Math.random() < chance[k]) { picks.push(k); any = true; }
  if (!any) picks.push('head');
  picks.forEach(k => {
    const part = z.model.getObjectByName('part_' + k); const bone = z.model.getObjectByName(LIMBS[k].stump); if (!part) return;
    const imp = new THREE.Vector3(d.x * (1.6 + Math.random() * 2) + (Math.random() - 0.5) * 2, 3.2 + Math.random() * 2.4, d.z * (1.6 + Math.random() * 2) + (Math.random() - 0.5) * 2);
    gore.detach(part, zMat, imp);
    gore.spurt(p => { z.g.updateMatrixWorld(true); bone.getWorldPosition(p); }, 0.7 + Math.random() * 0.3);
  });
  if (S.kills % 2 === 0) randomSpawn();              // tous les 2 zombies tués, un nouveau apparaît
  hud(); if (alive() === 0) setTimeout(() => finish(true), 900);
}
function swordHit(c) {
  const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw);
  zombies.forEach(z => { if (z.dead || z.state === 'spawn') return;
    const dx = z.g.position.x - player.position.x, dz = z.g.position.z - player.position.z, d = Math.hypot(dx, dz);
    if (d < c.range && (dx * fx + dz * fz) / Math.max(d, 1e-3) > c.cos) killZombie(z); });
}
function damagePlayer() {
  if (S.inv > 0 || S.over) return; S.hp--; S.inv = 1.2; hud();
  if (S.hp <= 0) { S.over = true; S.state = 'dead'; S.deadT = 0; play('death', 0.1); slash.visible = false; S.queued = false; return; }
  S.state = 'hurt'; S.queued = false; S.hurtT = 0.4; play('hit', 0.05); slash.visible = false;
}
function updateZombie(z, dt) {
  const g = z.g, pp = player.position;
  if (z.state === 'spawn') {
    z.t += dt; if (z.t < 0) return; g.visible = true; z.sh.visible = true;
    const k = Math.min(1, z.t / 0.9), e = 1 - Math.pow(1 - k, 3); g.position.y = -2.2 * (1 - e); z.sh.material.opacity = e;
    z.yaw = Math.atan2(pp.x - g.position.x, pp.z - g.position.z); g.rotation.y = z.yaw;
    if (k >= 1) { z.state = 'chase'; z.sh.material.opacity = 1; }
    z.mx.update(dt); return;
  }
  if (z.state === 'dead') {
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
    else { z.dmgT -= dt; if (z.dmgT <= 0) { z.dmgT = 1.1; if (S.y < 0.6) damagePlayer(); } }
  }
  z.mx.update(dt);
}
function updateZombies(dt) {
  zombies.forEach(z => updateZombie(z, dt));
  const live = zombies.filter(z => !z.dead && z.state !== 'spawn');
  for (let i = 0; i < live.length; i++) {            // les zombies se repoussent et ne traversent pas le robot
    const a = live[i].g.position;
    for (let j = i + 1; j < live.length; j++) { const b = live[j].g.position; let dx = b.x - a.x, dz = b.z - a.z; const d = Math.hypot(dx, dz);
      if (d < 0.95 && d > 1e-4) { const p = (0.95 - d) / 2 / d; a.x -= dx * p; a.z -= dz * p; b.x += dx * p; b.z += dz * p; } }
    const dx = a.x - player.position.x, dz = a.z - player.position.z, d = Math.hypot(dx, dz);
    if (d < 1.0 && d > 1e-4) { a.x = player.position.x + dx / d * 1.0; a.z = player.position.z + dz / d * 1.0; }
    a.x = Math.max(-HALF + 0.3, Math.min(HALF - 0.3, a.x)); a.z = Math.max(-HALF + 0.3, Math.min(HALF - 0.3, a.z));
  }
  zombies.forEach(z => { if (!z.dead || !z.gone) { z.sh.position.x = z.g.position.x; z.sh.position.z = z.g.position.z; } });
  for (let i = zombies.length - 1; i >= 0; i--) if (zombies[i].gone) zombies.splice(i, 1);
}

// ---------- interface : points de vie, compteur, fin de partie ----------
const hpEl = document.getElementById('hp'), cntEl = document.getElementById('cnt'), endEl = document.getElementById('end');
function hud() {
  hpEl.innerHTML = Array.from({ length: HP_MAX }, (_, i) => `<i class="${i < S.hp ? '' : 'off'}"></i>`).join('');
  cntEl.textContent = `ZOMBIES ${alive()}   ·   ÉLIMINÉS ${S.kills}`;
}
function finish(win) {
  if (win && S.over) return; S.over = true;
  document.getElementById('endT').textContent = win ? 'VICTOIRE' : 'PERDU';
  document.getElementById('endS').textContent = win ? `${S.kills} zombies éliminés` : `${S.kills} zombie${S.kills > 1 ? 's' : ''} éliminé${S.kills > 1 ? 's' : ''}`;
  endEl.style.display = 'flex';
}
function restart() {
  zombies.forEach(z => { scene.remove(z.g); scene.remove(z.sh); }); zombies.length = 0; gore.clear();
  Object.assign(S, { state:'ground', vy:0, y:0, yaw:Math.PI * 0.25, atkT:0, landT:0, jump:false, atk:false, hp:HP_MAX, step:0, queued:false, inv:0, hurtT:0, over:false, kills:0, deadT:0 });
  player.position.set(0, 0, 0); S.cur = ''; play('idle', 0.1); endEl.style.display = 'none'; startWave();
}
document.getElementById('bRe').addEventListener('pointerdown', e => { restart(); e.preventDefault(); });

// ---------- boucle de jeu ----------
const SPEED = 3.4, G = 19, JV = 6.6, LIM = HALF - 0.4;
const camRight = new THREE.Vector3(1, 0, -1).normalize(), camUp = new THREE.Vector3(-1, 0, -1).normalize();   // écran -> monde (vue isométrique)
function input() {
  let x = stick.x, y = stick.y;                                     // x droite, y bas (écran)
  const kx = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.q || keys.a ? 1 : 0);
  const ky = (keys.arrowdown || keys.s ? 1 : 0) - (keys.arrowup || keys.z || keys.w ? 1 : 0);
  if (kx || ky) { const l = Math.hypot(kx, ky); x = kx / l; y = ky / l; }
  const m = Math.min(Math.hypot(x, y), 1); if (m < 0.12) return { dir:new THREE.Vector3(), mag:0 };
  const dir = new THREE.Vector3().addScaledVector(camRight, x).addScaledVector(camUp, -y).setY(0).normalize();
  return { dir, mag:m };
}
function angleLerp(a, b, t) { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; }

function step(dt) {
  if (!ready) return;
  let { dir, mag } = input();
  if (S.over) { mag = 0; S.jump = S.atk = false; }
  S.inv = Math.max(0, S.inv - dt);
  const grounded = S.y <= 0 && S.vy <= 0;
  // saut
  if (S.jump) { S.jump = false; if (grounded && S.state !== 'attack' && S.state !== 'hurt') { S.vy = JV; S.state = 'air'; play('jstart', 0.08); } }
  // coup d'épée
  if (S.atk) { S.atk = false;
    if (S.state === 'attack') { if (S.step < COMBO.length - 1 && S.atkT > 0.05) S.queued = true; }
    else if (S.state !== 'air' && S.state !== 'hurt') { S.state = 'attack'; S.step = 0; S.queued = false; S.atkT = 0; S.swung = false; play(COMBO[0].key, 0.06); slash.visible = true; } }
  // déplacement
  const moveMul = S.state === 'attack' ? 0.18 : S.state === 'hurt' ? 0.4 : 1;
  if (mag > 0) {
    player.position.addScaledVector(dir, SPEED * (mag > 0.6 ? 1 : 0.55) * moveMul * dt);
    if (S.state !== 'attack') S.yaw = angleLerp(S.yaw, Math.atan2(dir.x, dir.z), 1 - Math.pow(0.0005, dt));
  }
  player.position.x = Math.max(-LIM, Math.min(LIM, player.position.x)); player.position.z = Math.max(-LIM, Math.min(LIM, player.position.z));
  // verticalité
  if (S.state === 'air') {
    S.vy -= G * dt; S.y += S.vy * dt;
    if (S.y <= 0) { S.y = 0; S.vy = 0; S.state = 'land'; S.landT = 0; play('jland', 0.06); }
    else if (S.cur === 'jstart' && acts.jstart.time > 0.35) play('jloop', 0.12);
  }
  if (S.state === 'land') { S.landT += dt; if (S.landT > 0.28) S.state = 'ground'; }
  if (S.state === 'hurt') { S.hurtT -= dt; if (S.hurtT <= 0) S.state = 'ground'; }
  if (S.state === 'dead') { S.deadT += dt; if (S.deadT > 1.5 && endEl.style.display !== 'flex') finish(false); }
  if (S.state === 'attack') {
    const c = COMBO[S.step]; S.atkT += dt;
    if (S.atkT < 0.32) player.position.addScaledVector(new THREE.Vector3(Math.sin(S.yaw), 0, Math.cos(S.yaw)), c.lunge * dt);   // petit élan vers l'avant
    if (!S.swung && S.atkT > c.hit) { S.swung = true; swordHit(c); }
    const k = (S.atkT - (c.hit - 0.04)) / 0.36; slash.visible = k > 0 && k < 1.2;
    slashMat.opacity = k > 0 ? Math.max(0, 0.85 * (1 - Math.max(0, k - 0.2))) : 0;
    slash.scale.setScalar((0.8 + 0.5 * Math.min(1, Math.max(0, k))) * c.sc);
    if (S.queued && S.atkT >= Math.min(c.cut, c.end - 0.05)) {                    // enchaîne le coup suivant
      S.step++; S.queued = false; S.atkT = 0; S.swung = false; play(COMBO[S.step].key, 0.06); slash.visible = true;
    } else if (S.atkT > c.end) { S.state = 'ground'; slash.visible = false; S.step = 0; }
  }
  if (S.state === 'ground' || S.state === 'land') {
    const want = mag > 0 ? (mag > 0.6 ? 'run' : 'walk') : 'idle';
    if (S.state === 'ground') play(want, 0.18);
  }
  // pose
  player.position.y = S.y; player.rotation.y = S.yaw; BASEY.uIslandY.value = S.y;
  slash.position.set(player.position.x + Math.sin(S.yaw) * 0.55, 0.06, player.position.z + Math.cos(S.yaw) * 0.55); slash.rotation.z = S.yaw - Math.PI / 2;
  shadow.position.x = player.position.x; shadow.position.z = player.position.z;
  const hs = Math.max(0.45, 1 - S.y * 0.35); shadow.scale.setScalar(hs); shadow.material.opacity = Math.max(0.45, 1 - S.y * 0.4);
  mixer.update(dt);
  if (!S.over || S.state === 'dead') updateZombies(dt);
  gore.update(dt);
  // caméra qui suit le robot (en douceur)
  const f = 1 - Math.pow(0.02, dt); camT.x += (player.position.x * 0.8 - camT.x) * f; camT.z += (player.position.z * 0.8 - camT.z) * f;
  cam.position.set(camT.x + CAMOFF.x, CAMOFF.y, camT.z + CAMOFF.z); cam.lookAt(camT.x, 0.3, camT.z);
}
let last = performance.now(), frozen = false;
startWave();
renderer.setAnimationLoop(() => { const n = performance.now(); const dt = Math.min((n - last) / 1000, 0.05); last = n; if (!frozen) step(dt); renderer.render(scene, cam); });

// accès pour les tests automatisés
window.__game = { S, stick, zombies, gore, restart, step: (n, dt = 1 / 30) => { frozen = true; for (let i = 0; i < n; i++) step(dt); renderer.render(scene, cam); },
  jump: () => { S.jump = true; }, atk: () => { S.atk = true; }, pos: () => player.position.toArray(), ready: () => ready, player, THREE: THREE, alive, hud };
