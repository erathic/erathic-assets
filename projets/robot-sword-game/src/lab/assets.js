// Atelier : chargement des objets (robot, épée du robot, zombie, épée de démonstration, fichier déposé) et inventaire de leurs clips.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';   // lit les dérivés compressés par l'atelier local (EXT_meshopt_compression)
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { styleRobot, clipFromJson } from '../player.js';
import { loadZombieSource } from '../zombies.js';
import { C, ANIMS } from '../config.js';
import { zMat, limeMat, greyMat, bounds } from '../materials.js';
import { b64ToBuffer } from '../util.js';
import BOT_B64 from '../../bot.b64.txt';
import JUMPS from '../../jumps.json';
import FRANK from '../../frank_clips.json';

// clé de jeu d'un clip (pour retrouver sa transition dans la table TRANSITIONS)
const gameKey = {}; [...ANIMS.native, ...ANIMS.frank, ...ANIMS.jumps].forEach(([k, name]) => { gameKey[name] = k; });
const item = (group, name, clip) => ({ group, name, clip, key:gameKey[name] || null });

export const ensureDiag = g => { if (!g.attributes.aDiag) g.setAttribute('aDiag', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1)); if (!g.attributes.normal) g.computeVertexNormals(); };

// ---------- robot ----------
function parseRobot() {
  return new Promise((res, rej) => new GLTFLoader().parse(b64ToBuffer(BOT_B64), '', gltf => {
    const model = gltf.scene; model.traverse(o => { if (o.isMesh) o.userData.orig = o.material; });
    styleRobot(model);
    const group = new THREE.Group(); group.add(model); model.updateMatrixWorld(true);
    const hp = new THREE.Vector3(); model.getObjectByName('Head').getWorldPosition(hp);
    const sc = 1.9 / hp.y; group.scale.setScalar(sc); group.updateMatrixWorld(true);                       // même échelle que dans le jeu
    const hw = new THREE.Vector3(); model.getObjectByName('Hips').getWorldPosition(hw); model.position.x -= hw.x / sc; model.position.z -= hw.z / sc;
    const clips = [
      ...gltf.animations.map(a => item('Robot (natif)', a.name, a)),
      ...Object.keys(FRANK).map(n => item('Frank (adapté au robot)', n, clipFromJson(n, FRANK[n]))),
      ...Object.keys(JUMPS).map(n => item('UAL1 (adapté au robot)', n, clipFromJson(n, JUMPS[n]))),
    ];
    res({ root:group, model, clips, gltf });
  }, rej));
}
export async function loadRobot() { const r = await parseRobot(); return { kind:'robot', name:'Robot (Character-bot)', root:r.root, clips:r.clips, game:true, hasOriginal:true, sword:r.model.getObjectByName('Sword') }; }

// l'épée est un maillage skinné sur le point d'attache « Weapon » : on isole en masquant tout le reste
export async function loadRobotSword() {
  const r = await parseRobot(); const sword = r.model.getObjectByName('Sword');
  r.model.traverse(o => { if (!o.isMesh) return; let p = o, inSword = false; while (p) { if (p === sword) inSword = true; p = p.parent; } if (!inSword) o.visible = false; });
  return { kind:'sword', name:'Épée du robot (nœud Sword)', root:r.root, clips:r.clips, game:true, hasOriginal:true };
}

// ---------- zombie ----------
let zsrc = null;
export function loadZombie() {
  zsrc = zsrc || loadZombieSource();
  const model = skClone(zsrc.o); model.scale.setScalar(zsrc.scale); model.position.copy(zsrc.offset);
  const g = new THREE.Group(); g.add(model);
  const wholes = [], parts = []; model.traverse(n => { if (n.userData.whole) wholes.push(n); else if (n.userData.part) parts.push(n); });
  const clips = zsrc.o.animations.map(a => item('Zombie (Quaternius)', a.name, a));
  return { kind:'zombie', name:'Zombie (Quaternius)', root:g, model, clips, wholes, parts, game:true, hasOriginal:false };
}

// ---------- épée de démonstration (procédurale, style Erathic) ----------
export function makeDemoSword() {
  const g = new THREE.Group(); const shared = { uIslandY:{ value:0 } };
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.9, 0.016), bounds(limeMat(shared), -0.1, 1.2));
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.06), bounds(greyMat(shared), -0.1, 1.2));
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.22, 0.036), bounds(greyMat(shared, C.anthra), -0.1, 1.2));
  const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.07), bounds(greyMat(shared), -0.1, 1.2));
  blade.position.y = 0.46 + 0.02; guard.position.y = 0.02; grip.position.y = -0.11; pommel.position.y = -0.245;
  [blade, guard, grip, pommel].forEach(m => { ensureDiag(m.geometry); g.add(m); });
  return { kind:'weapon', name:'Épée de démonstration', root:g, clips:[], game:false, hasOriginal:false };
}

// ---------- fichier déposé (GLB ou FBX) ----------
export async function loadFile(file) {
  const ext = file.name.split('.').pop().toLowerCase(), buf = await file.arrayBuffer(); let root, anims = [];
  if (ext === 'glb' || ext === 'gltf') { const gltf = await new Promise((res, rej) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(buf, '', res, rej)); root = gltf.scene; anims = gltf.animations; }
  else if (ext === 'fbx') { root = new FBXLoader().parse(buf, ''); anims = root.animations || []; }
  else throw new Error('Format non pris en charge : .' + ext + ' (GLB, GLTF ou FBX)');
  root.traverse(o => { if (o.isMesh) o.userData.orig = o.material; });
  return { kind:'file', name:file.name, root, clips:anims.map(a => item('Fichier', a.name || '(sans nom)', a)), game:false, hasOriginal:true };
}

export { zMat };
