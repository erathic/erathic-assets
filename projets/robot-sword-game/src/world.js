// Décor : plateforme carrée, ombre douce, arc du coup d'épée.
import * as THREE from 'three';
import { gradientMaterial } from './shaders.js';
import { C, HALF, THICK } from './config.js';
import { PLAT, bounds, limeMat, greyMat } from './materials.js';

// ombre douce (texture radiale), partagée par le robot et les zombies
export function makeBlobTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(0,0,0,0.55)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createWorld(scene) {
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
  // ombre sous le robot
  const blobTex = makeBlobTexture();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), new THREE.MeshBasicMaterial({ map:blobTex, transparent:true, depthWrite:false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; shadow.renderOrder = 1; scene.add(shadow);
  // arc du coup d'épée
  const slashMat = new THREE.MeshBasicMaterial({ color:C.lime, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false });
  const slash = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.9, 24, 1, -Math.PI * 0.55, Math.PI * 1.1), slashMat);
  slash.rotation.x = -Math.PI / 2; slash.visible = false; slash.renderOrder = 2; scene.add(slash);
  return { platform, blobTex, shadow, slash, slashMat };
}
