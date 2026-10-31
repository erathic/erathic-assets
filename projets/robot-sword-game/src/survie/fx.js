// Habillage du robot : ombre douce sous le robot, arc du coup en mêlée.
import * as THREE from 'three';
import { C } from '../config.js';
import { makeBlobTexture } from '../world.js';

export function createFx(scene) {
  const blobTex = makeBlobTexture();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; shadow.renderOrder = 1; scene.add(shadow);
  const slashMat = new THREE.MeshBasicMaterial({ color: C.lime, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const slash = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.9, 24, 1, -Math.PI * 0.55, Math.PI * 1.1), slashMat);
  slash.rotation.x = -Math.PI / 2; slash.visible = false; slash.renderOrder = 2; scene.add(slash);
  return { blobTex, shadow, slash, slashMat };
}
