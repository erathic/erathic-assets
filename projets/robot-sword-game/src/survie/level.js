// Île Erathic jouable : dalle heptagonale flottante, logo Erathic extrudé au centre, cocotiers en couronne, rochers, ombres douces, particules.
// Réutilise la scène de démonstration (projets/ile-erathic : logo3d.js, modèles Kenney en base64) et les shaders du jeu.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import ASSETS from '../../../ile-erathic/src_assets.json';
import LOGO from '../../../ile-erathic/logo_items.json';
import { createExtrudedLogo } from '../../../ile-erathic/logo3d.js';
import { fresnelMaterial, gradientMaterial, partGradient } from '../shaders.js';
import { C } from '../config.js';
import { b64ToBuffer } from '../util.js';
import { ARENA } from './config.js';

// charte : bords éclaircis et dégradés verticaux (mêmes réglages que la scène de démonstration)
const RIM = { [C.gris]: '#FFFFFF', [C.gris2]: '#FCFCFD', [C.lime]: '#EEFF72' };
const VG = { [C.gris]: [0.28, 1.20], [C.gris2]: [0.30, 1.20], [C.lime]: [0.34, 1.10] };
const EXTRA = { [C.lime]: { diagA: 1.18, diagB: 0.5, power: 1.05, glow: 1 } };
const mat = (hex, vertical = false) => RIM[hex]
  ? fresnelMaterial(hex, RIM[hex], vertical ? { low: VG[hex][0], high: VG[hex][1], ...(EXTRA[hex] || {}) } : {})
  : new THREE.MeshLambertMaterial({ color: new THREE.Color(hex), flatShading: true });
const MAP = { leafsGreen: C.lime, grass: C.lime, woodBark: C.gris, dirt: C.gris2, stone: C.gris2, wood: C.gris };
const POL = (r, deg) => [r * Math.cos(deg * Math.PI / 180), r * Math.sin(deg * Math.PI / 180)];

