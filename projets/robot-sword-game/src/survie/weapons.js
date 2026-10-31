// Armes : modèles procéduraux au style Erathic (arêtes vives, accents jaunes), accrochage au point « Weapon » de la main du robot.
// Repère d'un modèle : lame le long de +y pour les épées ; canon le long de +z pour les armes à feu. Unités : celles du modèle du robot (1 unité = 1,3 m dans le jeu).
import * as THREE from 'three';
import { BASEY, bounds, limeMat, greyMat, darkMat } from '../materials.js';
import { C } from '../config.js';

// orientation d'une arme à feu dans la main en pose de visée (mesurée par tests/measure_robot.js : canon dans l'axe de l'avant-bras, dessus vers le haut)
export const GUN_QUAT = new THREE.Quaternion(-0.0164, 0.7162, 0.0292, 0.6971);

const mats = {};   // matériaux partagés, bornés en hauteur comme ceux du robot
const M = {
  lime: () => (mats.lime = mats.lime || bounds(limeMat(BASEY), 0, 2.5)),
  limeDark: () => (mats.limeDark = mats.limeDark || bounds(limeMat(BASEY, { low: 0.22, high: 0.8, diagA: 1, diagB: 0.7 }), 0, 2.5)),
  grey: () => (mats.grey = mats.grey || bounds(greyMat(BASEY, C.gris, '#FFFFFF'), 0, 2.5)),
  dark: () => (mats.dark = mats.dark || bounds(darkMat(BASEY), 0, 2.5)),
};
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d); g.setAttribute('aDiag', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
  const m = new THREE.Mesh(g, mat()); m.position.set(x, y, z); m.frustumCulled = false; return m;
}
const group = (...kids) => { const g = new THREE.Group(); kids.forEach(k => g.add(k)); return g; };

export const MODELS = {
  // épée à une main (utilisée comme objet à ramasser ; une fois équipée, c'est l'épée du modèle du robot qui s'affiche)
  sword1: () => group(box(0.14, 0.80, 0.04, M.lime, 0, 0.45, 0), box(0.045, 0.74, 0.06, M.limeDark, 0, 0.43, 0), box(0.36, 0.06, 0.08, M.grey, 0, 0.04, 0), box(0.06, 0.30, 0.06, M.dark, 0, -0.13, 0), box(0.11, 0.07, 0.11, M.grey, 0, -0.31, 0)),
  // épée à deux mains : longue lame, garde large, long manche
  sword2: () => group(box(0.15, 1.40, 0.04, M.lime, 0, 0.75, 0), box(0.045, 1.30, 0.06, M.limeDark, 0, 0.72, 0), box(0.52, 0.07, 0.09, M.grey, 0, 0.04, 0), box(0.08, 0.48, 0.08, M.dark, 0, -0.22, 0), box(0.14, 0.08, 0.14, M.grey, 0, -0.5, 0)),
  pistol: () => group(box(0.09, 0.12, 0.42, M.dark, 0, 0.02, 0.17), box(0.10, 0.05, 0.40, M.grey, 0, 0.10, 0.17), box(0.055, 0.055, 0.12, M.lime, 0, 0.03, 0.46), box(0.08, 0.22, 0.09, M.dark, 0, -0.12, 0.02)),
  mg: () => group(box(0.12, 0.16, 0.75, M.dark, 0, 0.02, 0.28), box(0.13, 0.05, 0.70, M.grey, 0, 0.12, 0.28), box(0.055, 0.055, 0.40, M.grey, 0, 0.03, 0.85), box(0.07, 0.07, 0.10, M.lime, 0, 0.03, 1.08),
    box(0.08, 0.26, 0.12, M.lime, 0, -0.19, 0.30), box(0.08, 0.22, 0.09, M.dark, 0, -0.14, -0.02), box(0.10, 0.12, 0.30, M.dark, 0, 0.0, -0.28)),
  laser: () => group(box(0.24, 0.24, 1.00, M.dark, 0, 0.04, 0.40), box(0.30, 0.30, 0.10, M.lime, 0, 0.04, 0.97), box(0.14, 0.14, 0.22, M.limeDark, 0, 0.04, 1.12),
    box(0.04, 0.38, 0.50, M.grey, 0.15, 0.04, 0.25), box(0.04, 0.38, 0.50, M.grey, -0.15, 0.04, 0.25), box(0.10, 0.10, 0.45, M.lime, 0, 0.20, 0.30), box(0.09, 0.22, 0.10, M.dark, 0, -0.16, 0.08)),
};

// proportions : les modèles sont dessinés à grande échelle puis réduits pour la taille du robot (valeur = facteur)
const SCALE = { sword2: 0.78, pistol: 0.62, mg: 0.6, laser: 0.62 };
Object.keys(SCALE).forEach(id => { const make = MODELS[id]; MODELS[id] = () => { const inner = make(), g = new THREE.Group(); inner.scale.setScalar(SCALE[id]); g.add(inner); return g; }; });

// équipement du robot : gère l'épée d'origine (maillage du modèle) et l'arme accrochée à la main
export function createLoadout(ctx) {
  const { pl } = ctx; let held = null;
  return {
    equip(def) {
      const sword = pl.model.getObjectByName('Sword'), bone = pl.model.getObjectByName('Weapon');
      if (held) { held.parent && held.parent.remove(held); held = null; }
      if (sword) sword.visible = def.model === 'robot';
      if (def.model && def.model !== 'robot') { const holder = new THREE.Group(); holder.add(MODELS[def.model]()); if (def.type === 'ranged') holder.quaternion.copy(GUN_QUAT); bone.add(holder); held = holder; }
    },
  };
}
// objet à ramasser : modèle de l'arme posé sur un socle lumineux
export function pickupModel(id) { return MODELS[id] ? MODELS[id]() : null; }
