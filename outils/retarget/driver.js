// driver.js : charge les fichiers (GLB / FBX) et appelle retargetClips. Exposé à la page pour un usage en ligne de commande (Playwright).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { retargetClips, RIG_MAPS } from './retarget.js';
const loadGLB = (u) => new Promise((ok, ko) => new GLTFLoader().load(u, ok, undefined, ko));
const loadFBX = (u) => new Promise((ok, ko) => new FBXLoader().load(u, ok, undefined, ko));
/** cfg = { target:'bot.glb', source:{ url, type:'glb'|'fbx' }, map:'botFromUE', root:'root'|null, clips:{ nomSortie: 'NomDansLeGLB' | 'fichier.fbx' } } */
window.retarget = async (cfg) => {
  const bot = await loadGLB(cfg.target); let tSk = null; bot.scene.traverse((o) => { if (o.isSkinnedMesh && !tSk) tSk = o; });
  const src = cfg.source.type === 'fbx' ? await loadFBX(cfg.source.url) : await loadGLB(cfg.source.url); const root = cfg.source.type === 'fbx' ? src : src.scene;
  const clips = {};
  for (const [out, ref] of Object.entries(cfg.clips)) {
    if (/\.fbx$/i.test(ref)) { clips[out] = (await loadFBX(ref)).animations[0]; }
    else { const c = src.animations.find((a) => a.name === ref); if (!c) throw new Error('clip introuvable : ' + ref); clips[out] = c; }
  }
  return retargetClips({ target: tSk, source: root, clips, map: RIG_MAPS[cfg.map || 'botFromUE'], root: cfg.root === undefined ? 'root' : cfg.root });
};
window.__ready = true;
