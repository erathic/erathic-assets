// Objets à ramasser (armes lâchées par les super zombies, soins) : modèle flottant qui tourne, anneau et faisceau lumineux jaunes.
import * as THREE from 'three';
import { C } from '../config.js';
import { MODELS } from './weapons.js';
import { hyp } from '../util.js';

export function createPickups(ctx) {
  const { scene } = ctx.stage, list = [];
  const beamMat = new THREE.MeshBasicMaterial({ color: C.lime, transparent: true, opacity: 0.22, depthWrite: false }), ringMat = new THREE.MeshBasicMaterial({ color: C.lime, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  const beamGeo = new THREE.BoxGeometry(0.5, 3.2, 0.5), ringGeo = new THREE.RingGeometry(0.62, 0.8, 7);
  const limeFlat = new THREE.MeshBasicMaterial({ color: C.lime });
  function heartModel() {                                                  // croix jaune : soin
    const g = new THREE.Group(); [[0.5, 0.16, 0.16], [0.16, 0.5, 0.16]].forEach(([w, h, d]) => { g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), limeFlat)); }); return g;
  }
  function drop(kind, id, x, z) {                                          // kind : 'weapon' | 'heal'
    const root = new THREE.Group(), model = new THREE.Group(); const inner = kind === 'weapon' ? MODELS[id]() : heartModel();
    if (kind === 'weapon') { const isGun = id !== 'sword2'; inner.scale.setScalar(2.3); if (isGun) inner.position.z = -0.35; else { inner.rotation.z = Math.PI / 2.6; inner.position.set(0, -0.2, 0); } }
    model.add(inner); model.position.y = 1.1; root.add(model);
    const ring = new THREE.Mesh(ringGeo, ringMat.clone()); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; root.add(ring);
    const beam = new THREE.Mesh(beamGeo, beamMat.clone()); beam.position.y = 1.6; root.add(beam);
    root.position.set(x, 0, z); scene.add(root); const p = { kind, id, root, model, ring, beam, t: 0 }; list.push(p); return p;
  }
  function update(dt, playerPos, onCollect) {
    for (let i = list.length - 1; i >= 0; i--) { const p = list[i]; p.t += dt;
      p.model.rotation.y += dt * 1.8; p.model.position.y = 1.1 + Math.sin(p.t * 2.4) * 0.12; const s = 1 + Math.sin(p.t * 4) * 0.08; p.ring.scale.set(s, s, s); p.beam.material.opacity = 0.16 + Math.sin(p.t * 3) * 0.06;
      if (hyp(p.root.position.x - playerPos.x, p.root.position.z - playerPos.z) < 1.05) { scene.remove(p.root); list.splice(i, 1); onCollect(p); } }
  }
  function clear() { list.forEach(p => scene.remove(p.root)); list.length = 0; }
  return { drop, update, clear, list };
}