export function createLevel(scene) {
  const k = ARENA.k, SEG = 7, island = new THREE.Group(); island.position.y = -0.06; scene.add(island);          // la surface du dessus est à y = 0
  const strata = new THREE.Group(); island.add(strata);                                                           // sous-structure : seule partie qui flotte (oscille)
  const circles = [], segments = [], sway = [], pending = [];
  const cyl = (rt, rb, h, hex, y, rot = 0, parent = island) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt * k, rb * k, h * k, SEG, 1), mat(hex)); m.position.y = y * k; m.rotation.y = rot; parent.add(m); return m; };

  // dalle claire, dessus gris-noir, liseré jaune
  cyl(3.5, 3.5, 0.4, C.gris, -0.2);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(3.3 * k, 3.3 * k, 0.06, SEG, 1), [mat(C.anthra), gradientMaterial('#62636C', '#17181B', 3.3 * k, { gain: 1.35 }), mat(C.anthra)]); top.position.y = 0.03; island.add(top);
  const hexPts = r => { const pts = []; for (let i = 0; i < SEG; i++) { const th = i / SEG * Math.PI * 2; pts.push(new THREE.Vector2(r * Math.sin(th), -r * Math.cos(th))); } return pts; };
  const shp = new THREE.Shape(hexPts(3.28 * k)); shp.holes.push(new THREE.Path(hexPts(2.98 * k)));
  const ringG = new THREE.ExtrudeGeometry(shp, { depth: 0.03, bevelEnabled: false }); ringG.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: C.lime })); ring.position.y = 0.06; island.add(ring);
  cyl(3.1, 2.6, 0.5, C.gris2, -0.65, 0.2, strata); cyl(2.5, 1.7, 0.6, C.gris, -1.2, 0.5, strata); cyl(1.6, 0.9, 0.7, C.gris2, -1.85, 0.9, strata); cyl(0.8, 0.15, 0.8, C.gris, -2.6, 0.3, strata);

  // ombres douces (taches radiales, sans carte d'ombre)
  const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), SUN = new THREE.Vector2(-7, -3).normalize();
  const SH = { tree: [0.30, 0.55, 0.80, 0.30, 0.30], rock: [0.55, 0.50, 1.00, 0.30, 0.20], plant: [0.40, 0.45, 0.70, 0.25, 0.15], log: [0.55, 0.50, 0.95, 0.28, 0.15] };
  const blob = (x, z, r, a) => { const m = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: blobTex, color: 0x000000, transparent: true, opacity: a, depthWrite: false })); m.scale.set(r * 2, 1, r * 2); m.position.set(x, 0.064, z); m.renderOrder = 1; island.add(m); };
  const shadowsFor = (name, x, z, s) => { const p = SH[name.split('_')[0]]; if (!p) return; blob(x, z, p[0] * s, p[1]); blob(x + SUN.x * p[4] * s, z + SUN.y * p[4] * s, p[2] * s, p[3]); };

  // modèles Kenney (CC0) recolorés
  const loader = new GLTFLoader();
  function place(name, x, z, s, ry, { swayOn = false, r = 0 } = {}) {
    shadowsFor(name, x, z, s); if (r > 0) circles.push({ x, z, r });
    pending.push(new Promise(res => loader.parse(b64ToBuffer(ASSETS[name]), '', gltf => {
      const o = gltf.scene; o.traverse(n => { if (n.isMesh) n.material = mat(MAP[n.material.name] || C.gris2, true); });
      o.scale.setScalar(s); o.position.set(x, 0.06, z); o.rotation.y = ry; island.add(o); island.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(island.matrixWorld).invert(); o.traverse(n => { if (n.isMesh) partGradient(n, inv); });
      const bb = new THREE.Box3().setFromObject(o);
      o.traverse(n => { if (n.isMesh && n.material.userData.U) { n.material.userData.U.uYMin.value = bb.min.y - island.position.y; n.material.userData.U.uYMax.value = bb.max.y - island.position.y; } });
      if (swayOn) sway.push({ o, ph: Math.random() * 6.28 }); res();
    })));
  }

  // logo Erathic extrudé, recto-verso, planté au centre ; il sert d'obstacle (segment épais)
  const darkMat = () => fresnelMaterial(C.anthra, '#7C7D87', { power: 2.0, strength: 0.7, low: 0.85, high: 1.15 });
  const logo = createExtrudedLogo(LOGO, { height: ARENA.logoH, gid: 1, materialFor: role => role === 'dark' ? darkMat() : role === 'lime' ? mat(C.lime, true) : mat(C.gris) });
  const lb = new THREE.Box3().setFromObject(logo), lsize = lb.getSize(new THREE.Vector3());      // avant rotation : largeur en x, épaisseur en z
  logo.position.set(0, 0.06 + logo.userData.eyeToBottom - 0.08 * k, 0); logo.rotation.y = Math.PI / 4; island.add(logo); island.updateMatrixWorld(true);
  { const inv = new THREE.Matrix4().copy(island.matrixWorld).invert(); logo.traverse(n => { if (n.isMesh && n.userData.role === 'lime') partGradient(n, inv); });
    const bb = new THREE.Box3().setFromObject(logo); logo.traverse(n => { if (n.isMesh && n.material.userData.U) { n.material.userData.U.uYMin.value = bb.min.y - island.position.y; n.material.userData.U.uYMax.value = bb.max.y - island.position.y; } }); }
  { const half = lsize.x * 0.5 * 0.85, ux = Math.cos(Math.PI / 4), uz = -Math.sin(Math.PI / 4);                  // direction de la largeur du logo après rotation de 45° autour de y
    segments.push({ ax: -ux * half, az: -uz * half, bx: ux * half, bz: uz * half, r: Math.max(0.35, lsize.z * 0.5 + 0.12) });
    const m = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: blobTex, color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false })); m.scale.set(lsize.x * 1.9, 1, 1.8); m.rotation.y = Math.PI / 4; m.position.set(0, 0.064, 0); m.renderOrder = 1; island.add(m); }

  // cocotiers en couronne, rochers et souches dans les intervalles, quelques abris plus près du centre
  const S = 1.5;       // les objets sont plus grands que sur la petite île : l'arène est plus vaste
  [['tree_palmTall', 20, 2.45, 0.95], ['tree_palmBend', 65, 2.35, 0.95], ['tree_palmShort', 110, 2.5, 0.9], ['tree_palmDetailedTall', 155, 2.4, 0.85],
   ['tree_palmTall', 200, 2.55, 0.8], ['tree_palmBend', 245, 2.4, 0.9], ['tree_palmShort', 290, 2.45, 0.85], ['tree_palmDetailedTall', 335, 2.5, 0.9]
  ].forEach(([n, deg, r, s], i) => { const [x, z] = POL(r * k, deg); place(n, x, z, s * S, i * 0.8 + 0.4, { swayOn: true, r: 0.38 }); });
  [['rock_largeA', 42, 2.4, 1.1, 0.8, 0.95], ['plant_bush', 87, 2.3, 1.2, 0.3, 0], ['log', 132, 2.35, 1.1, 1.2, 0.55], ['rock_smallC', 177, 2.35, 1.1, 2.0, 0.5],
   ['plant_bush', 222, 2.3, 1.1, 1.5, 0], ['plant_bush', 312, 2.2, 1.0, 0.7, 0], ['rock_smallC', 357, 2.4, 1.0, 0.4, 0.5]
  ].forEach(([n, deg, r, s, ry, cr]) => { const [x, z] = POL(r * k, deg); place(n, x, z, s * S, ry, { r: cr }); });
  [['rock_smallC', 30, 1.55, 0.9, 0.9, 0.45], ['rock_largeA', 150, 1.45, 0.8, 2.4, 0.8], ['rock_smallC', 262, 1.5, 0.85, 1.7, 0.45]].forEach(([n, deg, r, s, ry, cr]) => { const [x, z] = POL(r * k, deg); place(n, x, z, s * S, ry, { r: cr }); });

  // particules angulaires flottantes (deux maillages instanciés)
  const cubes = []; const pg = new THREE.BoxGeometry(1, 1, 1), imA = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ color: C.lime }), 7), imB = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ color: C.gris }), 19);
  for (let i = 0; i < 26; i++) cubes.push({ a: i * 2.399, r: (3.6 + (i * 53 % 10) / 10 * 2.6) * k * 0.75, y: -2.5 + (i * 29 % 100) / 100 * 6, sp: 0.18 + (i % 5) * 0.05, ph: i, s: 0.05 + (i * 37 % 10) / 10 * 0.08, im: i % 4 === 0 ? imA : imB, idx: i % 4 === 0 ? Math.floor(i / 4) : i - Math.floor(i / 4) - 1 });
  scene.add(imA, imB); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();

  function update(t) {
    strata.position.y = Math.sin(t * 0.9) * 0.12;                                     // la sous-structure oscille ; le dessus reste fixe (le jeu s'y joue)
    sway.forEach(p => { p.o.rotation.z = Math.sin(t * 1.1 + p.ph) * 0.035; });
    cubes.forEach(c => { const a = c.a + t * c.sp * 0.4, y = ((c.y + t * c.sp * 0.6 + 2.5) % 6) - 2.5; ps.set(Math.cos(a) * c.r, y, Math.sin(a) * c.r); e.set(t * 0.6 + c.ph, t * 0.8, 0); q.setFromEuler(e); sc.setScalar(c.s * 1.4); m4.compose(ps, q, sc); c.im.setMatrixAt(c.idx, m4); });
    imA.instanceMatrix.needsUpdate = true; imB.instanceMatrix.needsUpdate = true;
  }
  return { island, circles, segments, update, ready: () => Promise.all(pending), logoSize: lsize };
}
