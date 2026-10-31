// Atelier : inspection, modes de matériaux, repères visuels, tenue d'arme (point d'attache réglable) et démembrement.
import * as THREE from 'three';
import { LIMBS } from '../gore.js';
import { greyMat, bounds } from '../materials.js';
import { ensureDiag } from './assets.js';

// ---------- inventaire ----------
export function inspect(root) {
  let tris = 0, meshes = 0, skinned = 0; const mats = new Set(), bones = new Set();
  root.traverseVisible(o => { if (!o.isMesh) return; meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    if (o.isSkinnedMesh) { skinned++; o.skeleton.bones.forEach(b => bones.add(b.name)); } (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => mats.add(m.name || m.type)); });
  const box = new THREE.Box3().setFromObject(root, true), s = box.getSize(new THREE.Vector3());
  return { tris:Math.round(tris), meshes, skinned, bones:bones.size, materials:[...mats], size:[+s.x.toFixed(3), +s.y.toFixed(3), +s.z.toFixed(3)] };
}

// ---------- matériaux ----------
export function prepareMaterials(root) { root.traverse(o => { if (o.isMesh) o.userData.def = o.userData.def || o.material; }); }
let normalMat = null;
export function applyMaterialMode(root, mode, wire) {
  const box = new THREE.Box3().setFromObject(root, true), lo = box.min.y - 0.05, hi = box.max.y + 0.05; let grey = null;
  root.traverse(o => { if (!o.isMesh) return;
    if (mode === 'defaut') o.material = o.userData.def;
    else if (mode === 'original') o.material = o.userData.orig || o.userData.def;
    else if (mode === 'gris') { ensureDiag(o.geometry); grey = grey || bounds(greyMat({ uIslandY:{ value:0 } }), lo, hi); o.material = grey; }
    else if (mode === 'normales') { normalMat = normalMat || new THREE.MeshNormalMaterial(); o.material = normalMat; } });
  setWireframe(root, wire);
}
export function setWireframe(root, on) { root.traverse(o => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.wireframe = on; }); }); }

// ---------- repères : squelette et boîte englobante ----------
export function createHelpers(viewer) {
  let skel = null, box = null, boxObj = null, root = null;
  return {
    set(newRoot) { this.clear(); root = newRoot; },
    clear() { [skel, box].forEach(h => h && h.parent && h.parent.remove(h)); skel = box = null; boxObj = null; },
    skeleton(on) { if (on && !skel && root) { skel = new THREE.SkeletonHelper(root); viewer.scene.add(skel); } if (skel) skel.visible = on; },
    bbox(on) { if (on && !box && root) { boxObj = new THREE.Box3(); box = new THREE.Box3Helper(boxObj, 0xDBFF00); viewer.scene.add(box); } if (box) box.visible = on; },
    update() { if (box && box.visible && root) boxObj.setFromObject(root, false); },
  };
}

// ---------- tenue d'arme : on accroche un objet à un os et on règle sa position, sa rotation et son échelle ----------
export function createWeaponTool(viewer) {
  let weapon = null, bone = null, axes = null, meta = { name:'', bone:'' };
  const bonesOf = root => { const b = []; root.traverse(o => { if (o.isBone) b.push(o.name); }); return b; };
  function detach() { if (weapon && weapon.parent) weapon.parent.remove(weapon); if (axes && axes.parent) axes.parent.remove(axes); weapon = null; axes = null; bone = null; }
  function attach(root, obj, name, boneName, size = 0.2) {
    detach(); bone = root.getObjectByName(boneName); if (!bone) throw new Error('Os introuvable : ' + boneName);
    weapon = obj; meta = { name, bone:boneName }; bone.add(weapon); axes = new THREE.AxesHelper(size); bone.add(axes);
  }
  const set = ({ pos, rot, scale }) => { if (!weapon) return; weapon.position.set(...pos); weapon.rotation.set(rot[0] * Math.PI / 180, rot[1] * Math.PI / 180, rot[2] * Math.PI / 180); weapon.scale.setScalar(scale); };
  const showAxes = on => { if (axes) axes.visible = on; };
  function json() {
    if (!weapon) return null; const r = [weapon.rotation.x, weapon.rotation.y, weapon.rotation.z].map(x => +(x * 180 / Math.PI).toFixed(2));
    return { weapon:meta.name, bone:meta.bone, position:weapon.position.toArray().map(x => +x.toFixed(4)), rotation_deg:r, scale:+weapon.scale.x.toFixed(4), note:'repère local de l\'os ; unités du modèle' };
  }
  return { bonesOf, attach, detach, set, showAxes, json, get attached() { return !!weapon; } };
}

// ---------- démembrement du zombie ----------
export function createDismember(gore, zMat) {
  const rnd = (a, b) => a + Math.random() * (b - a);
  function cut(obj, keys) {
    if (!obj.wholes) return 0; obj.wholes.forEach(m => { m.visible = false; }); obj.parts.forEach(m => { m.visible = true; });
    obj.root.updateMatrixWorld(true); const wp = new THREE.Vector3(), chest = obj.model.getObjectByName('Spine1'); if (chest) { chest.getWorldPosition(wp); gore.burst(wp, new THREE.Vector3(0, 0, 1), 60, 2.6); }
    let n = 0; keys.forEach(k => { const part = obj.model.getObjectByName('part_' + k), bone = obj.model.getObjectByName(LIMBS[k].stump); if (!part || !part.parent) return;
      gore.detach(part, zMat, new THREE.Vector3(rnd(-1.5, 1.5), rnd(3, 5), rnd(1, 3.5))); gore.spurt(p => { obj.root.updateMatrixWorld(true); bone.getWorldPosition(p); }, rnd(0.7, 1)); n++; });
    return n;
  }
  return { cut, keys:Object.keys(LIMBS) };
}
